-- ============================================================
-- Наш 1 «Г» — целевые сборы (экскурсии, подарки и т.п.):
-- кнопка «+ Новый сбор», дедлайн «сдать до», список участников
-- и напоминание «вы ещё не сдали» на главной.
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно —
-- данные не задублируются.
-- ============================================================

-- ЧАСТЬ 1. ТАБЛИЦЫ СБОРОВ (если fees2-setup.sql ещё не запускался) ----------

create table if not exists fee_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric not null default 0,          -- сколько сдаёт одна семья
  status text not null default 'open' check (status in ('open', 'closed')),
  comment text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

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

-- ЧАСТЬ 2. НОВЫЕ ПОЛЯ СБОРА ---------------------------------------------------
-- deadline — необязательная дата «сдать до» (показывается в напоминании).
-- participants — список № строк ведомости, кто участвует в сборе
--   (например, не все дети идут на экскурсию). NULL = участвуют все.

alter table fee_campaigns add column if not exists deadline date;
alter table fee_campaigns add column if not exists participants jsonb;

-- ЧАСТЬ 3. ПРАВА ДОСТУПА ------------------------------------------------------
-- Читать могут все (родители видят всё — прозрачность),
-- менять — только вошедшие (комитет и учитель).

alter table fee_campaigns enable row level security;
alter table campaign_payments enable row level security;

drop policy if exists "fee_campaigns read" on fee_campaigns;
create policy "fee_campaigns read" on fee_campaigns for select using (true);
drop policy if exists "fee_campaigns write" on fee_campaigns;
create policy "fee_campaigns write" on fee_campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists "campaign_payments read" on campaign_payments;
create policy "campaign_payments read" on campaign_payments for select using (true);
drop policy if exists "campaign_payments write" on campaign_payments;
create policy "campaign_payments write" on campaign_payments
  for all to authenticated using (true) with check (true);
