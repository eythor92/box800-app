-- =====================================================================
-- BOX800 – Parahreysti fellur út. Laugardagstímarnir verða venjulegt Hreysti.
-- Fjöldi í tíma helst óbreyttur (16), honum má breyta í Dagatal og fjöldi.
-- Má keyra aftur án skaða.
-- =====================================================================
do $$
declare para int; hrey int; para_cap int;
begin
  select id, default_cap into para, para_cap from programs where name = 'Parahreysti';
  select id into hrey from programs where name = 'Hreysti';
  if para is null or hrey is null then return; end if;

  -- Fastir tímar (laugardagar) og stakir tímar
  update class_slots set program_id = hrey, cap = coalesce(cap, para_cap) where program_id = para;
  update classes set program_id = hrey, cap = coalesce(cap, para_cap) where program_id = para;

  -- Æfingar: færa á Hreysti ef sá dagur er laus, annars eyða Parahreysti-æfingunni
  update workouts w set program_id = hrey
  where w.program_id = para and not exists (select 1 from workouts x where x.program_id = hrey and x.day = w.day);
  delete from workouts where program_id = para;

  -- Taka námskeiðið út (eða fela ef eitthvað vísar enn á það)
  begin
    delete from programs where id = para;
  exception when foreign_key_violation then
    update programs set active = false where id = para;
  end;
end $$;
