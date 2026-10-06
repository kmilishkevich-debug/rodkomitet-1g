-- ============================================================
-- Наш 1 «Г» — отсутствия детей (06.10.2026)
--
-- Что делает файл:
--   1) Создаёт таблицу absences: родитель отмечает, что ребёнка
--      не будет в школе — с датами, причиной и типом документа
--      (справка или заявление). Болезнь можно отметить без
--      конечной даты («болеем, пока не выйдем») — тогда date_to
--      пустая, а при выходе в школу родитель нажимает «Вышли».
--   2) Открывает доступ по общей модели приложения (как у
--      заметок семей): читать и писать может любой вошедший.
--      Приватность (семья видит только свои записи, учитель — все)
--      обеспечивается на уровне приложения.
--   3) Подключает таблицу к мгновенным обновлениям (Realtime),
--      чтобы отметка родителя сразу появлялась у учителя.
--
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- В конце выведется проверка: таблица и число записей в ней.
-- ============================================================

-- 1. Таблица отсутствий
create table if not exists absences (
  id           uuid primary key default gen_random_uuid(),
  family_n     int not null,             -- номер ребёнка из списка класса (1–27)
  child        text not null,            -- фамилия и имя ребёнка (для сводки учителя)
  date_from    date not null,            -- первый день отсутствия
  date_to      date,                     -- последний день (пусто = «болеем, пока не выйдем»)
  reason       text not null,            -- illness | family | doctor | competition | other
  reason_note  text,                     -- пояснение (для «другое» или по желанию)
  doc_type     text not null,            -- spravka (справка) | zayavlenie (заявление)
  doc_done     boolean not null default false,  -- документ передан в школу
  doc_done_at  timestamptz,              -- когда отметили «передали»
  created_at   timestamptz not null default now()
);

create index if not exists absences_family_idx on absences (family_n);
create index if not exists absences_dates_idx  on absences (date_from, date_to);

-- 2. Доступ — по общей модели приложения (как family_notes)
alter table absences enable row level security;

drop policy if exists "absences read all"   on absences;
drop policy if exists "absences insert all" on absences;
drop policy if exists "absences update all" on absences;
drop policy if exists "absences delete all" on absences;

create policy "absences read all"   on absences for select to anon, authenticated using (true);
create policy "absences insert all" on absences for insert to anon, authenticated with check (true);
create policy "absences update all" on absences for update to anon, authenticated using (true);
create policy "absences delete all" on absences for delete to anon, authenticated using (true);

-- 3. Мгновенные обновления (Realtime)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'absences'
  ) then
    alter publication supabase_realtime add table public.absences;
  end if;
end $$;

-- ПРОВЕРКА: таблица создана, записей пока 0 --------------------------------
select 'absences' as "Таблица", count(*) as "Записей" from absences;
