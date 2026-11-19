-- =====================================================================
-- BOX800 – myndbönd í einkaþjálfun: iðkandi sendir myndband, þjálfari gefur endurgjöf.
-- Myndböndin eru læst (aðeins iðkandinn sjálfur og þjálfarar/eigendur sjá þau).
-- Keyrt á eftir 019. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists pt_videos (
  id           bigserial primary key,
  profile_id   uuid not null references profiles(id) on delete cascade,
  day          date not null,
  path         text not null,          -- slóð í Storage: <prófíl-id>/<skrá>
  note         text,                   -- skilaboð frá iðkanda
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  feedback     text,
  feedback_by  uuid references profiles(id) on delete set null,
  feedback_at  timestamptz,
  seen_at      timestamptz             -- iðkandi hefur séð endurgjöfina
);
create index if not exists pt_videos_profile_idx on pt_videos (profile_id, created_at desc);

alter table pt_videos enable row level security;
drop policy if exists p_ptv_read on pt_videos;
create policy p_ptv_read on pt_videos for select to authenticated using (profile_id = me() or is_staff());
drop policy if exists p_ptv_insert on pt_videos;
create policy p_ptv_insert on pt_videos for insert to authenticated with check (profile_id = me() and has_pt());
drop policy if exists p_ptv_delete on pt_videos;
create policy p_ptv_delete on pt_videos for delete to authenticated using (profile_id = me() or is_staff());

-- Iðkandi sendir inn: eigendur fá tilkynningu
create or replace function pt_video_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select full_name into nm from profiles where id = new.profile_id;
  insert into notifications (profile_id, title, body, kind)
  select o.id, 'Nýtt myndband: ' || coalesce(nm, 'Iðkandi'), coalesce(left(new.note, 140), '1 on 1 · ' || to_char(new.day, 'DD.MM.')), 'pt_video'
  from profiles o where o.role = 'owner';
  return new;
end $$;
drop trigger if exists pt_video_added on pt_videos;
create trigger pt_video_added after insert on pt_videos for each row execute function pt_video_added();

-- Þjálfari gefur endurgjöf: iðkandinn fær tilkynningu
create or replace function pt_video_feedback(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v pt_videos;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update pt_videos set feedback = nullif(trim(p_text), ''), feedback_by = me(), feedback_at = now(), seen_at = null
  where id = p_id returning * into v;
  if v.id is not null and v.feedback is not null then
    insert into notifications (profile_id, title, body, kind)
    values (v.profile_id, 'Endurgjöf á myndbandið þitt', left(v.feedback, 160), 'pt_feedback');
  end if;
end $$;
revoke execute on function pt_video_feedback(bigint, text) from public, anon;
grant execute on function pt_video_feedback(bigint, text) to authenticated;

create or replace function pt_video_seen(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update pt_videos set seen_at = now() where id = p_id and profile_id = me() and seen_at is null
$$;
grant execute on function pt_video_seen(bigint) to authenticated;

-- Geymsla: læst hólf „pt-videos“, mest 100 MB á myndband
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('pt-videos', 'pt-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "pt-videos lesa" on storage.objects';
  execute 'create policy "pt-videos lesa" on storage.objects for select to authenticated
           using (bucket_id = ''pt-videos'' and ((storage.foldername(name))[1] = public.me()::text or public.is_staff()))';
  execute 'drop policy if exists "pt-videos setja inn" on storage.objects';
  execute 'create policy "pt-videos setja inn" on storage.objects for insert to authenticated
           with check (bucket_id = ''pt-videos'' and (storage.foldername(name))[1] = public.me()::text and public.has_pt())';
  execute 'drop policy if exists "pt-videos eyða" on storage.objects';
  execute 'create policy "pt-videos eyða" on storage.objects for delete to authenticated
           using (bucket_id = ''pt-videos'' and ((storage.foldername(name))[1] = public.me()::text or public.is_staff()))';
end $$;
