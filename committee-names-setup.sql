-- Полные имена комитета — для кружка-аватара в шапке («НК», «КМ»)
-- Запустить в Supabase: SQL Editor → New query → вставить целиком → Run.
--
-- Зачем: display_name («Наталья», «Кристина») подписывает объявления и задания,
-- менять его нельзя — иначе поедут авторы старых записей. Поэтому фамилия живёт
-- в отдельной колонке full_name, и шапка берёт инициалы уже из неё.

-- 1. Колонка для полного имени
alter table public.user_roles
  add column if not exists full_name text;

-- 2. Полные имена участниц комитета
--    Если фамилия написана не так — поправьте прямо здесь и запустите ещё раз.
update public.user_roles r
   set full_name = 'Кристина Милишкевич'
  from auth.users u
 where u.id = r.user_id
   and lower(u.email) = 'k.milishkevich@gmail.com';

update public.user_roles r
   set full_name = 'Наталья Коваленкова'
  from auth.users u
 where u.id = r.user_id
   and lower(u.email) = 'vrazhevskaya16@gmail.com';

-- 3. У кого фамилии нет — подставляем имя, чтобы аватар не остался пустым
update public.user_roles
   set full_name = display_name
 where (full_name is null or full_name = '')
   and display_name is not null;

-- 4. Контрольная проверка: у каждой учётки своё полное имя
select u.email, r.role, r.display_name, r.full_name
from public.user_roles r
join auth.users u on u.id = r.user_id
order by u.email;
