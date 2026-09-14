-- ============================================================
-- Наш 1 «Г» — изменения расписания (замены, черновики, история, роль учителя).
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ этот файл → Run. Запускать можно повторно — не дублирует.
-- Важно: сначала должен быть запущен schedule-setup.sql (основное расписание).
-- ============================================================

-- 1. Замены расписания. Основное расписание (schedule_lessons) НЕ трогаем:
--    замены хранятся отдельно и действуют только в свой период,
--    после окончания периода расписание само возвращается к основному.
create table if not exists schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  kind text not null check (kind in ('date', 'period', 'permanent')),
  date_from date not null,          -- конкретная дата / начало периода / «постоянно с»
  date_to date,                     -- конец периода (null для date и permanent)
  changes jsonb not null default '[]'::jsonb,
  -- changes: [{ day, pos, action: 'replace'|'add'|'remove', subject, note, room, teacher }]
  comment text,                     -- комментарий для родителей (виден в баннере)
  source_text text,                 -- основание: текст сообщения учителя
  source_image text,                -- основание: ссылка на фото/скриншот
  author text,                      -- кто внёс (имя/почта)
  created_at timestamptz not null default now(),
  published_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text
);

-- 2. История: кто, когда и что сделал (создал черновик, опубликовал, отменил)
create table if not exists schedule_history (
  id uuid primary key default gen_random_uuid(),
  override_id uuid references schedule_overrides (id) on delete set null,
  action text not null,             -- 'draft' | 'published' | 'edited' | 'cancelled' | 'deleted_draft'
  actor text,
  details text,
  at timestamptz not null default now()
);

-- 3. Роли пользователей: у кого роль 'teacher' — доступ только к расписанию.
--    Заполняется вручную здесь же (см. пример внизу файла).
create table if not exists user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('committee', 'teacher')),
  display_name text
);

-- 4. Права: читать могут все (родители видят опубликованные замены),
--    менять — только вошедшие (комитет и учитель).
alter table schedule_overrides enable row level security;
alter table schedule_history enable row level security;
alter table user_roles enable row level security;

drop policy if exists "overrides read" on schedule_overrides;
create policy "overrides read" on schedule_overrides for select using (true);
drop policy if exists "overrides write" on schedule_overrides;
create policy "overrides write" on schedule_overrides for all to authenticated using (true) with check (true);

drop policy if exists "sched history read" on schedule_history;
create policy "sched history read" on schedule_history for select using (true);
drop policy if exists "sched history write" on schedule_history;
create policy "sched history write" on schedule_history for all to authenticated using (true) with check (true);

drop policy if exists "roles read" on user_roles;
create policy "roles read" on user_roles for select to authenticated using (true);
-- Роли меняются только здесь, в SQL Editor — политики записи нет намеренно.

-- 5. Как подключить учителя (после того как создадите ему аккаунт
--    в Authentication → Users, например uchitel@example.com):
--    раскомментируйте строки ниже, подставьте почту и запустите ещё раз.
--
-- insert into user_roles (user_id, role, display_name)
-- select id, 'teacher', 'Головко В. П.'
-- from auth.users where email = 'uchitel@example.com'
-- on conflict (user_id) do update set role = 'teacher', display_name = excluded.display_name;
