-- ============================================================
-- Наш 1 «Г» — живой список фонда ГПД (редактируется с телефона).
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно —
-- данные не задублируются.
-- ============================================================

-- ЧАСТЬ 1. ДЕТИ ФОНДА ГПД -----------------------------------------------------
-- Свой список (отличается от списка класса). Комитет может добавлять
-- новые фамилии и удалять ненужные прямо в приложении.
-- paid — сколько сдал ребёнок в фонд (взнос 25 BYN).

create table if not exists gpd_fund_children (
  id uuid primary key default gen_random_uuid(),
  child text not null,
  paid numeric not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ЧАСТЬ 2. ПРАВА ДОСТУПА ------------------------------------------------------
-- Читать могут все (родители видят всё — прозрачность),
-- менять — только вошедшие (комитет).

alter table gpd_fund_children enable row level security;

drop policy if exists "gpd_fund_children read" on gpd_fund_children;
create policy "gpd_fund_children read" on gpd_fund_children for select using (true);
drop policy if exists "gpd_fund_children write" on gpd_fund_children;
create policy "gpd_fund_children write" on gpd_fund_children for all to authenticated using (true) with check (true);

-- ЧАСТЬ 3. СТАРТОВЫЕ ДАННЫЕ ---------------------------------------------------
-- Текущие 27 детей из ведомости. Взнос 25 BYN у всех,
-- Дашкевич Варвара пока не сдала (0). После запуска ненужных
-- можно удалить, а новых добавить прямо в приложении.

insert into gpd_fund_children (child, paid, sort)
select * from (values
  ('Белоус Ольга',       25, 1),
  ('Богдан Давид',       25, 2),
  ('Богдан Ульяна',      25, 3),
  ('Гладкая Карина',     25, 4),
  ('Горлинская Алёна',   25, 5),
  ('Гурецкий Роман',     25, 6),
  ('Дашкевич Варвара',    0, 7),
  ('Дехтяр Илья',        25, 8),
  ('Домашевич Милана',   25, 9),
  ('Казнадей Анна',      25, 10),
  ('Кашуба Тимур',       25, 11),
  ('Кнотько София',      25, 12),
  ('Коваленков Тимофей', 25, 13),
  ('Лаппо Егор',         25, 14),
  ('Левко Арина',        25, 15),
  ('Литош Кирилл',       25, 16),
  ('Милишкевич Ева',     25, 17),
  ('Савчук Доминик',     25, 18),
  ('Стасько Павел',      25, 19),
  ('Сухабок Артём',      25, 20),
  ('Талако Алиса',       25, 21),
  ('Шилкин Артём',       25, 22),
  ('Шило Тимофей',       25, 23),
  ('Шурова Агата',       25, 24),
  ('Янкевич Егор',       25, 25),
  ('Лапицкий Никита',    25, 26),
  ('Точёнова Вера',      25, 27)
) as seed(child, paid, sort)
where not exists (select 1 from gpd_fund_children);

-- Готово! Проверка: должно быть 27 детей и собрано 650.
select
  (select count(*) from gpd_fund_children) as "детей в фонде ГПД",
  (select coalesce(sum(paid), 0) from gpd_fund_children) as "собрано, BYN";
