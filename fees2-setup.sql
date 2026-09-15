-- ============================================================
-- Наш 1 «Г» — редактируемые сборы, разделение сборов, разовые
-- поступления, способ оплаты и журнал правок.
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно —
-- данные не задублируются.
-- ============================================================

-- ЧАСТЬ 1. СПОСОБ ОПЛАТЫ И ЗАМЕТКИ В СТАРОЙ ТАБЛИЦЕ ВЗНОСОВ ------------------
-- К каждой сумме в таблице «Взносы 2026–2027» (сбор 50 руб) можно
-- указывать способ оплаты (наличные/перевод) и заметку.

alter table fee_values add column if not exists method text;
alter table fee_values add column if not exists note text;

-- ЧАСТЬ 2. СБОРЫ-КАМПАНИИ (разделение сборов) --------------------------------
-- Каждый сбор — отдельная карточка со своим статусом: 'open' (идёт)
-- или 'closed' (закрыт). Старый сбор 50 руб живёт в таблицах fee_*,
-- новые сборы (150 руб и будущие) — здесь.

create table if not exists fee_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric not null default 0,          -- сколько сдаёт одна семья
  status text not null default 'open' check (status in ('open', 'closed')),
  comment text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Платежи по сборам: кто, сколько, как (наличные/перевод), когда.
-- Один ребёнок может сдавать частями — несколько строк.
create table if not exists campaign_payments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references fee_campaigns(id) on delete cascade,
  child text not null,
  amount numeric not null,
  method text not null default 'transfer' check (method in ('cash', 'transfer')),
  note text,
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- ЧАСТЬ 3. РАЗОВЫЕ ПОСТУПЛЕНИЯ ----------------------------------------------
-- Пример: другой ученик сдал 25 руб на ГПД. Плюсуются в кассу на главной.

create table if not exists one_off_incomes (
  id uuid primary key default gen_random_uuid(),
  from_name text not null,                    -- от кого
  purpose text not null,                      -- на что (ГПД, подарки, хознужды…)
  amount numeric not null,
  method text not null default 'cash' check (method in ('cash', 'transfer')),
  comment text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ЧАСТЬ 4. ЖУРНАЛ ПРАВОК (прозрачность для родителей) ------------------------
-- Каждое изменение сумм: что правили, старая и новая сумма, кто и когда.

create table if not exists fee_edits_log (
  id uuid primary key default gen_random_uuid(),
  target text not null,                       -- какой сбор/раздел
  child text,                                 -- чья строка (если про ребёнка)
  field text,                                 -- какая статья/что именно
  old_amount numeric,
  new_amount numeric,
  editor text,                                -- кто внёс изменение
  at timestamptz not null default now()
);

-- ЧАСТЬ 5. ПРАВА ДОСТУПА ------------------------------------------------------
-- Читать могут все (родители видят всё — прозрачность),
-- менять — только вошедшие (комитет).

alter table fee_campaigns enable row level security;
alter table campaign_payments enable row level security;
alter table one_off_incomes enable row level security;
alter table fee_edits_log enable row level security;

drop policy if exists "fee_campaigns read" on fee_campaigns;
create policy "fee_campaigns read" on fee_campaigns for select using (true);
drop policy if exists "fee_campaigns write" on fee_campaigns;
create policy "fee_campaigns write" on fee_campaigns for all to authenticated using (true) with check (true);

drop policy if exists "campaign_payments read" on campaign_payments;
create policy "campaign_payments read" on campaign_payments for select using (true);
drop policy if exists "campaign_payments write" on campaign_payments;
create policy "campaign_payments write" on campaign_payments for all to authenticated using (true) with check (true);

drop policy if exists "one_off_incomes read" on one_off_incomes;
create policy "one_off_incomes read" on one_off_incomes for select using (true);
drop policy if exists "one_off_incomes write" on one_off_incomes;
create policy "one_off_incomes write" on one_off_incomes for all to authenticated using (true) with check (true);

drop policy if exists "fee_edits_log read" on fee_edits_log;
create policy "fee_edits_log read" on fee_edits_log for select using (true);
drop policy if exists "fee_edits_log write" on fee_edits_log;
create policy "fee_edits_log write" on fee_edits_log for all to authenticated using (true) with check (true);

-- ЧАСТЬ 6. СТАРТОВЫЕ ДАННЫЕ ---------------------------------------------------
-- Новый сбор 150 руб (идёт сейчас). Остатки со сбора 50 руб приложение
-- переносит в него автоматически и показывает отдельной колонкой.

insert into fee_campaigns (title, amount, status, comment, sort)
select 'Сбор 150 руб', 150, 'open',
       'Остатки со сбора 50 руб перенесены и зачтены автоматически', 1
where not exists (select 1 from fee_campaigns);

-- Готово! Проверка: должен появиться 1 сбор «Сбор 150 руб».
select
  (select count(*) from fee_campaigns) as "сборов-кампаний",
  (select count(*) from campaign_payments) as "платежей",
  (select count(*) from one_off_incomes) as "разовых поступлений",
  (select count(*) from fee_edits_log) as "записей журнала";
