-- ============================================================
-- Наш 1 «Г» — сборы и взносы в базе + обновление расходов
-- по актуальной Google-таблице класса (сентябрь 2026).
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно —
-- данные не задублируются.
-- ============================================================

-- ЧАСТЬ 1. ТАБЛИЦЫ СБОРОВ ---------------------------------------------------

-- Статьи сборов (колонки таблицы). kind: 'paid' — сдано, 'charge' — списание
create table if not exists fee_columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'charge' check (kind in ('paid', 'charge')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Дети (строки таблицы сборов)
create table if not exists fee_rows (
  id uuid primary key default gen_random_uuid(),
  n int not null,
  child text not null,
  created_at timestamptz not null default now()
);

-- Суммы: ребёнок × статья. Остаток не храним — считается в приложении
create table if not exists fee_values (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references fee_rows(id) on delete cascade,
  column_id uuid not null references fee_columns(id) on delete cascade,
  amount numeric not null default 0,
  unique (row_id, column_id)
);

-- Права: читать могут все, менять — только вошедшие (комитет)
alter table fee_columns enable row level security;
alter table fee_rows enable row level security;
alter table fee_values enable row level security;

drop policy if exists "fee_columns read" on fee_columns;
create policy "fee_columns read" on fee_columns for select using (true);
drop policy if exists "fee_columns write" on fee_columns;
create policy "fee_columns write" on fee_columns for all to authenticated using (true) with check (true);

drop policy if exists "fee_rows read" on fee_rows;
create policy "fee_rows read" on fee_rows for select using (true);
drop policy if exists "fee_rows write" on fee_rows;
create policy "fee_rows write" on fee_rows for all to authenticated using (true) with check (true);

drop policy if exists "fee_values read" on fee_values;
create policy "fee_values read" on fee_values for select using (true);
drop policy if exists "fee_values write" on fee_values;
create policy "fee_values write" on fee_values for all to authenticated using (true) with check (true);

-- ЧАСТЬ 2. ДАННЫЕ СБОРОВ ПО 27 ДЕТЯМ (из таблицы класса) --------------------

do $$
declare
  c_paid uuid; c_hoz uuid; c_badge uuid; c_gifts uuid;
  c_ward uuid; c_magnets uuid; c_gpd uuid; c_books uuid;
  r uuid;
begin
  if exists (select 1 from fee_columns) then
    return; -- сборы уже перенесены, второй раз не дублируем
  end if;

  insert into fee_columns (title, kind, sort) values ('Взнос', 'paid', 1) returning id into c_paid;
  insert into fee_columns (title, kind, sort) values ('Хоз. нужды', 'charge', 2) returning id into c_hoz;
  insert into fee_columns (title, kind, sort) values ('Бейдж', 'charge', 3) returning id into c_badge;
  insert into fee_columns (title, kind, sort) values ('Подарки (сентябрь)', 'charge', 4) returning id into c_gifts;
  insert into fee_columns (title, kind, sort) values ('Гардероб', 'charge', 5) returning id into c_ward;
  insert into fee_columns (title, kind, sort) values ('Магнитные значки', 'charge', 6) returning id into c_magnets;
  insert into fee_columns (title, kind, sort) values ('ГПД', 'charge', 7) returning id into c_gpd;
  insert into fee_columns (title, kind, sort) values ('Рабочие тетради', 'charge', 8) returning id into c_books;

  -- Вспомогательная вставка: ребёнок + взнос + стандартные списания.
  -- badge_amt/magnets_amt/gpd_amt позволяют задать исключения.

  -- 1. Белоус Ольга
  insert into fee_rows (n, child) values (1, 'Белоус Ольга') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 175), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 2. Богдан Давид
  insert into fee_rows (n, child) values (2, 'Богдан Давид') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 3. Богдан Ульяна
  insert into fee_rows (n, child) values (3, 'Богдан Ульяна') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 4. Гладкая Карина
  insert into fee_rows (n, child) values (4, 'Гладкая Карина') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 5. Горлинская Алёна
  insert into fee_rows (n, child) values (5, 'Горлинская Алёна') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 65.5), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 6. Гурецкий Роман
  insert into fee_rows (n, child) values (6, 'Гурецкий Роман') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 7. Дашкевич Варвара (+ бейдж 3,85)
  insert into fee_rows (n, child) values (7, 'Дашкевич Варвара') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 70), (r, c_hoz, 37.52), (r, c_badge, 3.85), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 8. Дехтяр Илья
  insert into fee_rows (n, child) values (8, 'Дехтяр Илья') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200.5), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 9. Домашевич Милана (значки — 2 шт, 13,80)
  insert into fee_rows (n, child) values (9, 'Домашевич Милана') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 71.4), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 13.8), (r, c_gpd, 7.6);
  -- 10. Дорошенко Арина (без ГПД)
  insert into fee_rows (n, child) values (10, 'Дорошенко Арина') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 50), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9);
  -- 11. Казнадей Анна
  insert into fee_rows (n, child) values (11, 'Казнадей Анна') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 12. Кашуба Тимур
  insert into fee_rows (n, child) values (12, 'Кашуба Тимур') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 13. Кнотько София
  insert into fee_rows (n, child) values (13, 'Кнотько София') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 14. Коваленков Тимофей
  insert into fee_rows (n, child) values (14, 'Коваленков Тимофей') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 15. Лаппо Егор
  insert into fee_rows (n, child) values (15, 'Лаппо Егор') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 201.3), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 16. Левко Арина
  insert into fee_rows (n, child) values (16, 'Левко Арина') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 17. Литош Кирилл
  insert into fee_rows (n, child) values (17, 'Литош Кирилл') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 58.8), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 18. Милишкевич Ева
  insert into fee_rows (n, child) values (18, 'Милишкевич Ева') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 19. Савчук Доминик (+ бейдж 3,85)
  insert into fee_rows (n, child) values (19, 'Савчук Доминик') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 205), (r, c_hoz, 37.52), (r, c_badge, 3.85), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 20. Стасько Павел
  insert into fee_rows (n, child) values (20, 'Стасько Павел') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200.8), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 21. Сиссауи Мохаммед (без ГПД)
  insert into fee_rows (n, child) values (21, 'Сиссауи Мохаммед') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 58.8), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9);
  -- 22. Сухабок Артём (+ бейдж 3,85)
  insert into fee_rows (n, child) values (22, 'Сухабок Артём') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 204), (r, c_hoz, 37.52), (r, c_badge, 3.85), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 23. Талако Алиса
  insert into fee_rows (n, child) values (23, 'Талако Алиса') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200.4), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 24. Тылецкий Андрей (без ГПД)
  insert into fee_rows (n, child) values (24, 'Тылецкий Андрей') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 183.8), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9);
  -- 25. Шилкин Артём
  insert into fee_rows (n, child) values (25, 'Шилкин Артём') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 200), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 26. Шило Тимофей (+ бейдж 3,85)
  insert into fee_rows (n, child) values (26, 'Шило Тимофей') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 204), (r, c_hoz, 37.52), (r, c_badge, 3.85), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
  -- 27. Шурова Агата
  insert into fee_rows (n, child) values (27, 'Шурова Агата') returning id into r;
  insert into fee_values (row_id, column_id, amount) values (r, c_paid, 199.8), (r, c_hoz, 37.52), (r, c_gifts, 34.14), (r, c_magnets, 6.9), (r, c_gpd, 7.6);
