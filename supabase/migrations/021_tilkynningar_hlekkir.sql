-- =====================================================================
-- BOX800 – tilkynningar með hlekk: smellt á tilkynningu → beint á rétta síðu.
-- Keyrt á eftir 020. Má keyra aftur án skaða.
-- =====================================================================

alter table notifications add column if not exists link text;

-- Nýtt myndband → prófíl iðkandans, 1 on 1 flipinn
create or replace function pt_video_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select full_name into nm from profiles where id = new.profile_id;
  insert into notifications (profile_id, title, body, kind, link)
  select o.id, 'Nýtt myndband: ' || coalesce(nm, 'Iðkandi'), coalesce(left(new.note, 140), '1 on 1 · ' || to_char(new.day, 'DD.MM.')), 'pt_video',
         '/stjorn/idkendur/' || new.profile_id || '?t=pt'
  from profiles o where o.role = 'owner';
  return new;
end $$;

-- Endurgjöf → 1 on 1 síða iðkandans, á réttum degi
create or replace function pt_video_feedback(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v pt_videos;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update pt_videos set feedback = nullif(trim(p_text), ''), feedback_by = me(), feedback_at = now(), seen_at = null
  where id = p_id returning * into v;
  if v.id is not null and v.feedback is not null then
    insert into notifications (profile_id, title, body, kind, link)
    values (v.profile_id, 'Endurgjöf á myndbandið þitt', left(v.feedback, 160), 'pt_feedback', '/einkathjalfun?d=' || v.day);
  end if;
end $$;

-- Eldri tilkynningar fá hlekk líka
update notifications n set link = '/stjorn/idkendur/' || v.profile_id || '?t=pt'
from pt_videos v
where n.kind = 'pt_video' and n.link is null and n.title = 'Nýtt myndband: ' || (select full_name from profiles where id = v.profile_id);
update notifications set link = '/einkathjalfun' where kind in ('pt', 'pt_feedback') and link is null;
update notifications set link = '/stjorn/idkendur' where kind = 'support' and link is null;

-- Ný 1 on 1 æfing → réttur dagur
create or replace function save_pt_workout(p_profile uuid, p_day date, p_components jsonb, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if jsonb_array_length(coalesce(p_components, '[]')) = 0 then
    delete from pt_workouts where profile_id = p_profile and day = p_day; return;
  end if;
  insert into pt_workouts (profile_id, day, components, status, updated_by, updated_at)
  values (p_profile, p_day, p_components, p_status, me(), now())
  on conflict (profile_id, day) do update set components = excluded.components, status = excluded.status, updated_by = excluded.updated_by, updated_at = now();
  if p_status = 'published' then
    insert into notifications (profile_id, title, body, kind, link)
    select p_profile, 'Ný 1 on 1 æfing', 'Æfing fyrir ' || to_char(p_day, 'DD.MM.') || ' er komin í appið.', 'pt', '/einkathjalfun?d=' || p_day
    where not exists (select 1 from notifications n where n.profile_id = p_profile and n.kind = 'pt' and n.created_at > now() - interval '10 minutes');
  end if;
end $$;
