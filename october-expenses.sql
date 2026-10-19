-- ============================================================
-- Наш 1 «Г» — октябрьские траты (95,23 BYN) в раздел «Расходы».
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Выполняется один раз:
-- повторный запуск ничего не задвоит.
-- Группа называется «Хозяйственные нужды (октябрь)» — слово
-- «Хозяйственные» в названии автоматически включает эти траты
-- в статью «хознужды» ведомости взносов.
-- ============================================================

do $$
declare
  g_oct uuid;
  max_sort int;
begin
  -- Если группа уже есть — второй раз не создаём и ничего не добавляем
  select id into g_oct from expense_groups where title = 'Хозяйственные нужды (октябрь)';
  if g_oct is not null then
    raise notice 'Группа октября уже есть — ничего не добавляю';
    return;
  end if;

  select coalesce(max(sort), 0) + 1 into max_sort from expense_groups;
  insert into expense_groups (title, sort)
  values ('Хозяйственные нужды (октябрь)', max_sort)
  returning id into g_oct;

  insert into expenses (group_id, name, price, qty, sum, place, purchased_at) values
    (g_oct, 'Жилеты светоотражающие', 2.23, '27', 60.24, 'Озон', '2026-10-01'),
    (g_oct, 'Влажные салфетки', 34.99, 'уп.', 34.99, 'Emall', '2026-10-01');
end $$;
