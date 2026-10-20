-- ============================================================
-- Наш 1 «Г» — даты в календаре класса (октябрь–ноябрь 2026).
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Выполняется один раз:
-- повторный запуск ничего не задвоит.
--
-- Что делает:
--   1) Добавляет в календарь колонку end_date — чтобы каникулы
--      занимали ДИАПАЗОН дат, а не один день.
--   2) Ставит осенние каникулы: со 2 по 6 ноября 2026.
--   3) Добавляет событие «Родительское собрание» —
--      22 октября 2026, 18:00, кабинет 160.
-- ============================================================

-- 1) Диапазоны дат для каникул (пусто = обычная запись на один день)
alter table class_holidays add column if not exists end_date date;

-- 2) Осенние каникулы: со 2 по 6 ноября 2026
update class_holidays
set on_date    = '2026-11-02',
    end_date   = '2026-11-06',
    note       = null,
    updated_at = now()
where title = 'Осенние каникулы';

-- Если строки «Осенние каникулы» почему-то нет — создаём
insert into class_holidays (title, on_date, end_date, kind, emoji)
select 'Осенние каникулы', '2026-11-02', '2026-11-06', 'vacation', '🍂'
where not exists (select 1 from class_holidays where title = 'Осенние каникулы');

-- 3) Родительское собрание 22 октября 2026 в 18:00, кабинет 160
insert into class_events (title, on_date, time_text, place, author)
select 'Родительское собрание', '2026-10-22', '18:00', 'кабинет 160', 'Комитет'
where not exists (
  select 1 from class_events
  where title = 'Родительское собрание' and on_date = '2026-10-22'
);

-- Проверка
select 'каникулы' as "Что", title as "Название",
       to_char(on_date, 'DD.MM.YYYY') || ' – ' || to_char(end_date, 'DD.MM.YYYY') as "Даты"
from class_holidays where title = 'Осенние каникулы'
union all
select 'собрание', title, to_char(on_date, 'DD.MM.YYYY') || ' в ' || time_text
from class_events where title = 'Родительское собрание' and on_date = '2026-10-22';
