-- ============================================================
-- Наш 1 «Г» — кабинет классного руководителя, версия 2 (23.09.2026)
--
-- Что делает файл:
--   1) Добавляет в user_roles колонку greeting_name — имя, которым
--      приложение здоровается: «Доброе утро, Виктория Петровна!».
--      В подписи под объявлениями остаётся строгое «Головко В. П.».
--   2) Создаёт таблицу family_messages — личная переписка учителя
--      с семьёй: учитель пишет, родитель отвечает, оба видят ветку.
--   3) Открывает доступ по общей модели приложения: читают все
--      (родители заходят по семейному коду, без пароля), пишут все —
--      иначе родитель не смог бы ответить.
--   4) Подключает переписку к мгновенным обновлениям (Realtime).
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
--
-- ВАЖНО: сначала должны быть запущены schedule-updates-setup.sql
-- (создаёт user_roles), family-notes-setup.sql и teacher-setup.sql
-- (создают family_notes, homework и class_events).
-- ============================================================


-- ============================================================
-- ШАГ 1. ИМЯ ДЛЯ ПРИВЕТСТВИЯ
-- ============================================================
-- display_name («Головко В. П.») подписывает объявления и задания —
-- он должен оставаться официальным. А здороваться так сухо нельзя,
-- поэтому заводим отдельное поле для обращения.

alter table user_roles
  add column if not exists greeting_name text;

-- Заполняем имя учителя. Если у вас в базе другая почта — поменяйте её
-- в строке ниже (она должна совпадать с почтой из teacher-setup.sql).
update user_roles
   set greeting_name = 'Виктория Петровна'
 where role = 'teacher'
   and (greeting_name is null or greeting_name = '');


-- ============================================================
-- ШАГ 2. ЛИЧНАЯ ПЕРЕПИСКА С СЕМЬЁЙ
-- ============================================================
-- Одна строка — одно сообщение. Ветка собирается по family_n
-- (номер семьи из списка класса). from_teacher говорит, с какой
-- стороны пришло сообщение, и рисует его слева или справа.
--
-- Честно про приватность: родители входят по общему семейному коду,
-- поэтому база не может отличить одну семью от другой на уровне прав.
-- Переписку прячет приложение: родитель видит только ветку своей семьи.
-- Это та же модель, что и у family_notes — не хуже, но и не крепче.

create table if not exists family_messages (
  id           uuid primary key default gen_random_uuid(),
  family_n     int  not null,           -- номер семьи в списке класса
  from_teacher boolean not null default false, -- true = написал учитель
  author       text,                    -- кто написал: имя учителя или «Родитель»
  text         text not null,           -- само сообщение
  read_teacher boolean not null default false, -- учитель прочитал ответ
  read_family  boolean not null default false, -- семья прочитала сообщение
  created_at   timestamptz not null default now()
);

create index if not exists family_messages_family_idx
  on family_messages (family_n, created_at);

alter table family_messages enable row level security;

drop policy if exists "fam msg read"   on family_messages;
drop policy if exists "fam msg write"  on family_messages;
drop policy if exists "fam msg insert" on family_messages;
drop policy if exists "fam msg update" on family_messages;
drop policy if exists "fam msg delete" on family_messages;

-- Читают все: и учитель (вошёл по почте), и родитель (вошёл по коду).
create policy "fam msg read" on family_messages
  for select to anon, authenticated using (true);

-- Пишут тоже все — иначе родитель не смог бы ответить.
-- Разрешения разделены на три штуки специально: политика «for all»
-- в Postgres разрешительная и незаметно накрывает ещё и чтение.
create policy "fam msg insert" on family_messages
  for insert to anon, authenticated with check (true);

create policy "fam msg update" on family_messages
  for update to anon, authenticated using (true) with check (true);

-- Удалять сообщения может только вошедший по паролю (учитель, комитет).
create policy "fam msg delete" on family_messages
  for delete to authenticated using (true);


-- ============================================================
-- ШАГ 3. МГНОВЕННЫЕ ОБНОВЛЕНИЯ (REALTIME)
-- ============================================================
-- Чтобы ответ родителя появлялся у учителя сам, без перезагрузки.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'family_messages'
  ) then
    alter publication supabase_realtime add table public.family_messages;
  end if;
end $$;


-- ПРОВЕРКА -----------------------------------------------------------------
-- Должно быть: «Имя для приветствия» = Виктория Петровна, «Сообщений» = 0.
-- Если имя пустое — значит в Шаге 1 не нашлась строка с ролью teacher:
-- проверьте, что teacher-setup.sql уже был запущен.
select
  (select greeting_name from user_roles where role = 'teacher' limit 1)
       as "Имя для приветствия",
  (select display_name  from user_roles where role = 'teacher' limit 1)
       as "Подпись в объявлениях",
  (select count(*) from family_messages) as "Сообщений";
