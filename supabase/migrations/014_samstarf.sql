-- =====================================================================
-- BOX800 – samstarf: lítil kynning frá samstarfsaðila á forsíðu
-- (merki, texti, afsláttarkóði, hlekkur). Eigandi velur hverjir sjá:
-- allir með aðgang, eða aðeins þau sem eru með áskrift sem heitir t.d. „Mömmuhreysti“.
-- Keyrt á eftir 013. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists promos (
  id            bigserial primary key,
  partner       text not null,
  title         text not null,
  body          text,
  code          text,
  url           text,
  logo_url      text,
  audience_plan text,               -- null = allir með aðgang; annars hluti af nafni áskriftar
  starts_on     date not null default current_date,
  ends_on       date,
  active        boolean not null default true,
  clicks        int not null default 0,
  copies        int not null default 0,
  created_at    timestamptz not null default now()
);

alter table promos enable row level security;
drop policy if exists p_promos_owner on promos;
create policy p_promos_owner on promos for all to authenticated using (is_owner()) with check (is_owner());

-- Kynningar sem innskráður iðkandi á að sjá núna
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
        and m.plan ilike '%' || trim(p.audience_plan) || '%'))
  order by p.created_at desc
$$;
revoke execute on function my_promos() from public, anon;
grant execute on function my_promos() to authenticated;

-- Telja smelli á hlekk eða afritun á kóða
create or replace function promo_event(p_id bigint, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from my_promos() x where x.id = p_id) then return; end if;
  update promos set clicks = clicks + (p_kind = 'click')::int, copies = copies + (p_kind = 'copy')::int where id = p_id;
end $$;
revoke execute on function promo_event(bigint, text) from public, anon;
grant execute on function promo_event(bigint, text) to authenticated;

-- Hversu margir sjá kynninguna (fyrir eiganda)
create or replace function promo_reach(p_plan text) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct pr.id)::int from profiles pr
  where is_owner() and exists (
    select 1 from memberships m where m.profile_id = pr.id
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and (coalesce(trim(p_plan), '') = '' or m.plan ilike '%' || trim(p_plan) || '%'))
$$;
revoke execute on function promo_reach(text) from public, anon;
grant execute on function promo_reach(text) to authenticated;
