-- Имена для персонального приветствия и подписей («Наш 1 «Г»»)
-- Запустить в Supabase: SQL Editor → New query → вставить целиком → Run.
-- Скрипт сам проверит, есть ли записи в user_roles, и добавит/обновит их.

do $$
declare
  v_id uuid;
begin
  -- Кристина
  select id into v_id from auth.users where lower(email) = 'k.milishkevich@gmail.com' limit 1;
  if v_id is not null then
    if exists (select 1 from public.user_roles where user_id = v_id) then
      update public.user_roles set display_name = 'Кристина', role = 'committee' where user_id = v_id;
    else
      insert into public.user_roles (user_id, role, display_name) values (v_id, 'committee', 'Кристина');
    end if;
  end if;

  -- Наталья Коваленкова
  select id into v_id from auth.users where lower(email) = 'vrazhevskaya16@gmail.com' limit 1;
  if v_id is not null then
    if exists (select 1 from public.user_roles where user_id = v_id) then
      update public.user_roles set display_name = 'Наталья', role = 'committee' where user_id = v_id;
    else
      insert into public.user_roles (user_id, role, display_name) values (v_id, 'committee', 'Наталья');
    end if;
  end if;
end $$;

-- Контрольная проверка: обе учётки должны показаться с именами
select u.email, r.role, r.display_name
from public.user_roles r
join auth.users u on u.id = r.user_id
order by u.email;
