-- ============================================================
-- Наш 1 «Г» — история посещений приложения (28.09.2026)
--
-- Что делает файл:
--   1) Таблица app_visits — журнал заходов: кто (семья / учитель /
--      комитет), когда вошёл и когда был в последний раз.
--      Хранится 30 дней, старые записи чистятся автоматически.
--   2) Таблица app_families_seen — вечная сводка по семьям:
--      подключалась ли семья хоть раз, последний визит и число заходов.
--      Не чистится никогда — из неё считается «подключилось X из 27».
--   3) Функции record_visit и visit_heartbeat — приложение вызывает их
--      при каждом открытии и раз в ~5 минут («пульс» активности).
--      Функции работают от имени базы (security definer), поэтому
--      писать в таблицы напрямую никому не нужно.
--   4) Права на чтение: ТОЛЬКО комитет. Учитель и родители историю
--      посещений не видят.
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
--
-- ВАЖНО: сначала должен быть запущен schedule-updates-setup.sql
-- (в нём создаётся таблица user_roles — по ней отличаем учителя).
-- ============================================================

-- 1. Журнал заходов (лента событий, живёт 30 дней)
create table if not exists app_visits (
  id         uuid primary key default gen_random_uuid(),
  role       text not null check (role in ('family', 'teacher', 'committee')),
  family_n   int,                        -- номер семьи (только для role = 'family')
  label      text,                       -- имя ребёнка («Гурецкий Роман»)
  started_at timestamptz not null default now(),  -- вошли
  last_seen  timestamptz not null default now()   -- были до ~
);

create index if not exists app_visits_started_idx on app_visits (started_at desc);

-- 2. Вечная сводка по семьям (для счётчика «подключилось X из 27»)
create table if not exists app_families_seen (
  family_n     int primary key,
  child        text,
  first_at     timestamptz not null default now(), -- первый визит
  last_at      timestamptz not null default now(), -- последний визит
  visits_count int not null default 1              -- сколько раз заходили
);

-- 3. Права: читать может только комитет.
--    Комитет — это вошедшие по почте и паролю, у кого в user_roles
--    НЕТ роли «teacher» (так же различает роли само приложение).
alter table app_visits enable row level security;
alter table app_families_seen enable row level security;

drop policy if exists "visits read committee" on app_visits;
create policy "visits read committee" on app_visits
  for select to authenticated
  using (not exists (
    select 1 from user_roles r
    where r.user_id = auth.uid() and r.role = 'teacher'
  ));

drop policy if exists "families seen read committee" on app_families_seen;
create policy "families seen read committee" on app_families_seen
  for select to authenticated
  using (not exists (
    select 1 from user_roles r
    where r.user_id = auth.uid() and r.role = 'teacher'
  ));

-- Писать напрямую не может никто: запись идёт только через функции ниже.

-- 4. Запись визита. Вызывается приложением при каждом открытии.
--    Возвращает id визита — по нему потом обновляется «пульс».
--    Заодно чистит журнал от записей старше 30 дней.
create or replace function record_visit(p_role text, p_family_n int, p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  vid uuid;
begin
  if p_role not in ('family', 'teacher', 'committee') then
    raise exception 'unknown role';
  end if;

  insert into app_visits (role, family_n, label)
  values (p_role, case when p_role = 'family' then p_family_n end, p_label)
  returning id into vid;

  -- Семья зашла — обновляем вечную сводку
  if p_role = 'family' and p_family_n is not null then
    insert into app_families_seen (family_n, child)
    values (p_family_n, p_label)
    on conflict (family_n) do update
      set last_at      = now(),
          visits_count = app_families_seen.visits_count + 1,
          child        = coalesce(excluded.child, app_families_seen.child);
  end if;

  -- Автоочистка ленты: всё старше 30 дней удаляется
  delete from app_visits where started_at < now() - interval '30 days';

  return vid;
end;
$$;

-- 5. «Пульс»: приложение раз в ~5 минут отмечает, что человек ещё внутри.
--    Из last_seen складывается «были до ~20:05».
create or replace function visit_heartbeat(p_visit_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update app_visits set last_seen = now() where id = p_visit_id;
$$;

-- 6. Функции доступны и родителям (anon), и вошедшим (комитет, учитель)
revoke all on function record_visit(text, int, text) from public;
grant execute on function record_visit(text, int, text) to anon, authenticated;

revoke all on function visit_heartbeat(uuid) from public;
grant execute on function visit_heartbeat(uuid) to anon, authenticated;
