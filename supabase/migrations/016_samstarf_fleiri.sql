-- =====================================================================
-- BOX800 – samstarf: kynning getur miðað á fleiri en eina áskrift/námskeið.
-- audience_plan geymir nöfnin aðskilin með „|“ (t.d. „Mömmuhreysti 4 vikur|Mömmugrunnur 4 vikur“).
-- Keyrt á eftir 015. Má keyra aftur án skaða.
-- =====================================================================

create or replace function plan_matches(p_plan text, p_audience text) returns boolean
language sql immutable as $$
  select coalesce(trim(p_audience), '') = '' or exists (
    select 1 from unnest(string_to_array(p_audience, '|')) a
    where trim(a) <> '' and p_plan ilike '%' || trim(a) || '%')
$$;

create or replace function my_promos() returns table (
  id bigint, partner text, title text, body text, code text, url text, logo_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.partner, p.title, p.body, p.code, p.url, p.logo_url
  from promos p
  where p.active and p.starts_on <= current_date and (p.ends_on is null or p.ends_on >= current_date)
    and has_access()
    and (coalesce(trim(p.audience_plan), '') = '' or exists (
      select 1 from memberships m join profiles pr on pr.id = m.profile_id
      where (pr.id = me() or pr.guardian_id = me())
        and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
        and plan_matches(m.plan, p.audience_plan)))
  order by p.created_at desc
$$;

create or replace function promo_reach(p_plan text) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct pr.id)::int from profiles pr
  where is_owner() and exists (
    select 1 from memberships m where m.profile_id = pr.id
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and plan_matches(m.plan, p_plan))
$$;
