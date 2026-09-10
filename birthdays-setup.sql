-- ============================================================
-- Наш 1 «Г» — дни рождения детей (27 семей).
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ этот файл → Run. Выполняется один раз.
-- ============================================================

-- 1. Таблица дней рождения
create table if not exists birthdays (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  born date not null,
  created_at timestamptz not null default now(),
  unique (first_name, last_name)
);

-- 2. Права: читать могут все, менять — только вошедшие (комитет)
alter table birthdays enable row level security;

drop policy if exists "birthdays read" on birthdays;
create policy "birthdays read" on birthdays for select using (true);
drop policy if exists "birthdays write" on birthdays;
create policy "birthdays write" on birthdays for all to authenticated using (true) with check (true);

-- 3. Все 27 детей (из общей таблицы класса)
insert into birthdays (first_name, last_name, born) values
  ('Ольга',    'Белоус',     '2019-10-27'),
  ('Давид',    'Богдан',     '2019-12-06'),
  ('Ульяна',   'Богдан',     '2019-12-06'),
  ('Карина',   'Гладкая',    '2020-05-19'),
  ('Алёна',    'Горлинская', '2019-12-10'),
  ('Роман',    'Гурецкий',   '2019-10-13'),
  ('Варвара',  'Дашкевич',   '2019-08-04'),
  ('Илья',     'Дехтяр',     '2019-12-13'),
  ('Милана',   'Домашевич',  '2019-10-19'),
  ('Арина',    'Дорошенко',  '2019-10-22'),
  ('Анна',     'Казнадей',   '2019-09-02'),
  ('Тимур',    'Кашуба',     '2020-05-04'),
  ('София',    'Кнотько',    '2019-12-12'),
  ('Тимофей',  'Коваленков', '2020-01-06'),
  ('Егор',     'Лаппо',      '2020-01-29'),
  ('Арина',    'Левко',      '2020-01-30'),
  ('Кирилл',   'Литош',      '2019-07-12'),
  ('Ева',      'Милишкевич', '2019-10-27'),
  ('Доминик',  'Савчук',     '2020-07-21'),
  ('Павел',    'Стасько',    '2019-11-10'),
  ('Мохаммед', 'Сиссауи',    '2019-03-21'),
  ('Артём',    'Сухабок',    '2020-01-02'),
  ('Алиса',    'Талако',     '2020-05-29'),
  ('Андрей',   'Тылецкий',   '2020-04-07'),
  ('Артём',    'Шилкин',     '2019-11-18'),
  ('Тимофей',  'Шило',       '2019-12-20'),
  ('Агата',    'Шурова',     '2020-02-13')
on conflict (first_name, last_name) do update set born = excluded.born;
