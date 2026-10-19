-- ============================================================
-- Наш 1 «Г» — календарь предстоящих праздников на «Главной».
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Выполняется один раз:
-- повторный запуск ничего не задвоит.
--
-- Что делает:
--   1) Создаёт таблицу class_holidays — праздники, каникулы
--      и памятные даты (события класса в календарь подтягиваются
--      из уже существующей таблицы class_events).
--   2) Включает чтение всем, запись — комитету и учителю
--      (вход по коду, authenticated).
--   3) Добавляет стартовый набор: известные праздники с датами
--      и каникулы ПОКА БЕЗ ДАТ — даты каникул добавите сами
--      прямо в приложении (карандашик у строки).
-- ============================================================

create table if not exists class_holidays (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,             -- «Новый год», «Осенние каникулы»
  on_date     date,                      -- NULL = «даты уточняются» (каникулы)
  kind        text not null default 'holiday', -- holiday | vacation
  emoji       text,                      -- своя иконка; пусто = по типу
  note        text,                      -- короткая заметка («утренник в 10:00»)
  fee_link    boolean not null default false, -- true = показать кнопку «К сбору»
  author      text,                      -- кто добавил
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index if not exists class_holidays_date_idx on class_holidays (on_date);

alter table class_holidays enable row level security;

drop policy if exists "holidays read"  on class_holidays;
drop policy if exists "holidays write" on class_holidays;

create policy "holidays read"  on class_holidays for select to anon, authenticated using (true);
create policy "holidays write" on class_holidays for all to authenticated using (true) with check (true);

-- Мгновенное обновление у всех открытых телефонов
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'class_holidays'
  ) then
    alter publication supabase_realtime add table public.class_holidays;
  end if;
end $$;

-- Стартовый набор — добавляется только если таблица пустая
do $$
begin
  if exists (select 1 from class_holidays) then
    raise notice 'Календарь уже заполнен — стартовый набор не добавляю';
    return;
  end if;

  insert into class_holidays (title, on_date, kind, emoji, note) values
    ('Осенние каникулы',  null,         'vacation', '🍂', 'Даты уточняются'),
    ('Новый год',         '2027-01-01', 'holiday',  '🎄', null),
    ('Зимние каникулы',   null,         'vacation', '⛄', 'Даты уточняются'),
    ('Рождество',         '2027-01-07', 'holiday',  '✨', null),
    ('День защитника Отечества', '2027-02-23', 'holiday', '🎖️', null),
    ('8 Марта',           '2027-03-08', 'holiday',  '🌷', null),
    ('Весенние каникулы', null,         'vacation', '🌱', 'Даты уточняются'),
    ('День Победы',       '2027-05-09', 'holiday',  '🕊️', null),
    ('Последний звонок',  null,         'holiday',  '🔔', 'Конец мая, дата уточняется'),
    ('Летние каникулы',   null,         'vacation', '☀️', 'Даты уточняются');
end $$;

-- Проверка
select count(*) as "Записей в календаре" from class_holidays;
