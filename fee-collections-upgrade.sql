-- ============================================================
-- Наш 1 «Г» — обновление целевых сборов:
--   1) видимость сборов учителю (по умолчанию все сборы скрыты,
--      комитет открывает галочкой; учитель видит созданные им);
--   2) реквизиты карты для перевода (одни общие на все сборы);
--   3) заявки родителей «я перевёл(а) + чек» и «передам наличными»
--      со статусом «на проверке» и подтверждением комитетом.
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Можно запускать повторно —
-- данные не задублируются. Файл fee-collections-setup.sql должен
-- быть запущен раньше (таблицы fee_campaigns / campaign_payments).
-- ============================================================

-- ЧАСТЬ 1. ВИДИМОСТЬ УЧИТЕЛЮ ------------------------------------------------
-- teacher_visible = false скрывает сбор от учителя целиком.
-- По умолчанию false — все старые сборы сразу станут скрыты.
-- created_by — кто создал сбор: учитель всегда видит свои.

alter table fee_campaigns add column if not exists teacher_visible boolean not null default false;
alter table fee_campaigns add column if not exists created_by text;

-- ЧАСТЬ 2. РЕКВИЗИТЫ ДЛЯ ПЕРЕВОДА -------------------------------------------
-- Одна строка настроек (id = 1): номер карты, телефон, банк.
-- Заполняет и правит только комитет, видят все родители.

create table if not exists payment_requisites (
  id int primary key,
  card_number text,
  phone text,
  bank text,
  updated_at timestamptz not null default now()
);

insert into payment_requisites (id) values (1) on conflict (id) do nothing;

-- ЧАСТЬ 3. ЗАЯВКИ РОДИТЕЛЕЙ ОБ ОПЛАТЕ ---------------------------------------
-- Родитель отмечает «я перевёл(а)» с чеком или «передам наличными».
-- Статус pending = на проверке; комитет подтверждает (approved,
-- платёж попадает в campaign_payments) или отклоняет (rejected).

create table if not exists campaign_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references fee_campaigns(id) on delete cascade,
  child text not null,                          -- ребёнок (первый в семье)
  amount numeric not null,
  method text not null default 'transfer' check (method in ('cash', 'transfer')),
  receipt_url text,                             -- фото чека (для перевода)
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- ЧАСТЬ 4. ПРАВА ДОСТУПА ------------------------------------------------------
-- Реквизиты: читают все, правит только вошедший комитет.
-- Заявки: создать может любой родитель (без входа), читать могут все
-- (родитель видит статус своей), подтверждать/отклонять — только вошедшие.

alter table payment_requisites enable row level security;

drop policy if exists "payment_requisites read" on payment_requisites;
create policy "payment_requisites read" on payment_requisites for select using (true);
drop policy if exists "payment_requisites write" on payment_requisites;
create policy "payment_requisites write" on payment_requisites
  for all to authenticated using (true) with check (true);

alter table campaign_claims enable row level security;

drop policy if exists "campaign_claims read" on campaign_claims;
create policy "campaign_claims read" on campaign_claims for select using (true);
drop policy if exists "campaign_claims insert" on campaign_claims;
create policy "campaign_claims insert" on campaign_claims
  for insert with check (true);
drop policy if exists "campaign_claims update" on campaign_claims;
create policy "campaign_claims update" on campaign_claims
  for update to authenticated using (true) with check (true);
drop policy if exists "campaign_claims delete" on campaign_claims;
create policy "campaign_claims delete" on campaign_claims
  for delete to authenticated using (true);
