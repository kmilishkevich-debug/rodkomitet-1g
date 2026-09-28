-- ============================================================
-- Наш 1 «Г» — обсуждения под публикациями учителя (28.09.2026)
--
-- Что делает файл:
--   1) Создаёт таблицу post_comments — общий чат под каждой
--      публикацией учителя: объявлением, заданием или событием.
--      Видят и пишут все семьи + учитель.
--   2) Создаёт таблицу post_chat_closed — учитель может закрыть
--      обсуждение конкретной публикации: чат остаётся видимым,
--      но родители больше не могут писать.
--   3) Разрешает роль «teacher» в подписках на пуши, чтобы
--      учитель получал уведомления о новых сообщениях родителей.
--   4) Подключает обе таблицы к мгновенным обновлениям (Realtime).
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
--
-- ВАЖНО: до запуска этого файла кнопки «Обсуждение» в приложении
-- просто не показываются — это нормально и не ошибка.
-- ============================================================


-- ============================================================
-- ШАГ 1. СООБЩЕНИЯ ПОД ПУБЛИКАЦИЯМИ
-- ============================================================
-- Одна строка — одно сообщение. Публикация определяется парой
-- post_kind + post_id:
--   'ann'   — объявление (announcements.id)
--   'hw'    — задание   (homework.id)
--   'event' — событие   (class_events.id)
-- from_teacher говорит, кто написал; family_n — номер семьи
-- (у сообщений учителя он пустой).
--
-- Честно про приватность: чат общий, его видят все семьи класса.
-- Родители входят по общему коду, поэтому база не отличает семьи
-- на уровне прав — подпись «Семья Евы М.» ставит само приложение.

create table if not exists post_comments (
  id           uuid primary key default gen_random_uuid(),
  post_kind    text not null check (post_kind in ('ann', 'hw', 'event')),
  post_id      uuid not null,           -- id объявления, задания или события
  family_n     int,                     -- номер семьи; null = написал учитель
  from_teacher boolean not null default false,
  author       text,                    -- «Головко В. П.» или «Семья Евы М.»
  text         text not null,
  read_teacher boolean not null default false, -- учитель видел сообщение
  created_at   timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on post_comments (post_kind, post_id, created_at);

alter table post_comments enable row level security;

drop policy if exists "post cmt read"        on post_comments;
drop policy if exists "post cmt insert"      on post_comments;
drop policy if exists "post cmt update"      on post_comments;
drop policy if exists "post cmt delete auth" on post_comments;
drop policy if exists "post cmt delete anon" on post_comments;

-- Читают все: учитель и комитет — по паролю, родители — по коду.
create policy "post cmt read" on post_comments
  for select to anon, authenticated using (true);

-- Пишут тоже все — иначе родители не смогли бы участвовать.
create policy "post cmt insert" on post_comments
  for insert to anon, authenticated with check (true);

-- Отметка «учитель прочитал».
create policy "post cmt update" on post_comments
  for update to anon, authenticated using (true) with check (true);

-- Учитель (и комитет) может удалить любое сообщение.
create policy "post cmt delete auth" on post_comments
  for delete to authenticated using (true);

-- Родитель может удалить только родительские сообщения.
-- Своё/чужое различает приложение (кнопка видна только своей семье):
-- строже здесь нельзя — все родители входят под одним общим кодом.
create policy "post cmt delete anon" on post_comments
  for delete to anon using (from_teacher = false);


-- ============================================================
-- ШАГ 2. ЗАКРЫТИЕ ОБСУЖДЕНИЯ
-- ============================================================
-- Одна строка — одна закрытая публикация. Если строки нет или
-- closed = false, обсуждение открыто. Закрыть и открыть обратно
-- может только вошедший по паролю (учитель).

create table if not exists post_chat_closed (
  post_kind  text not null check (post_kind in ('ann', 'hw', 'event')),
  post_id    uuid not null,
  closed     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (post_kind, post_id)
);

alter table post_chat_closed enable row level security;

drop policy if exists "chat closed read"  on post_chat_closed;
drop policy if exists "chat closed write" on post_chat_closed;

-- Видят состояние все (родителям надо знать, что писать нельзя).
create policy "chat closed read" on post_chat_closed
  for select to anon, authenticated using (true);

-- Менять может только вошедший по паролю.
create policy "chat closed write" on post_chat_closed
  for all to authenticated using (true) with check (true);


-- ============================================================
-- ШАГ 3. РОЛЬ «TEACHER» ДЛЯ ПУШЕЙ
-- ============================================================
-- В push_subscriptions роль ограничена списком ('parent','committee').
-- Добавляем 'teacher', чтобы подписка учителя помечалась отдельно
-- и пуши о новых сообщениях уходили только ему.

alter table push_subscriptions
  drop constraint if exists push_subscriptions_role_check;

alter table push_subscriptions
  add constraint push_subscriptions_role_check
  check (role in ('parent', 'committee', 'teacher'));


-- ============================================================
-- ШАГ 4. МГНОВЕННЫЕ ОБНОВЛЕНИЯ (REALTIME)
-- ============================================================
-- Чтобы новое сообщение появлялось у всех само, без перезагрузки.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'post_comments'
  ) then
    alter publication supabase_realtime add table public.post_comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'post_chat_closed'
  ) then
    alter publication supabase_realtime add table public.post_chat_closed;
  end if;
end $$;


-- ПРОВЕРКА -----------------------------------------------------------------
-- Должно быть: «Сообщений» = 0, «Закрытых обсуждений» = 0,
-- «Роль teacher разрешена» = true.
select
  (select count(*) from post_comments)    as "Сообщений",
  (select count(*) from post_chat_closed) as "Закрытых обсуждений",
  exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_role_check'
      and pg_get_constraintdef(oid) like '%teacher%'
  ) as "Роль teacher разрешена";
