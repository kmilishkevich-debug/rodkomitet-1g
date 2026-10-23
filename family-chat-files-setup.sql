-- ============================================================
-- Наш 1 «Г» — вложения: хранилище файлов + файлы в личном чате (23.10.2026)
--
-- Что делает файл:
--   1) Создаёт хранилище "files" для вложений (фото, документы,
--      скрины) и открывает к нему доступ. Без него кнопка
--      «Прикрепить файлы» не работает НИГДЕ — ни в объявлениях,
--      ни в заданиях, ни в чате (проверка 23.10.2026 показала,
--      что хранилище так и не было создано).
--   2) Добавляет в таблицу family_messages колонку files (jsonb) —
--      вложения в личной переписке учителя с семьёй. Формат такой
--      же, как у объявлений: массив объектов { name, url, size, type }.
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- ============================================================


-- ============================================================
-- ШАГ 1. ХРАНИЛИЩЕ ВЛОЖЕНИЙ
-- ============================================================
-- Публичное: ссылки на файлы вставляются в записи и должны
-- открываться у всех. Пишут и родители (anon), и учитель/комитет.

insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do nothing;

drop policy if exists "files read"   on storage.objects;
drop policy if exists "files write"  on storage.objects;
drop policy if exists "files delete" on storage.objects;

create policy "files read" on storage.objects
  for select using (bucket_id = 'files');
create policy "files write" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'files');
create policy "files delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'files');


-- ============================================================
-- ШАГ 2. ВЛОЖЕНИЯ В ЛИЧНОМ ЧАТЕ
-- ============================================================
-- Пока колонки нет, приложение работает как раньше: сообщение
-- уходит без файлов (само убирает их, чтобы чат не ломался).

alter table family_messages
  add column if not exists files jsonb;


-- ============================================================
-- ПРОВЕРКА
-- ============================================================
select
  exists (select 1 from storage.buckets where id = 'files')
    as "Хранилище files создано",
  exists (select 1 from information_schema.columns
           where table_name = 'family_messages' and column_name = 'files')
    as "Колонка files в чате";
