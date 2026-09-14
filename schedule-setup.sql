-- ============================================================
-- Наш 1 «Г» — расписание уроков (адаптационный период, 20 учебных дней).
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ этот файл → Run. Выполняется один раз.
-- ============================================================

-- 1. Звонки (время начала и конца каждого урока)
create table if not exists schedule_bells (
  pos int primary key,
  start_time text not null,
  end_time text not null
);

-- 2. Уроки: day 1=Пн … 5=Пт, pos — номер урока
create table if not exists schedule_lessons (
  id uuid primary key default gen_random_uuid(),
  day int not null check (day between 1 and 5),
  pos int not null check (pos between 1 and 8),
  subject text not null,
  note text,
  room text default '166',
  teacher text,
  created_at timestamptz not null default now(),
  unique (day, pos)
);

-- 3. Права: читать могут все, менять — только вошедшие (комитет)
alter table schedule_bells enable row level security;
alter table schedule_lessons enable row level security;

drop policy if exists "bells read" on schedule_bells;
create policy "bells read" on schedule_bells for select using (true);
drop policy if exists "bells write" on schedule_bells;
create policy "bells write" on schedule_bells for all to authenticated using (true) with check (true);

drop policy if exists "lessons read" on schedule_lessons;
create policy "lessons read" on schedule_lessons for select using (true);
drop policy if exists "lessons write" on schedule_lessons;
create policy "lessons write" on schedule_lessons for all to authenticated using (true) with check (true);

-- 4. Звонки
insert into schedule_bells (pos, start_time, end_time) values
  (1, '8:00', '8:35'),
  (2, '9:00', '9:35'),
  (3, '10:00', '10:35'),
  (4, '11:00', '11:35'),
  (5, '12:00', '12:35')
on conflict (pos) do update set start_time = excluded.start_time, end_time = excluded.end_time;

-- 5. Само расписание (обновлено 14.09.2026 по фото от классного руководителя).
-- Скрипт можно запускать повторно: старые уроки заменяются новыми.
-- Информационный час в четверге показывается приложением отдельной строкой
-- между 3-м и 4-м уроками — в таблицу его вносить не нужно.
do $$
begin
  delete from schedule_lessons;

  insert into schedule_lessons (day, pos, subject, note, room, teacher) values
    -- Понедельник
    (1, 1, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (1, 2, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (1, 3, 'Физическая культура и здоровье', 'Спортивная форма и обувь', '166', null),
    (1, 4, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (1, 5, 'Классный час', null, '166', 'Головко В. П.'),
    -- Вторник
    (2, 1, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (2, 2, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (2, 3, 'Физическая культура и здоровье', 'Спортивная форма и обувь', '166', null),
    (2, 4, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (2, 5, 'Факультатив «Элементы логики»', null, '166', 'Головко В. П.'),
    -- Среда
    (3, 1, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (3, 2, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (3, 3, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (3, 4, 'Музыка', null, '166', null),
    (3, 5, 'Поддерживающее занятие', null, '166', 'Головко В. П.'),
    -- Четверг (4 занятия, конец в 11:35; инфочас — отдельной строкой в приложении)
    (4, 1, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (4, 2, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (4, 3, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (4, 4, 'Факультатив «Вытокі роднай мовы»', null, '166', 'Головко В. П.'),
    -- Пятница
    (5, 1, 'Физическая культура и здоровье', 'Спортивная форма и обувь', '166', null),
    (5, 2, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (5, 3, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (5, 4, 'Введение в школьную жизнь', null, '166', 'Головко В. П.'),
    (5, 5, 'Поддерживающее занятие', null, '166', 'Головко В. П.');
end $$;
