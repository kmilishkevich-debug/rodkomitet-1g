-- ============================================================
--  Скрываем объявления и голосования комитета от классного руководителя
--  Приложение «Наш 1 "Г"» · школа №227
-- ------------------------------------------------------------
--  Что делает скрипт:
--   1) добавляет колонку teacher_visible в announcements и polls
--      (по умолчанию false — значит все УЖЕ существующие записи
--       сразу становятся невидимыми для учителя);
--   2) помечает teacher_visible = true у записей, которые создала
--      сама учительница (она должна видеть своё);
--   3) переписывает правила доступа (RLS) так, чтобы сервер вообще
--      не отдавал её аккаунту чужие объявления и голосования.
--
--  Родителей это НЕ затрагивает: они входят по семейному коду,
--  для базы они «аноним» (auth.uid() пустой) — проверка для них
--  всегда истинна.
--
--  Как запускать: Supabase → SQL Editor → вставить целиком → Run.
--  Скрипт безопасно запускать повторно.
-- ============================================================

-- ---------- ШАГ 1. Новые колонки ----------

alter table public.announcements
  add column if not exists teacher_visible boolean not null default false;

alter table public.polls
  add column if not exists teacher_visible boolean not null default false;

comment on column public.announcements.teacher_visible is
  'true — объявление видно классному руководителю. По умолчанию false.';
comment on column public.polls.teacher_visible is
  'true — голосование видно классному руководителю. По умолчанию false.';

-- ---------- ШАГ 2. Свои записи учителя оставляем видимыми ----------

update public.announcements a
set teacher_visible = true
where teacher_visible = false
  and a.author in (select display_name from public.user_roles where role = 'teacher');

update public.polls p
set teacher_visible = true
where teacher_visible = false
  and p.author in (select display_name from public.user_roles where role = 'teacher');

-- ---------- ШАГ 3. Общая функция проверки ----------
-- Возвращает true, если текущему пользователю запись показывать можно.
-- Аноним (родитель по семейному коду) и комитет видят всё.
-- Учитель видит только помеченные teacher_visible или свои собственные.

create or replace function public.class_news_visible(
  p_teacher_visible boolean,
  p_author text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then true
    when not exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'teacher'
    ) then true
    else coalesce(p_teacher_visible, false)
      or p_author is not distinct from (
        select ur.display_name from public.user_roles ur where ur.user_id = auth.uid()
      )
  end;
$$;

grant execute on function public.class_news_visible(boolean, text) to anon, authenticated;

-- ---------- ШАГ 4. Правила доступа: объявления ----------
-- Важно: старая политика «ann write» была FOR ALL и тем самым разрешала
-- вошедшему пользователю ещё и читать всё. Разбиваем её на три отдельные.

drop policy if exists "ann read" on public.announcements;
create policy "ann read" on public.announcements
  for select using (class_news_visible(teacher_visible, author));

drop policy if exists "ann write" on public.announcements;
drop policy if exists "ann insert" on public.announcements;
create policy "ann insert" on public.announcements
  for insert to authenticated with check (true);
drop policy if exists "ann update" on public.announcements;
create policy "ann update" on public.announcements
  for update to authenticated using (true) with check (true);
drop policy if exists "ann delete" on public.announcements;
create policy "ann delete" on public.announcements
  for delete to authenticated using (true);

-- ---------- ШАГ 5. Правила доступа: голосования ----------

drop policy if exists "polls read" on public.polls;
create policy "polls read" on public.polls
  for select using (class_news_visible(teacher_visible, author));

drop policy if exists "polls write" on public.polls;
drop policy if exists "polls insert" on public.polls;
create policy "polls insert" on public.polls
  for insert to authenticated with check (true);
drop policy if exists "polls update" on public.polls;
create policy "polls update" on public.polls
  for update to authenticated using (true) with check (true);
drop policy if exists "polls delete" on public.polls;
create policy "polls delete" on public.polls
  for delete to authenticated using (true);

-- ---------- ШАГ 6. Варианты ответов и голоса ----------
-- Чтобы через варианты («Виктория Петровна…») ничего не утекло,
-- закрываем их по тому же правилу — через родительское голосование.

drop policy if exists "poll options read" on public.poll_options;
create policy "poll options read" on public.poll_options
  for select using (
    exists (
      select 1 from public.polls p
      where p.id = poll_options.poll_id
        and class_news_visible(p.teacher_visible, p.author)
    )
  );

drop policy if exists "poll options write" on public.poll_options;
drop policy if exists "poll options insert" on public.poll_options;
create policy "poll options insert" on public.poll_options
  for insert to authenticated with check (true);
drop policy if exists "poll options update" on public.poll_options;
create policy "poll options update" on public.poll_options
  for update to authenticated using (true) with check (true);
drop policy if exists "poll options delete" on public.poll_options;
create policy "poll options delete" on public.poll_options
  for delete to authenticated using (true);

drop policy if exists "votes read" on public.poll_votes;
create policy "votes read" on public.poll_votes
  for select using (
    exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id
        and class_news_visible(p.teacher_visible, p.author)
    )
  );

-- ---------- ШАГ 7. Проверка ----------
-- Ожидаем: «Скрыто от учителя» — это все объявления комитета,
-- «Видно учителю» — только её собственные записи (сейчас обычно 0).

select
  (select count(*) from public.announcements where teacher_visible) as "Объявления: видно учителю",
  (select count(*) from public.announcements where not teacher_visible) as "Объявления: скрыто",
  (select count(*) from public.polls where teacher_visible) as "Голосования: видно учителю",
  (select count(*) from public.polls where not teacher_visible) as "Голосования: скрыто",
  (select count(*) from public.user_roles where role = 'teacher') as "Учителей";
