-- ============================================================
-- Наш 1 «Г» — вкладка «Фото класса» (10.10.2026)
--
-- Что делает файл:
--   1) Создаёт таблицу photo_events — альбомы-события
--      («Экскурсия в музей», «1 сентября»...): название, дата,
--      описание. По событиям работают фильтры в ленте.
--   2) Создаёт таблицу photo_items — сами фото и видео:
--      полная версия + миниатюра для быстрой ленты.
--   3) Создаёт таблицу photo_likes — сердечки под КАЖДЫМ фото.
--   4) Создаёт таблицу photo_comments — комментарии к КАЖДОМУ
--      фото, с возможностью исправить свой текст (отметка
--      «Изменено» хранится в edited_at).
--   5) Создаёт хранилище (bucket) "photos" для файлов:
--      загружать и смотреть могут все — и родители, и учитель.
--   6) Подключает таблицы к мгновенным обновлениям (Realtime).
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
--
-- ВАЖНО: до запуска этого файла вкладка «Фото» в приложении
-- покажет сообщение, что база ещё не настроена, — это нормально.
-- ============================================================


-- ============================================================
-- ШАГ 1. СОБЫТИЯ (АЛЬБОМЫ)
-- ============================================================
-- Одна строка — одно событие. author — подпись, кто создал
-- («Семья Евы М.», «Головко В. П.» или имя из комитета).

create table if not exists photo_events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  event_date date,
  descr      text,
  author     text,
  family_n   int,                      -- номер семьи автора; null = учитель/комитет
  created_at timestamptz not null default now()
);

alter table photo_events enable row level security;

drop policy if exists "ph events read"   on photo_events;
drop policy if exists "ph events insert" on photo_events;
drop policy if exists "ph events update" on photo_events;
drop policy if exists "ph events delete" on photo_events;

-- Смотрят и создают события все: родители — по коду, остальные — по паролю.
create policy "ph events read" on photo_events
  for select to anon, authenticated using (true);
create policy "ph events insert" on photo_events
  for insert to anon, authenticated with check (true);
create policy "ph events update" on photo_events
  for update to anon, authenticated using (true) with check (true);

-- Правило «своё удаляет автор, чужое — комитет или учитель» различает
-- само приложение (родители входят под одним общим кодом, поэтому
-- база не может отличить одну семью от другой); база разрешает всем.
create policy "ph events delete" on photo_events
  for delete to anon, authenticated using (true);


-- ============================================================
-- ШАГ 2. ФОТО И ВИДЕО
-- ============================================================
-- Одна строка — один файл. path — ключ файла в хранилище,
-- он нужен, чтобы при удалении строки стереть и сам файл.
-- thumb_url / thumb_path — лёгкая миниатюра для ленты и сеток;
-- у видео миниатюры нет (показываем значок ▶).

create table if not exists photo_items (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references photo_events(id) on delete cascade,
  url        text not null,            -- публичная ссылка на полную версию
  path       text not null,            -- ключ полной версии в хранилище
  thumb_url  text,                     -- ссылка на миниатюру (для ленты)
  thumb_path text,                     -- ключ миниатюры в хранилище
  type       text not null default 'image' check (type in ('image', 'video')),
  name       text,                     -- настоящее имя файла
  size       bigint,
  author     text,                     -- кто загрузил
  family_n   int,                      -- номер семьи загрузившего; null = учитель/комитет
  created_at timestamptz not null default now()
);

-- Если таблица уже была создана раньше без новых колонок — дописываем их
alter table photo_items add column if not exists thumb_url  text;
alter table photo_items add column if not exists thumb_path text;
alter table photo_items add column if not exists family_n   int;

create index if not exists photo_items_event_idx
  on photo_items (event_id, created_at);
create index if not exists photo_items_created_idx
  on photo_items (created_at desc);

alter table photo_items enable row level security;

drop policy if exists "ph items read"   on photo_items;
drop policy if exists "ph items insert" on photo_items;
drop policy if exists "ph items delete" on photo_items;

create policy "ph items read" on photo_items
  for select to anon, authenticated using (true);
