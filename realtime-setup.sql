-- ============================================================
-- Включение мгновенных обновлений (Realtime) для «Наш 1 «Г»»
-- ============================================================
-- Что это даёт: приложение узнаёт об изменениях в базе сразу,
-- без перезагрузки страницы. Наталья опубликовала объявление —
-- у всех, у кого открыт сайт, оно появится через пару секунд
-- вместе со всплывающей подсказкой.
--
-- Как запустить:
-- 1. Откройте Supabase → ваш проект → SQL Editor → New query.
-- 2. Вставьте ВЕСЬ этот файл целиком и нажмите Run.
-- 3. Внизу появится список таблиц — должно быть 12 строк.
--
-- Файл можно запускать сколько угодно раз — повторный запуск
-- ничего не сломает (уже подключённые таблицы пропускаются).
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'announcements',
    'news_reads',
    'polls',
    'poll_options',
    'poll_votes',
    'schedule_overrides',
    'schedule_lessons',
    'schedule_bells',
    'expense_groups',
    'expenses',
    'receipts',
    'birthdays'
  ]
  LOOP
    -- Пропускаем таблицы, которых нет, и те, что уже подключены
    IF EXISTS (
         SELECT 1 FROM pg_tables
         WHERE schemaname = 'public' AND tablename = t
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Проверка: какие таблицы теперь передают обновления мгновенно
SELECT tablename AS "Таблица с мгновенными обновлениями"
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
