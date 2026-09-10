-- ============================================================
-- Пуш-уведомления «Наш 1 «Г»: таблицы подписок и журнала рассылок.
-- Запустить один раз в Supabase: SQL Editor → New query → вставить → Run.
-- ============================================================

-- 1. Подписки на пуши (одна строка = один браузер/телефон)
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  role text not null default 'parent' check (role in ('parent', 'committee')),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Родители входят без аккаунта, поэтому подписываться можно анонимно.
-- Сами по себе адреса подписок бесполезны без секретного ключа сервера.
drop policy if exists "push_subs_select" on public.push_subscriptions;
create policy "push_subs_select" on public.push_subscriptions for select using (true);
drop policy if exists "push_subs_insert" on public.push_subscriptions;
create policy "push_subs_insert" on public.push_subscriptions for insert with check (true);
drop policy if exists "push_subs_update" on public.push_subscriptions;
create policy "push_subs_update" on public.push_subscriptions for update using (true);
drop policy if exists "push_subs_delete" on public.push_subscriptions;
create policy "push_subs_delete" on public.push_subscriptions for delete using (true);

-- 2. Журнал ежедневной рассылки о днях рождения —
--    защита от повторной отправки в один и тот же день.
create table if not exists public.push_log (
  day date primary key,
  sent int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_log enable row level security;

drop policy if exists "push_log_select" on public.push_log;
create policy "push_log_select" on public.push_log for select using (true);
drop policy if exists "push_log_insert" on public.push_log;
create policy "push_log_insert" on public.push_log for insert with check (true);
drop policy if exists "push_log_update" on public.push_log;
create policy "push_log_update" on public.push_log for update using (true);
