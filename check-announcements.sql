-- Проверка: что на самом деле лежит в объявлениях
-- Запустить в Supabase: SQL Editor → New query → вставить целиком → Run.
-- Ничего не меняет, только показывает.

-- 1. Последние 20 объявлений: статус, автор, дата
--    Смотрим на колонку status: 'active' — видно в ленте, 'archived' — спрятано в архив.
select
  title            as "Заголовок",
  status           as "Статус",
  important        as "Важное",
  pinned           as "Закреплено",
  teacher_visible  as "Видно учителю",
  author           as "Автор",
  created_at       as "Создано"
from public.announcements
order by created_at desc
limit 20;

-- 2. Сводка: сколько всего, сколько в ленте, сколько в архиве
select
  count(*)                                   as "Всего объявлений",
  count(*) filter (where status = 'active')  as "В ленте",
  count(*) filter (where status = 'archived')as "В архиве",
  count(*) filter (where important)          as "Важных"
from public.announcements;
