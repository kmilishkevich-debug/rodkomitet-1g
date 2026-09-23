-- ============================================================
-- Наш 1 «Г» — кабинет классного руководителя (23.09.2026)
--
-- Что делает файл:
--   1) Создаёт таблицу homework — домашнее задание и «что взять завтра».
--   2) Создаёт таблицу class_events — события класса (поездки, праздники,
--      собрания, фотосессии).
--   3) Добавляет в family_notes колонку from_teacher — чтобы заметка
--      от учителя попадала родителю в отдельный раздел «От учителя»,
--      а не смешивалась с напоминаниями комитета.
--   4) Открывает доступ по общей модели приложения: читают все,
--      пишут вошедшие (комитет и учитель).
--   5) Подключает новые таблицы к мгновенным обновлениям (Realtime).
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
--
-- ВАЖНО: сначала должен быть запущен schedule-updates-setup.sql
-- (в нём создаётся таблица user_roles) и family-notes-setup.sql.
-- ============================================================


-- ============================================================
-- ШАГ 1. ЗАВОДИМ АККАУНТ УЧИТЕЛЮ (делается руками, до запуска SQL)
-- ============================================================
--
-- 1. Откройте https://supabase.com → проект rodkomitet-1g.
-- 2. Слева в меню: Authentication → Users.
-- 3. Нажмите зелёную кнопку «Add user» → «Create new user».
-- 4. Заполните:
--      Email:    uchitel227@gmail.com     (любая рабочая почта учителя)
--      Password: придумайте пароль, минимум 8 символов
--      Auto Confirm User: ВКЛЮЧИТЬ (галочка) — иначе учитель
--                         не сможет войти, пока не подтвердит почту
-- 5. Нажмите «Create user».
-- 6. Почту и пароль передайте учителю. Менять пароль он может
--    только через вас — самостоятельного восстановления в приложении нет.
--
-- После этого возвращайтесь сюда и запускайте весь файл целиком.


-- ============================================================
-- ШАГ 2. ВЫДАЁМ АККАУНТУ РОЛЬ «УЧИТЕЛЬ»
-- ============================================================
-- ВНИМАНИЕ: замените почту ниже на ту, которую завели в Шаге 1,
-- и при необходимости поправьте имя учителя.

insert into user_roles (user_id, role, display_name)
select id, 'teacher', 'Головко В. П.'
from auth.users
where email = 'uchitel227@gmail.com'
on conflict (user_id) do update
  set role = 'teacher', display_name = excluded.display_name;


-- ============================================================
-- ШАГ 3. ДОМАШНЕЕ ЗАДАНИЕ
-- ============================================================
create table if not exists homework (
  id          uuid primary key default gen_random_uuid(),
  on_date     date not null,            -- на какое число задано
  subject     text,                     -- предмет (пусто = общее «на завтра»)
  text        text not null,            -- само задание
  bring       text,                     -- что принести (краски, форма, 2 рубля…)
  author      text,                     -- кто записал (имя учителя)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index if not exists homework_date_idx on homework (on_date);

alter table homework enable row level security;

drop policy if exists "homework read"  on homework;
drop policy if exists "homework write" on homework;

-- читают все (родители заходят без пароля, по семейному коду)
create policy "homework read"  on homework for select to anon, authenticated using (true);
-- пишут только вошедшие по почте и паролю — комитет и учитель
create policy "homework write" on homework for all to authenticated using (true) with check (true);


-- ============================================================
-- ШАГ 4. СОБЫТИЯ КЛАССА
-- ============================================================
create table if not exists class_events (
  id          uuid primary key default gen_random_uuid(),
  on_date     date not null,            -- дата события
  time_text   text,                     -- время словами: «в 10:00», «после 3 урока»
  title       text not null,            -- название: «Поездка в зоопарк»
  place       text,                     -- где собираемся
  note        text,                     -- что взять, на что обратить внимание
  author      text,                     -- кто добавил
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index if not exists class_events_date_idx on class_events (on_date);

alter table class_events enable row level security;

drop policy if exists "events read"  on class_events;
drop policy if exists "events write" on class_events;

create policy "events read"  on class_events for select to anon, authenticated using (true);
create policy "events write" on class_events for all to authenticated using (true) with check (true);


-- ============================================================
-- ШАГ 5. ПОМЕТКА «ЗАМЕТКА ОТ УЧИТЕЛЯ»
-- ============================================================
-- Заметки от учителя показываются родителю в отдельной карточке
-- «От учителя», а не вместе с напоминаниями комитета.
alter table family_notes
  add column if not exists from_teacher boolean not null default false;


-- ============================================================
-- ШАГ 6. МГНОВЕННЫЕ ОБНОВЛЕНИЯ (REALTIME)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'homework'
  ) then
    alter publication supabase_realtime add table public.homework;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'class_events'
  ) then
    alter publication supabase_realtime add table public.class_events;
  end if;
end $$;


-- ПРОВЕРКА -----------------------------------------------------------------
-- Должно быть: учителей 1, заданий 0, событий 0.
-- Если учителей 0 — значит в Шаге 2 почта не совпала с почтой аккаунта.
select
  (select count(*) from user_roles where role = 'teacher') as "Учителей",
  (select count(*) from homework)                          as "Заданий",
  (select count(*) from class_events)                      as "Событий";
