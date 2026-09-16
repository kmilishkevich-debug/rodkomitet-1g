-- Имена для персонального приветствия и подписей («Наш 1 «Г»»)
-- Запустить в Supabase: SQL Editor → New query → вставить целиком → Run.
-- Скрипт создаст таблицу user_roles (если её ещё нет) и запишет имена обеих участниц комитета.

-- 1. Таблица ролей и имён
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'committee',
  display_name text
);

-- 2. Доступ: читать может любой вошедший (сайт запрашивает только свою строку),
--    менять данные можно только здесь, через SQL Editor
alter table public.user_roles enable row level security;

drop policy if exists "user_roles read" on public.user_roles;
create policy "user_roles read" on public.user_roles
  for select to authenticated using (true);

-- 3. Имена: Кристина и Наталья
do $$
declare
  v_id uuid;
begin
  -- Кристина
  select id into v_id from auth.users where lower(email) = 'k.milishkevich@gmail.com' limit 1;
  if v_id is not null then
    insert into public.user_roles (user_id, role, display_name)
    values (v_id, 'committee', 'Кристина')
    on conflict (user_id) do update set display_name = 'Кристина', role = 'committee';
  end if;

  -- Наталья Коваленкова
  select id into v_id from auth.users where lower(email) = 'vrazhevskaya16@gmail.com' limit 1;
  if v_id is not null then
    insert into public.user_roles (user_id, role, display_name)
    values (v_id, 'committee', 'Наталья')
    on conflict (user_id) do update set display_name = 'Наталья', role = 'committee';
  end if;
end $$;

-- 4. Контрольная проверка: обе учётки должны показаться с именами
select u.email, r.role, r.display_name
from public.user_roles r
join auth.users u on u.id = r.user_id
order by u.email;
