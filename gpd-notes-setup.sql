-- ============================================================
-- Наш 1 «Г» — пометки по детям: кто ходит в ГПД + свободные заметки.
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно —
-- данные не задублируются и ваши правки не затрутся.
-- ============================================================

-- Таблица пометок: одна строка на ребёнка (ключ — имя, как в таблице сборов)
create table if not exists child_notes (
  id uuid primary key default gen_random_uuid(),
  child text not null unique,
  gpd boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now()
);

-- Права: читать могут все, менять — только вошедшие (комитет)
alter table child_notes enable row level security;

drop policy if exists "child_notes read" on child_notes;
create policy "child_notes read" on child_notes for select using (true);
drop policy if exists "child_notes write" on child_notes;
create policy "child_notes write" on child_notes for all to authenticated using (true) with check (true);

-- Начальные данные: 27 детей класса. В ГПД ходят 24 —
-- все, кроме Дорошенко Арины, Сиссауи Мохаммеда и Тылецкого Андрея
-- (у них нет списания ГПД в таблице класса).
-- on conflict do nothing — повторный запуск не затрёт ваши правки.
insert into child_notes (child, gpd) values
  ('Белоус Ольга',       true),
  ('Богдан Давид',       true),
  ('Богдан Ульяна',      true),
  ('Гладкая Карина',     true),
  ('Горлинская Алёна',   true),
  ('Гурецкий Роман',     true),
  ('Дашкевич Варвара',   true),
  ('Дехтяр Илья',        true),
  ('Домашевич Милана',   true),
  ('Дорошенко Арина',    false),
  ('Казнадей Анна',      true),
  ('Кашуба Тимур',       true),
  ('Кнотько София',      true),
  ('Коваленков Тимофей', true),
  ('Лаппо Егор',         true),
  ('Левко Арина',        true),
  ('Литош Кирилл',       true),
  ('Милишкевич Ева',     true),
  ('Савчук Доминик',     true),
  ('Стасько Павел',      true),
  ('Сиссауи Мохаммед',   false),
  ('Сухабок Артём',      true),
  ('Талако Алиса',       true),
  ('Тылецкий Андрей',    false),
  ('Шилкин Артём',       true),
  ('Шило Тимофей',       true),
  ('Шурова Агата',       true)
on conflict (child) do nothing;
