-- ============================================================
-- Наш 1 «Г» — редактирование и удаление сообщений (23.10.2026)
--
-- Что это: в личной переписке с учителем и в обсуждениях под
-- публикациями можно изменить или удалить СВОЁ сообщение.
--
-- Что делает файл:
--   1) Добавляет колонку edited_at в family_messages — отметка
--      «изменено» у отредактированных сообщений.
--   2) Разрешает родителям (вход по коду, без пароля) удалять
--      родительские сообщения в личной переписке — раньше удалять
--      мог только вошедший по паролю. Своё/чужое различает
--      приложение (кнопка видна только своей семье) — строже
--      нельзя, родители входят под общим кодом.
--   3) Добавляет edited_at и в post_comments, если таблица
--      обсуждений уже создана (post-comments-setup.sql);
--      если ещё нет — тихо пропускает, запустите позже ещё раз.
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- ============================================================

-- 1. Отметка «изменено» в личной переписке
alter table family_messages
  add column if not exists edited_at timestamptz;

-- 2. Родитель может удалить родительское сообщение
drop policy if exists "fam msg delete anon" on family_messages;
create policy "fam msg delete anon" on family_messages
  for delete to anon using (from_teacher = false);

-- 3. Отметка «изменено» в обсуждениях (если таблица уже есть)
do $$
begin
  if to_regclass('public.post_comments') is not null then
    alter table post_comments add column if not exists edited_at timestamptz;
  end if;
end $$;


-- ============================================================
-- ПРОВЕРКА: первая строка — «edited_at | family_messages»,
-- вторая появится после создания обсуждений; политика = true
-- ============================================================
select column_name as "Колонка", table_name as "Таблица"
from information_schema.columns
where column_name = 'edited_at'
  and table_name in ('family_messages', 'post_comments');

select exists (
  select 1 from pg_policies
  where tablename = 'family_messages' and policyname = 'fam msg delete anon'
) as "Родитель может удалять свои";
