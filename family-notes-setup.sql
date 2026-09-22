-- ============================================================
-- Наш 1 «Г» — личные заметки и напоминания семей (22.09.2026)
--
-- Что делает файл:
--   1) Создаёт таблицу family_notes: заметки и напоминания,
--      привязанные к номеру семьи (family_n, как в списке класса).
--      Комитет может отправить семье напоминание — у него будет
--      пометка «от комитета» (from_committee = true).
--   2) Открывает доступ по общей модели приложения (как у
--      голосований и отметок о прочтении): читать и писать
--      может любой вошедший в приложение.
--   3) Подключает таблицу к мгновенным обновлениям (Realtime),
--      чтобы напоминание от комитета появлялось у семьи сразу.
--
-- Выполненные заметки старше 7 дней приложение чистит само.
--
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- В конце выведется проверка: таблица и число заметок в ней.
-- ============================================================

-- 1. Таблица заметок
create table if not exists family_notes (
  id             uuid primary key default gen_random_uuid(),
  family_n       int not null,            -- номер семьи из списка класса (1–27)
  text           text not null,           -- текст заметки или напоминания
  remind_date    date,                    -- дата напоминания (пусто = простая заметка)
  done           boolean not null default false,  -- выполнено
  done_at        timestamptz,             -- когда отметили выполненной
  from_committee boolean not null default false,  -- напоминание от комитета
  author         text,                    -- кто отправил (для «от комитета»)
  created_at     timestamptz not null default now()
);

create index if not exists family_notes_family_idx on family_notes (family_n);

-- 2. Доступ — по общей модели приложения (как poll_votes и news_reads)
alter table family_notes enable row level security;

drop policy if exists "notes read all"   on family_notes;
drop policy if exists "notes insert all" on family_notes;
drop policy if exists "notes update all" on family_notes;
drop policy if exists "notes delete all" on family_notes;

create policy "notes read all"   on family_notes for select to anon, authenticated using (true);
create policy "notes insert all" on family_notes for insert to anon, authenticated with check (true);
create policy "notes update all" on family_notes for update to anon, authenticated using (true);
create policy "notes delete all" on family_notes for delete to anon, authenticated using (true);

-- 3. Мгновенные обновления (Realtime) — как в realtime-setup.sql
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'family_notes'
  ) then
    alter publication supabase_realtime add table public.family_notes;
  end if;
end $$;

-- ПРОВЕРКА: таблица создана, заметок пока 0 --------------------------------
select 'family_notes' as "Таблица", count(*) as "Заметок" from family_notes;
