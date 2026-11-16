-- =====================================================================
-- BOX800 – myndir iðkenda, drop-in og biðlisti frá þjálfara
-- Keyrt á eftir 007. Má keyra aftur án skaða.
-- =====================================================================

-- Drop-in: gestur sem er ekki með aðgang (netfang valfrjálst)
alter table profiles add column if not exists drop_in boolean not null default false;

-- Þjálfari bætir við iðkanda: beint í tímann eða á biðlista (aftast)
create or replace function staff_add(p_class bigint, p_profile uuid, p_waitlist boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare c classes; b bookings;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if not p_waitlist then return book_class(p_class, p_profile); end if;
  select * into c from classes where id = p_class for update;
  if not found then raise exception 'Tíminn fannst ekki'; end if;
  if c.cancelled_at is not null then raise exception 'Tímanum hefur verið aflýst'; end if;
  select * into b from bookings where class_id = p_class and profile_id = p_profile;
  if found and b.status in ('booked', 'waitlist') then return b.status; end if;
  insert into bookings (class_id, profile_id, status, waitlist_at)
  values (p_class, p_profile, 'waitlist', now())
  on conflict (class_id, profile_id) do update set status = 'waitlist', waitlist_at = now(), checked_in_at = null, updated_at = now();
  insert into audit_log (actor_id, action, class_id, detail) values (me(), 'add_waitlist', p_class, jsonb_build_object('profile', p_profile));
  return 'waitlist';
end $$;

-- Þjálfari stofnar drop-in gest (eða finnur þann sem er til með sama netfangi)
create or replace function create_dropin(p_name text, p_email text default null, p_phone text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; e text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nafn vantar'; end if;
  if e is not null then
    select id into pid from profiles where lower(email) = e and not is_dependent;
    if found then return pid; end if;
  end if;
  insert into profiles (full_name, email, phone, drop_in, note)
  values (trim(p_name), e, nullif(trim(coalesce(p_phone, '')), ''), true, 'Drop-in')
  returning id into pid;
  return pid;
end $$;

revoke execute on function staff_add(bigint, uuid, boolean), create_dropin(text, text, text) from public, anon;
grant execute on function staff_add(bigint, uuid, boolean), create_dropin(text, text, text) to authenticated;

-- Myndir: geymsla í Supabase Storage („avatars“, opin til lesturs).
-- Hver má aðeins setja inn mynd í sína möppu (prófíl-id); eigandi má setja inn fyrir alla.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;   -- t.d. prófunarumhverfi án Storage
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true;

  execute 'drop policy if exists "avatars lesa" on storage.objects';
  execute 'create policy "avatars lesa" on storage.objects for select using (bucket_id = ''avatars'')';
  execute 'drop policy if exists "avatars setja inn" on storage.objects';
  execute 'create policy "avatars setja inn" on storage.objects for insert to authenticated
           with check (bucket_id = ''avatars'' and ((storage.foldername(name))[1] = public.me()::text or public.is_owner()))';
  execute 'drop policy if exists "avatars breyta" on storage.objects';
  execute 'create policy "avatars breyta" on storage.objects for update to authenticated
           using (bucket_id = ''avatars'' and ((storage.foldername(name))[1] = public.me()::text or public.is_owner()))';
  execute 'drop policy if exists "avatars eyða" on storage.objects';
  execute 'create policy "avatars eyða" on storage.objects for delete to authenticated
           using (bucket_id = ''avatars'' and ((storage.foldername(name))[1] = public.me()::text or public.is_owner()))';
end $$;
