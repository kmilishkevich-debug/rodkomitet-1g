-- Проверка голосов семьи близнецов (строки №2 и №3) во всех голосованиях.
-- Только просмотр: запрос ничего не меняет и не удаляет.
-- Запуск: Supabase → SQL Editor → New query → вставить целиком → Run.

-- 1) Все голоса, отданные со строк №2 и №3
select
  p.question      as "Вопрос",
  v.family_n      as "Со строки №",
  v.child         as "Ребёнок",
  v.choice        as "Ответ",
  v.amount        as "Сумма",
  v.voted_at      as "Когда"
from poll_votes v
join polls p on p.id = v.poll_id
where v.family_n in (2, 3)
order by p.created_at desc, v.voted_at;

-- 2) Голосования, где семья успела проголосовать ДВАЖДЫ (и с №2, и с №3) —
-- если такие есть, напишите мне, дам SQL для аккуратной чистки
select
  p.question              as "Вопрос",
  count(*)                as "Голосов от семьи близнецов"
from poll_votes v
join polls p on p.id = v.poll_id
where v.family_n in (2, 3)
group by p.id, p.question
having count(*) > 1;
