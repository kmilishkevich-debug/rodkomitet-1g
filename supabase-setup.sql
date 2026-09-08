-- ============================================================
-- Наш 1 «Г» — настройка базы данных расходов в Supabase.
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Выполняется один раз.
-- ============================================================

-- 1. Таблица групп расходов
create table if not exists expense_groups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Таблица расходов
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references expense_groups(id) on delete cascade,
  name text not null,
  price numeric,
  qty text,
  sum numeric,
  place text,
  comment text,
  purchased_at date default current_date,
  planned boolean not null default false,
  free boolean not null default false,
  receipt_url text,
  created_at timestamptz not null default now()
);

-- 3. Права: читать могут все (родители без пароля),
--    добавлять/менять/удалять — только вошедшие (комитет)
alter table expense_groups enable row level security;
alter table expenses enable row level security;

drop policy if exists "groups read" on expense_groups;
create policy "groups read" on expense_groups for select using (true);
drop policy if exists "groups write" on expense_groups;
create policy "groups write" on expense_groups for all to authenticated using (true) with check (true);

drop policy if exists "expenses read" on expenses;
create policy "expenses read" on expenses for select using (true);
drop policy if exists "expenses write" on expenses;
create policy "expenses write" on expenses for all to authenticated using (true) with check (true);

-- 4. Хранилище фото чеков: смотреть могут все, загружать — только комитет
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "receipts read" on storage.objects;
create policy "receipts read" on storage.objects for select using (bucket_id = 'receipts');
drop policy if exists "receipts write" on storage.objects;
create policy "receipts write" on storage.objects for insert to authenticated with check (bucket_id = 'receipts');
drop policy if exists "receipts update" on storage.objects;
create policy "receipts update" on storage.objects for update to authenticated using (bucket_id = 'receipts');
drop policy if exists "receipts delete" on storage.objects;
create policy "receipts delete" on storage.objects for delete to authenticated using (bucket_id = 'receipts');

-- 5. Перенос текущих расходов класса (сентябрь 2026)
do $$
declare
  g_hoz uuid; g_bday uuid; g_books uuid;
begin
  if exists (select 1 from expense_groups) then
    return; -- данные уже перенесены, второй раз не дублируем
  end if;

  insert into expense_groups (title, sort) values ('Хозяйственные нужды (сентябрь)', 1) returning id into g_hoz;
  insert into expense_groups (title, sort) values ('Дни рождения (сентябрь)', 2) returning id into g_bday;
  insert into expense_groups (title, sort) values ('Рабочие тетради (сентябрь)', 3) returning id into g_books;

  insert into expenses (group_id, name, price, qty, sum, place, planned, free) values
    (g_hoz, 'Туалетная бумага', 16, '2 уп (48 шт)', 32, 'FixPrice', false, false),
    (g_hoz, 'Бумажные полотенца', 0, '12 шт', 0, 'род. комитет', false, true),
    (g_hoz, 'Влажные салфетки', 3.75, '3', 11.25, 'FixPrice', false, false),
    (g_hoz, 'Стаканчики', 20.42, '1 уп (400 шт)', 20.42, '21 Век', false, false),
    (g_hoz, 'Тряпочки для парт', 2.5, '2 уп (6 шт)', 5, 'FixPrice', false, false),
    (g_hoz, 'Мусорные пакеты', 2.83, '1', 2.83, 'Санта', false, false),
    (g_hoz, 'Савок + щётка', 17, '1', 17, '21 Век', false, false),
    (g_hoz, 'Контейнеры для канцелярии', null, null, null, null, true, false),
    (g_hoz, 'Фильтр (вода) + расходы на школьные награждения', 15, '27', 405, 'ЕРИП: Попечительский совет школы', false, false),
    (g_bday, 'Казнадей Анна (02.09)', 35, '1', 35, 'Канцелярия', false, false),
    (g_bday, 'Головко Виктория Петровна (09.09) · сертификат', 200, '1', 200, 'Золотое яблоко', false, false),
    (g_books, 'Белорусский язык', null, null, null, null, true, false),
    (g_books, 'Человек и мир', null, null, null, null, true, false),
    (g_books, 'Трудовое обучение', null, null, null, null, true, false),
    (g_books, 'ИЗО', null, null, null, null, true, false);
end $$;
