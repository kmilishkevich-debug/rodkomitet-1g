-- ============================================================
-- Наш 1 «Г» — исправление сумм по сверке с Google-таблицей
-- «1 "Г" отчет 26/27» (лист «Сборы 2026/27»), 22.09.2026.
--
-- Что делает файл:
--   1) Взносы шести детей приводит к таблице.
--   2) «Хоз. нужды» у всех 27 обновляет 37,52 → 44,86 (1211,32 / 27).
--   3) «ГПД» у 24 детей обновляет 7,02 → 13,01 (312,30 / 24);
--      у Дорошенко, Сиссауи и Тылецкого ГПД как не было, так и нет.
--   4) Заполняет пустые «Гардероб» 7,35 (198,45 / 27)
--      и «Рабочие тетради» 46,30 (1250,10 / 27) у всех 27 детей.
--   Бейджи, подарки и значки уже верны — их файл не трогает.
--
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- В конце выведется проверка: собрано 5312.20, остаток 1209.58.
-- ============================================================

do $$
declare
  c_paid uuid; c_hoz uuid; c_ward uuid; c_gpd uuid; c_books uuid; c_gifts uuid;
begin
  select id into c_paid  from fee_columns where title = 'Взнос' limit 1;
  select id into c_gifts from fee_columns where title = 'Подарки (сентябрь)' limit 1;
  select id into c_hoz   from fee_columns where title = 'Хоз. нужды' limit 1;
  select id into c_ward  from fee_columns where title = 'Гардероб' limit 1;
  select id into c_gpd   from fee_columns where title = 'ГПД' limit 1;
  select id into c_books from fee_columns where title = 'Рабочие тетради' limit 1;

  if c_paid is null or c_hoz is null or c_ward is null
     or c_gpd is null or c_books is null then
    raise exception 'Не найдены статьи сборов — проверьте названия колонок';
  end if;

  -- 1. ВЗНОСЫ ШЕСТИ ДЕТЕЙ ----------------------------------------------------
  update fee_values v set amount = x.amount
  from (values
    ('Дашкевич Варвара',  190.00),
    ('Домашевич Милана',  206.30),
    ('Дорошенко Арина',   175.00),
    ('Коваленков Тимофей',200.00),
    ('Литош Кирилл',      175.00),
    ('Сиссауи Мохаммед',  175.80)
  ) as x(child, amount)
  join fee_rows r on r.child = x.child
  where v.row_id = r.id and v.column_id = c_paid;

  -- 2. ХОЗ. НУЖДЫ: точная доля 1211,32 / 27 у всех 27 ------------------------
  update fee_values set amount = 1211.32 / 27
  where column_id = c_hoz;

  -- 2а. ПОДАРКИ: точная доля 921,85 / 27 (на экране те же 34,14,
  --     но без потери 7 копеек на округлении)
  if c_gifts is not null then
    update fee_values set amount = 921.85 / 27
    where column_id = c_gifts;
  end if;

  -- 3. ГПД: точная доля 312,30 / 24 — только там, где ГПД уже есть -----------
  -- (у Дорошенко, Сиссауи и Тылецкого записи ГПД нет — так и должно быть)
  update fee_values set amount = 312.30 / 24
  where column_id = c_gpd;

  -- 4. ГАРДЕРОБ 198,45 / 27 и РАБОЧИЕ ТЕТРАДИ 1250,10 / 27 у всех 27 ---------
  insert into fee_values (row_id, column_id, amount)
  select r.id, c_ward, 198.45 / 27 from fee_rows r
  on conflict (row_id, column_id) do update set amount = excluded.amount;

  insert into fee_values (row_id, column_id, amount)
  select r.id, c_books, 1250.10 / 27 from fee_rows r
  on conflict (row_id, column_id) do update set amount = excluded.amount;
end $$;

-- ПРОВЕРКА: должно быть собрано 5312.20 и общий остаток 1209.58 --------------
select
  round(sum(v.amount) filter (where c.kind = 'paid'), 2)   as "собрано",
  round(sum(v.amount) filter (where c.kind = 'paid')
      - sum(v.amount) filter (where c.kind = 'charge'), 2) as "остаток на детях"
from fee_values v
join fee_columns c on c.id = v.column_id;
