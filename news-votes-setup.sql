-- ============================================================
-- Наш 1 «Г» — Этап «Объявления и голосования».
-- Как запустить: Supabase → ваш проект → SQL Editor → New query →
-- вставить ВЕСЬ этот файл → Run. Выполняется один раз,
-- повторный запуск безопасен (ничего не ломает и не дублирует).
--
-- Что создаётся:
--   1) announcements      — объявления комитета и учителя
--   2) polls              — голосования (4 типа)
--   3) poll_options       — варианты ответов для голосований с выбором
--   4) poll_votes         — голоса семей (одна семья — один голос)
--   5) news_reads         — отметки «прочитано» по объявлениям
--   6) bucket news        — хранилище фото к объявлениям
-- ============================================================

-- 1. Объявления
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_url text,
  pinned boolean not null default false,          -- закреплено сверху ленты
  important boolean not null default false,       -- метка «важное»
  status text not null default 'active' check (status in ('active','archived')),
  author text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 2. Голосования
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text not null default '',
  -- yesno — Да/Нет; single — один вариант; multi — несколько; money — сбор суммы
  type text not null default 'yesno' check (type in ('yesno','single','multi','money')),
  amount numeric,                                  -- сумма для типа «сбор» (с семьи)
  deadline date,                                   -- срок голосования (включительно)
  status text not null default 'open' check (status in ('open','closed','archived')),
  author text not null default '',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text
);

-- 3. Варианты ответов (для single и multi)
create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  title text not null,
  sort int not null default 0
);

-- 4. Голоса семей: одна семья (family_n = номер в списке класса) — один голос
create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  family_n int not null,                           -- номер семьи 1..27
  child text not null default '',                  -- имя ребёнка (для комитета)
  choice text,                                     -- 'yes' | 'no' для Да/Нет; 'agree' | 'no' для сбора
  option_ids jsonb,                                -- массив id вариантов (single/multi)
  amount numeric,                                  -- готовы сдать (для сбора)
  voted_at timestamptz not null default now(),
  unique (poll_id, family_n)
);

-- 5. Отметки «прочитано» по объявлениям
create table if not exists news_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  family_n int not null,
  child text not null default '',
  read_at timestamptz not null default now(),
  unique (announcement_id, family_n)
);

-- 6. Права доступа.
--   Читать могут все (родители без пароля).
--   Создавать/менять объявления и голосования — только вошедшие (комитет, учитель).
--   Голосовать и отмечать «прочитано» могут все — родители пока без паролей;
--   менять и удалять чужие голоса могут только вошедшие.
alter table announcements enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;
alter table news_reads enable row level security;

drop policy if exists "ann read" on announcements;
create policy "ann read" on announcements for select using (true);
drop policy if exists "ann write" on announcements;
create policy "ann write" on announcements for all to authenticated using (true) with check (true);

drop policy if exists "polls read" on polls;
create policy "polls read" on polls for select using (true);
drop policy if exists "polls write" on polls;
create policy "polls write" on polls for all to authenticated using (true) with check (true);

drop policy if exists "poll options read" on poll_options;
create policy "poll options read" on poll_options for select using (true);
drop policy if exists "poll options write" on poll_options;
create policy "poll options write" on poll_options for all to authenticated using (true) with check (true);

drop policy if exists "votes read" on poll_votes;
create policy "votes read" on poll_votes for select using (true);
drop policy if exists "votes insert" on poll_votes;
create policy "votes insert" on poll_votes for insert with check (true);
drop policy if exists "votes manage" on poll_votes;
create policy "votes manage" on poll_votes for update to authenticated using (true) with check (true);
drop policy if exists "votes delete" on poll_votes;
create policy "votes delete" on poll_votes for delete to authenticated using (true);

drop policy if exists "reads read" on news_reads;
create policy "reads read" on news_reads for select using (true);
drop policy if exists "reads insert" on news_reads;
create policy "reads insert" on news_reads for insert with check (true);
drop policy if exists "reads delete" on news_reads;
create policy "reads delete" on news_reads for delete to authenticated using (true);

-- 7. Хранилище фото к объявлениям: смотреть могут все, загружать — вошедшие
insert into storage.buckets (id, name, public)
values ('news', 'news', true)
on conflict (id) do nothing;

drop policy if exists "news read" on storage.objects;
create policy "news read" on storage.objects for select using (bucket_id = 'news');
drop policy if exists "news write" on storage.objects;
create policy "news write" on storage.objects for insert to authenticated with check (bucket_id = 'news');
drop policy if exists "news update" on storage.objects;
create policy "news update" on storage.objects for update to authenticated using (bucket_id = 'news');
drop policy if exists "news delete" on storage.objects;
create policy "news delete" on storage.objects for delete to authenticated using (bucket_id = 'news');

-- Готово! Объявления и голосования появятся в приложении сразу,
-- как только комитет создаст первую запись.
