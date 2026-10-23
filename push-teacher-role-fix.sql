-- ============================================================
-- Наш 1 «Г» — пуши учителя: разрешить роль 'teacher' (23.10.2026)
--
-- Почему: таблица push_subscriptions создавалась до появления
-- кабинета учителя, и ограничение пускало только роли
-- 'parent' и 'committee'. Когда Виктория Петровна нажимала
-- «Включить уведомления», база отвечала ошибкой
--   violates check constraint "push_subscriptions_role_check"
-- (скриншот 23.10.2026) — поэтому у учителя не было ни одной
-- подписки и пуши о сообщениях родителей не доходили.
--
-- Что делает файл: заменяет ограничение на новое, куда добавлена
-- роль 'teacher'. Существующие подписки родителей и комитета
-- не трогаются.
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- ============================================================

alter table push_subscriptions
  drop constraint if exists push_subscriptions_role_check;

alter table push_subscriptions
  add constraint push_subscriptions_role_check
  check (role in ('parent', 'committee', 'teacher'));


-- ============================================================
-- ПРОВЕРКА: должно вернуть одну строку с новым условием
-- ============================================================
select conname as "Ограничение",
       pg_get_constraintdef(oid) as "Условие (должно содержать teacher)"
from pg_constraint
where conrelid = 'push_subscriptions'::regclass
  and conname = 'push_subscriptions_role_check';
