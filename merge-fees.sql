-- ОБЪЕДИНЁННЫЙ СБОР: приводим базу в порядок после отказа от карточки «Сбор 150 руб».
-- Что делает файл:
--  1. Если по «Сбору 150» уже вносились платежи (таблица campaign_payments) —
--     переносит их в общую колонку «Взнос» (fee_values), записывает в журнал и удаляет,
--     чтобы касса на главной не посчитала деньги дважды.
--  2. Ставит Дашкевич Варваре взнос ровно 170,00 (было ошибочно 70: правильно 50 + 120 сегодня).
--  3. Показывает контрольную таблицу: ребёнок, взнос, осталось до 200.
-- Запускать целиком в Supabase → SQL Editor → Run. Повторный запуск не навредит.

do $$
declare
  paid_col uuid;
  dash_row uuid;
  p record;
  cur numeric;
begin
  -- колонка «Взнос» (первая колонка типа paid)
  select id into paid_col from public.fee_columns where kind = 'paid' order by sort limit 1;
  if paid_col is null then
    raise exception 'Не найдена колонка взносов (fee_columns, kind=paid)';
  end if;

  -- 1) переносим платежи по кампаниям (если они были) в общий взнос
  if to_regclass('public.campaign_payments') is not null then
    for p in select child, sum(amount) as amt from public.campaign_payments group by child loop
      select fv.amount into cur
        from public.fee_values fv
        join public.fee_rows fr on fr.id = fv.row_id
       where fr.child = p.child and fv.column_id = paid_col;
      cur := coalesce(cur, 0);

      update public.fee_values fv
         set amount = cur + p.amt
        from public.fee_rows fr
       where fr.id = fv.row_id and fr.child = p.child and fv.column_id = paid_col;

      insert into public.fee_edits_log (target, child, field, old_amount, new_amount, editor)
      values ('Взносы 2026–2027', p.child, 'Взнос (перенос платежей сбора 150)', cur, cur + p.amt, 'Комитет');
    end loop;
    delete from public.campaign_payments;
  end if;

  -- 2) Дашкевич Варвара: взнос ровно 170,00
  select id into dash_row from public.fee_rows where child like 'Дашкевич%' limit 1;
  if dash_row is null then
    raise exception 'Не найдена строка Дашкевич в fee_rows';
  end if;

  select amount into cur from public.fee_values where row_id = dash_row and column_id = paid_col;
  cur := coalesce(cur, 0);

  if cur <> 170 then
    insert into public.fee_values (row_id, column_id, amount, note)
    values (dash_row, paid_col, 170, 'исправление: 50 + 120 (16.09.2026)')
    on conflict (row_id, column_id)
    do update set amount = 170, note = 'исправление: 50 + 120 (16.09.2026)';

    insert into public.fee_edits_log (target, child, field, old_amount, new_amount, editor)
    values ('Взносы 2026–2027', 'Дашкевич Варвара', 'Взнос (исправление: 50 + 120)', cur, 170, 'Кристина');
  end if;
end $$;

-- 3) Контроль: взнос каждого ребёнка и сколько осталось до 200
select fr.n as "№", fr.child as "Ребёнок",
       coalesce(fv.amount, 0) as "Взнос",
       greatest(0, 200 - coalesce(fv.amount, 0)) as "Осталось до 200"
  from public.fee_rows fr
  left join public.fee_values fv
    on fv.row_id = fr.id
   and fv.column_id = (select id from public.fee_columns where kind = 'paid' order by sort limit 1)
 order by fr.n;
