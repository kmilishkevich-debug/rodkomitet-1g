-- ============================================================
-- Наш 1 «Г» — реакции на объявления (28.10.2026)
--
-- Что это: под каждым объявлением (новости от учителя и комитета)
-- семьи и учитель могут поставить эмодзи-реакцию — как на
-- сообщения в переписке и обсуждениях.
--
-- Как хранится: колонка reactions jsonb в announcements,
-- ключ — участник ("t" — учитель, "f18" — семья №18),
-- значение — эмодзи: {"t":"❤️","f18":"👍"}.
--
-- Почему через функцию, а не прямым UPDATE: родители заходят без
-- пароля (anon), а право UPDATE на announcements позволило бы
-- переписать сам текст объявления. Функция set_announcement_reaction
-- работает от имени владельца (security definer) и меняет ТОЛЬКО
-- реакции, проверяя ключ и эмодзи из разрешённого списка.
--
-- Как запустить: Supabase → проект rodkomitet-1g → SQL Editor →
-- New query → вставить ВЕСЬ файл → Run. Повторный запуск безопасен.
-- ============================================================

-- 1. Колонка с реакциями
alter table announcements
  add column if not exists reactions jsonb;

-- 2. Защищённая функция: поставить/заменить/убрать свою реакцию
create or replace function set_announcement_reaction(p_id uuid, p_key text, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cur jsonb;
begin
  -- Ключ — только "t" (учитель) или "f<номер семьи>"
  if p_key !~ '^(t|f[0-9]{1,3})$' then
    raise exception 'недопустимый ключ реакции';
  end if;
  -- Эмодзи — только из набора приложения (null = убрать реакцию)
  if p_emoji is not null
     and p_emoji not in ('❤️','👍','😊','😂','😮','🙏') then
    raise exception 'недопустимая реакция';
  end if;

  select coalesce(reactions, '{}'::jsonb) into cur
  from announcements where id = p_id for update;
  if not found then
    return; -- объявление уже удалено — тихо выходим
  end if;

  if p_emoji is null then
    cur := cur - p_key;
  else
    cur := jsonb_set(cur, array[p_key], to_jsonb(p_emoji), true);
  end if;

  update announcements
  set reactions = case when cur = '{}'::jsonb then null else cur end
  where id = p_id;
end $fn$;

revoke all on function set_announcement_reaction(uuid, text, text) from public;
grant execute on function set_announcement_reaction(uuid, text, text) to anon, authenticated;


-- ============================================================
-- ПРОВЕРКА: первая строка — «reactions | announcements»,
-- вторая — «set_announcement_reaction | true»
-- ============================================================
select column_name as "Колонка", table_name as "Таблица"
from information_schema.columns
where column_name = 'reactions' and table_name = 'announcements';

select p.proname as "Функция", true as "Создана"
from pg_proc p
where p.proname = 'set_announcement_reaction';