end $$;

-- ЧАСТЬ 3. ОБНОВЛЕНИЕ РАСХОДОВ ПО ТАБЛИЦЕ -----------------------------------

do $$
declare
  g_hoz uuid; g_gifts uuid; g_gpd uuid; g_other uuid; g_books uuid;
begin
  -- 3.1 Переименовать «Дни рождения» → «Подарки (сентябрь)»
  update expense_groups set title = 'Подарки (сентябрь)'
    where title = 'Дни рождения (сентябрь)';

  select id into g_hoz from expense_groups where title = 'Хозяйственные нужды (сентябрь)' limit 1;
  select id into g_gifts from expense_groups where title = 'Подарки (сентябрь)' limit 1;
  select id into g_books from expense_groups where title = 'Рабочие тетради (сентябрь)' limit 1;

  -- 3.2 Хознужды: контейнеры — теперь куплены, 19,24 × 27 = 519,48
  update expenses set
      name = 'Контейнеры для канцелярии + наклейки',
      price = 19.24, qty = '27', sum = 519.48, place = '21 Век',
      comment = 'наклейки — 10,41 BYN в составе суммы', planned = false
    where group_id = g_hoz and name = 'Контейнеры для канцелярии';

  -- 3.3 Хознужды: вешалки и стеллажи в гардероб (планируется)
  if g_hoz is not null and not exists (
    select 1 from expenses where group_id = g_hoz and name = 'Вешалки и стеллажи в гардероб'
  ) then
    insert into expenses (group_id, name, planned, comment)
      values (g_hoz, 'Вешалки и стеллажи в гардероб', true, '8,80 × 27 — сумма уточняется, совместно с 1 «В» классом');
  end if;

  -- 3.4 Подарки: уточнить суммы по таблице
  update expenses set name = 'День рождения — Казнадей Анна (02.09)', price = 30, sum = 30
    where group_id = g_gifts and name = 'Казнадей Анна (02.09)';
  update expenses set
      name = 'День рождения — Головко Виктория Петровна (09.09) · сертификат и цветы',
      price = 300, sum = 300, place = 'Золотое яблоко · цветы'
    where group_id = g_gifts and name = 'Головко Виктория Петровна (09.09) · сертификат';
  if g_gifts is not null and not exists (
    select 1 from expenses where group_id = g_gifts and name = 'Канцелярия — подарки ученикам на дни рождения'
  ) then
    insert into expenses (group_id, name, qty, sum, place)
      values (g_gifts, 'Канцелярия — подарки ученикам на дни рождения', '26', 591.85, 'Expobel, рынок');
  end if;

  -- 3.5 Новая группа: ГПД (группа продлённого дня)
  select id into g_gpd from expense_groups where title = 'ГПД (группа продлённого дня)' limit 1;
  if g_gpd is null then
    insert into expense_groups (title, sort) values ('ГПД (группа продлённого дня)', 3) returning id into g_gpd;
    insert into expenses (group_id, name, price, qty, sum, place, planned, comment) values
      (g_gpd, 'Тряпки на швабру', 3, '2', 6, 'FixPrice', false, null),
      (g_gpd, 'Савок + щётка', 17, '1', 17, '21 Век', false, null),
      (g_gpd, 'Тряпочки для уборки поверхностей', 5, '1 уп (5 шт)', 5, 'FixPrice', false, null),
      (g_gpd, 'Бумажные полотенца', 2.79, '2', 5.58, 'Мила', false, null),
      (g_gpd, 'Влажные салфетки', 3.99, '2 уп', 7.98, 'Мила', false, null),
      (g_gpd, 'Туалетная бумага', 16, '1 уп (24 шт)', 16, 'FixPrice', false, null),
      (g_gpd, 'Контейнеры для игр', null, null, null, null, true, null),
      (g_gpd, 'Канцелярия общая', null, 'набор', 95, 'FixPrice, Галамарт', false, 'цветные карандаши, ножницы, тетради, простые карандаши, ластики, блоки А4'),
      (g_gpd, 'Ковёр', null, null, null, null, true, null),
      (g_gpd, 'Контейнер для канцелярии', 3.9, '5', 19.5, 'Три цены', false, null),
      (g_gpd, 'Наклейки на кровати', 0.43, '24', 10.41, 'Фотопечать', false, null);
  end if;

  -- 3.6 Новая группа: Прочее (магнитные значки)
  select id into g_other from expense_groups where title = 'Прочее' limit 1;
  if g_other is null then
    insert into expense_groups (title, sort) values ('Прочее', 4) returning id into g_other;
    insert into expenses (group_id, name, price, qty, sum, place)
      values (g_other, 'Магнитные значки (Домашевич — 2 шт)', 6.9, '28', 193.2, 'СШ № 227');
  end if;

  -- 3.7 Рабочие тетради: две новые позиции + группа в конец списка
  if g_books is not null then
    update expense_groups set sort = 5 where id = g_books;
    if not exists (select 1 from expenses where group_id = g_books and name = 'Шкала самооценки') then
      insert into expenses (group_id, name, planned) values (g_books, 'Шкала самооценки', true);
    end if;
    if not exists (select 1 from expenses where group_id = g_books and name = 'Планшет для прописей') then
      insert into expenses (group_id, name, planned) values (g_books, 'Планшет для прописей', true);
    end if;
  end if;
end $$;

-- Готово! Проверка: должно быть 8 статей сборов, 27 детей, 5 групп расходов.
select
  (select count(*) from fee_columns) as "статей сборов",
  (select count(*) from fee_rows) as "детей",
  (select count(*) from expense_groups) as "групп расходов",
  (select count(*) from expenses) as "позиций расходов";