create policy "ph items insert" on photo_items
  for insert to anon, authenticated with check (true);

-- «Своё — сам, чужое — комитет/учитель» проверяет приложение (см. выше).
create policy "ph items delete" on photo_items
  for delete to anon, authenticated using (true);


-- ============================================================
-- ШАГ 3. СЕРДЕЧКИ (К КАЖДОМУ ФОТО)
-- ============================================================
-- who: 'family:5' — семья №5, 'teacher' — учитель,
-- 'committee' — комитет. Одно сердечко от одного «кто» на фото.

create table if not exists photo_likes (
  item_id    uuid not null references photo_items(id) on delete cascade,
  who        text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, who)
);

alter table photo_likes enable row level security;

drop policy if exists "ph likes read"   on photo_likes;
drop policy if exists "ph likes insert" on photo_likes;
drop policy if exists "ph likes delete" on photo_likes;

create policy "ph likes read" on photo_likes
  for select to anon, authenticated using (true);
create policy "ph likes insert" on photo_likes
  for insert to anon, authenticated with check (true);
create policy "ph likes delete" on photo_likes
  for delete to anon, authenticated using (true);


-- ============================================================
-- ШАГ 4. КОММЕНТАРИИ (К КАЖДОМУ ФОТО)
-- ============================================================
-- Как в обсуждениях под публикациями: подпись ставит приложение.
-- edited_at заполняется, когда автор исправил свой текст, —
-- рядом с комментарием появляется отметка «Изменено».

create table if not exists photo_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references photo_items(id) on delete cascade,
  family_n   int,                      -- null = учитель или комитет
  author     text,
  text       text not null,
  edited_at  timestamptz,              -- когда исправили (null = не правили)
  created_at timestamptz not null default now()
);

create index if not exists photo_comments_item_idx
  on photo_comments (item_id, created_at);

alter table photo_comments enable row level security;

drop policy if exists "ph cmt read"   on photo_comments;
drop policy if exists "ph cmt insert" on photo_comments;
drop policy if exists "ph cmt update" on photo_comments;
drop policy if exists "ph cmt delete" on photo_comments;

create policy "ph cmt read" on photo_comments
  for select to anon, authenticated using (true);
create policy "ph cmt insert" on photo_comments
  for insert to anon, authenticated with check (true);
-- Исправление своего комментария (кто «свой» — различает приложение)
create policy "ph cmt update" on photo_comments
  for update to anon, authenticated using (true) with check (true);
create policy "ph cmt delete" on photo_comments
  for delete to anon, authenticated using (true);


-- ============================================================
-- ШАГ 5. ХРАНИЛИЩЕ ФАЙЛОВ "photos"
-- ============================================================
-- Загружают все (родители входят без пароля, поэтому anon тоже).
-- Файлы лежат под случайными нечитаемыми именами — найти их,
-- не зная ссылку, нельзя. На бесплатном тарифе Supabase:
-- всего 1 ГБ, один файл — до 50 МБ.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos read"   on storage.objects;
drop policy if exists "photos write"  on storage.objects;
drop policy if exists "photos delete" on storage.objects;

create policy "photos read" on storage.objects
  for select using (bucket_id = 'photos');
create policy "photos write" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'photos');
create policy "photos delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'photos');


-- ============================================================
-- ШАГ 6. МГНОВЕННЫЕ ОБНОВЛЕНИЯ (REALTIME)
-- ============================================================
-- Чтобы новые события, фото, сердечки и комментарии появлялись
-- у всех сами, без перезагрузки страницы.
do $$
declare t text;
begin
  foreach t in array array['photo_events','photo_items','photo_likes','photo_comments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ПРОВЕРКА -----------------------------------------------------------------
-- Должно быть: все счётчики = 0 (или сколько уже загружено),
-- «Хранилище photos» = true.
select
  (select count(*) from photo_events)   as "Событий",
  (select count(*) from photo_items)    as "Фото и видео",
  (select count(*) from photo_likes)    as "Сердечек",
  (select count(*) from photo_comments) as "Комментариев",
  exists (select 1 from storage.buckets where id = 'photos')
    as "Хранилище photos";
