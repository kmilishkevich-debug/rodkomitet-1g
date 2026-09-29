-- ============================================================
-- Наш 1 «Г» — точечные правки ведомости взносов (сентябрь 2026).
-- 1) Шурова Агата: взнос 199,80 → 200,00 (убираем «осталось сдать 0,20»).
-- 2) Не ходящим в ГПД (Дорошенко Арина, Сиссауи Мохаммед, Тылецкий Андрей)
--    проставляем явный 0 в статье «ГПД», чтобы норма взноса была 175 BYN
--    и не показывалось «осталось сдать 25».
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно.
-- ============================================================

-- 1. Шурова Агата: 199,80 → 200,00 (только если сумма ещё старая)
update fee_values v
set amount = 200
from fee_rows r, fee_columns c
where v.row_id = r.id and v.column_id = c.id
  and r.child = 'Шурова Агата' and c.kind = 'paid' and v.amount = 199.8;

-- 2. Явный 0 в статье «ГПД» у не ходящих
insert into fee_values (row_id, column_id, amount)
select r.id, c.id, 0
from fee_rows r
cross join fee_columns c
where c.kind = 'charge' and c.title ilike '%гпд%'
  and r.child in ('Дорошенко Арина', 'Сиссауи Мохаммед', 'Тылецкий Андрей')
on conflict (row_id, column_id) do update set amount = 0;

-- Проверка: у троих в «ГПД» должен быть 0, у Шуровой взнос 200
select r.child, c.title, v.amount
from fee_values v
join fee_rows r on r.id = v.row_id
join fee_columns c on c.id = v.column_id
where (c.title ilike '%гпд%' and r.child in ('Дорошенко Арина', 'Сиссауи Мохаммед', 'Тылецкий Андрей'))
   or (c.kind = 'paid' and r.child = 'Шурова Агата')
order by r.child;
