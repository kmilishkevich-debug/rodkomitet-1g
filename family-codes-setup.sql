-- ============================================================
-- Наш 1 «Г» — семейные коды для входа родителей (22.09.2026)
--
-- Что делает файл:
--   1) Создаёт таблицу family_codes (номер семьи, ребёнок, код).
--   2) Прячет её от посторонних: без входа коды прочитать НЕЛЬЗЯ,
--      видит их только вошедший комитет.
--   3) Создаёт функцию verify_family_code — она лишь отвечает
--      «да/нет» на вопрос «подходит ли код к этой семье»,
--      сами коды наружу не отдаёт.
--   4) Записывает 27 кодов (совпадают со списком для Viber).
--
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить ВЕСЬ файл → Run. Повторный запуск безопасен
-- (коды просто перезапишутся теми же значениями).
-- В конце выведется проверка: 27 семей с кодами.
-- ============================================================

-- 1. Таблица кодов
create table if not exists family_codes (
  family_n int primary key,
  child    text not null,
  code     text not null unique
);

-- 2. Защита: включаем RLS и не даём anon читать коды
alter table family_codes enable row level security;

drop policy if exists "codes read committee" on family_codes;
create policy "codes read committee" on family_codes
  for select to authenticated using (true);
-- политики для anon нет вовсе — без входа таблица невидима

-- 3. Проверка кода: security definer, наружу только true/false
create or replace function verify_family_code(p_n int, p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from family_codes
    where family_n = p_n
      and upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-zА-Яа-я0-9]', '', 'g'))
        = upper(regexp_replace(code, '[^A-Za-zА-Яа-я0-9]', '', 'g'))
  );
$$;

revoke all on function verify_family_code(int, text) from public;
grant execute on function verify_family_code(int, text) to anon, authenticated;

-- 4. Сами коды (те же, что в списке для Viber)
insert into family_codes (family_n, child, code) values
  ( 1, 'Белоус Ольга',        'ZND-232'),
  ( 2, 'Богдан Давид',        'CZX-982'),
  ( 3, 'Богдан Ульяна',       'UXG-435'),
  ( 4, 'Гладкая Карина',      'PFK-663'),
  ( 5, 'Горлинская Алёна',    'PYN-333'),
  ( 6, 'Гурецкий Роман',      'RKT-553'),
  ( 7, 'Дашкевич Варвара',    'MJY-244'),
  ( 8, 'Дехтяр Илья',         'XVA-442'),
  ( 9, 'Домашевич Милана',    'YEE-552'),
  (10, 'Дорошенко Арина',     'YJD-977'),
  (11, 'Казнадей Анна',       'CBM-763'),
  (12, 'Кашуба Тимур',        'GXW-724'),
  (13, 'Кнотько София',       'WUX-537'),
  (14, 'Коваленков Тимофей',  'FUJ-582'),
  (15, 'Лаппо Егор',          'WDB-927'),
  (16, 'Левко Арина',         'WDD-467'),
  (17, 'Литош Кирилл',        'NMB-832'),
  (18, 'Милишкевич Ева',      'UEB-649'),
  (19, 'Савчук Доминик',      'CAZ-389'),
  (20, 'Стасько Павел',       'PEY-377'),
  (21, 'Сиссауи Мохаммед',    'BYP-999'),
  (22, 'Сухабок Артём',       'RHR-662'),
  (23, 'Талако Алиса',        'NSB-252'),
  (24, 'Тылецкий Андрей',     'FDV-758'),
  (25, 'Шилкин Артём',        'GWU-286'),
  (26, 'Шило Тимофей',        'HMD-868'),
  (27, 'Шурова Агата',        'EEU-966')
on conflict (family_n) do update
  set child = excluded.child, code = excluded.code;

-- ПРОВЕРКА: должно быть 27 семей с кодами ------------------------------------
select count(*) as "семей с кодами" from family_codes;
