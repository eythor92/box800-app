-- =====================================================================
-- BOX800 – einkaþjálfun (1 on 1): æfingar fyrir einn iðkanda.
-- Iðkandi með áskrift sem heitir „Einkaþjálfun …“ fær flipann „1 on 1“ í appinu.
-- Eigandi/þjálfari skrifar æfingarnar á prófíl iðkandans.
-- Keyrt á eftir 018. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists pt_workouts (
  id          bigserial primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  day         date not null,
  components  jsonb not null default '[]',
  status      text not null default 'draft' check (status in ('draft', 'published')),
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (profile_id, day)
);

alter table pt_workouts enable row level security;
drop policy if exists p_pt_read on pt_workouts;
create policy p_pt_read on pt_workouts for select to authenticated
  using (is_staff() or (status = 'published' and profile_id in (select id from profiles where id = me() or guardian_id = me())));
drop policy if exists p_pt_write on pt_workouts;
create policy p_pt_write on pt_workouts for all to authenticated using (is_staff()) with check (is_staff());

-- Er iðkandi með virka einkaþjálfun?
create or replace function has_pt(p_profile uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.profile_id = coalesce(p_profile, me()) and m.status = 'active'
      and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and m.plan ilike '%einkaþjálfun%'
  ) and (p_profile is null or p_profile = me() or is_staff())
$$;
revoke execute on function has_pt(uuid) from public, anon;
grant execute on function has_pt(uuid) to authenticated;

-- Vista æfingu (eigandi/þjálfari)
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
  -- Láta iðkandann vita þegar ný æfing er birt
  if p_status = 'published' then
    insert into notifications (profile_id, title, body, kind)
    select p_profile, 'Ný 1 on 1 æfing', 'Æfing fyrir ' || to_char(p_day, 'DD.MM.') || ' er komin í appið.', 'pt'
    where not exists (select 1 from notifications n where n.profile_id = p_profile and n.kind = 'pt' and n.created_at > now() - interval '10 minutes');
  end if;
end $$;
revoke execute on function save_pt_workout(uuid, date, jsonb, text) from public, anon;
grant execute on function save_pt_workout(uuid, date, jsonb, text) to authenticated;
