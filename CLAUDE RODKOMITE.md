# CLAUDE RODKOMITE.md — паспорт проекта «Наш 1 «Г»»

> Этот файл — главный контекст для Claude (Claude Code / Cowork) при работе с проектом.
> Прочитай его целиком перед любыми изменениями. Язык проекта и общения — русский.

---

## 1. Что это за приложение

**«Наш 1 «Г»»** — онлайн-касса и кабинет родительского комитета 1 «Г» класса школы №227 (Минск).
Владелец и заказчик — **Кристина** (семья №18, Милишкевич Ева, член родкомитета).

Приложение решает задачи:

- **Касса класса**: ведомость взносов по 27 семьям, разовые поступления, расходы с чеками, история изменений сумм, фонд ГПД (группы продлённого дня).
- **Информация**: объявления, голосования, расписание уроков и звонков с заменами, дни рождения, список класса.
- **Кабинет учителя**: домашние задания, события класса, заметки, переписка с семьями, обсуждения под публикациями.
- **PWA с пушами**: устанавливается на телефон, присылает уведомления (в т.ч. ежевечерний cron о днях рождения).

Валюта — **BYN** (белорусские рубли). Учебный год считается с сентября по август. Часовой пояс логики — **Минск (UTC+3)**.

Три роли пользователей:

| Роль | Вход | Что видит |
|---|---|---|
| `parent` (родитель) | выбор ребёнка + семейный код (`verifyFamilyCode`) | всё, кроме кабинета учителя |
| `committee` (комитет) | email+пароль Supabase Auth | всё + редактирование денег, объявлений, голосований, рассылки |
| `teacher` (учитель) | email+пароль Supabase Auth | свой кабинет, объявления/голосования с `teacher_visible` или свои; **денег не видит** |

Роль хранится в `localStorage["rk1g-role"]`, семья `{n, child}` — в `localStorage["rk1g-family"]`.

---

## 2. Технологии и команды

- **Next.js ^15.5.2** (app router), **React ^19.1.0**
- **@supabase/supabase-js ^2.45.0** — база данных, auth, storage, realtime
- **web-push ^3.6.7** — пуш-уведомления (VAPID)
- Стилизация — чистый CSS в `app/globals.css` (без Tailwind, без UI-библиотек)
- Алиас импортов: `@/*` → корень проекта (jsconfig.json)
- `next.config.mjs` — пустой; `vercel.json` — только cron: `/api/push/cron` в `0 16 * * *` UTC (= 19:00 Минска)
- **Тестов в проекте нет** (ни unit, ни e2e)

Команды:

```bash
npm install     # зависимости
npm run dev     # локальный запуск (localhost:3000)
npm run build   # прод-сборка (ТОЛЬКО на ПК Кристины, см. §12)
npm run start   # прод-сервер после build
```

---

## 3. Рабочий процесс: два режима (ВАЖНО)

### 3.1. На ПК Кристины (Windows) — обычная работа

- Проект лежит в `D:\CLODE\Родительский комитет`.
- Проверка: `npm run build` перед пушем.
- Bat-файлы в корне (запускает сама Кристина двойным кликом):
  - `1-install.bat` / `1-install-log.bat` — npm install;
  - `2-start-local.bat` — npm run dev + открыть localhost:3000;
  - `3-deploy-vercel.bat` — vercel --prod (обычно не нужен, деплой автоматический);
  - `4-github-push.bat` — git config + push с логом в git-log.txt;
  - `5-push.bat` — git add . + commit "update" + push — **основной способ пуша**;
  - `6-push-only.bat` — только push уже сделанного коммита.

### 3.2. В песочнице Cowork (Claude) — особые правила

- Путь проекта: смонтированная папка `mnt/Родительский комитет` (в разговоре с Кристиной называть «папка проекта», sandbox-пути не показывать).
- **`next build` в песочнице ЗАПРЕЩЁН** (падает/зависает). Проверка синтаксиса вместо сборки:
  ```bash
  npx esbuild --loader:.jsx=jsx components/Файл.jsx > /dev/null
  ```
- **Git**: перед стейджингом обязательно
  ```bash
  export GIT_INDEX_FILE=/tmp/rk-git-index
  git read-tree HEAD
  ```
  затем `git add <конкретные файлы>` и коммит.
- **`*.bat` НЕ коммитить** — в `git status` они постоянно висят как modified (из-за перевода строк), это нормально, игнорировать.
- **Push из песочницы НЕ делать** — пуш выполняет Кристина сама через `5-push.bat` / `6-push-only.bat`. Claude только коммитит (и то по просьбе).
- Сеть песочницы: `supabase.co` заблокирован allowlist'ом — проверить живую базу из песочницы нельзя.
- Инструмент Agent (субагенты) в некоторых сессиях падает с ошибкой схемы — тогда исследовать код напрямую (Bash/Read/Grep).

### 3.3. Деплой

- GitHub: `kmilishkevich-debug/rodkomitet-1g`, ветка `main`.
- Vercel: автодеплой после push, ~1 минута.
- Env-переменная на Vercel: `VAPID_PRIVATE_KEY` (приватный ключ пушей). Публичный ключ — в `lib/pushConfig.js`.
- Ключи Supabase — в **`lib/supabaseConfig.js`** (URL и anon-ключ; они публичные, защита — RLS-правила в базе). Значения смотреть там, в документах не дублировать.

---

## 4. Структура проекта

```
app/
  layout.jsx        — metadata (title «Наш 1 «Г» — школа №227»), themeColor #F6F1E7,
                      Google Fonts (Comfortaa, Nunito, Onest), PwaSetup
  page.jsx          — ЦЕНТР приложения: всё состояние, роутинг вкладок, live-данные (§5)
  globals.css       — вся дизайн-система (~2050 строк, §7)
  api/push/
    send/route.js    — ручная рассылка (только комитет)
    comment/route.js — пуш учителю о сообщении родителя
    cron/route.js    — ежевечерняя рассылка о днях рождения (19:00 Минска)
components/
  data.js           — демо/запасные данные: 27 семей, колонки ведомости, модель взносов (§8)
  FeesTab.jsx       — касса и ведомость взносов (§8), карточки: Общая касса → Ведомость →
                      Фонд ГПД → Разовые поступления → История изменений
  ExpensesTab.jsx   — расходы по группам, чеки (несколько фото на расход)
  MoneyTab.jsx      — обёртка «Деньги»: подвкладки fees | expenses | history (moneySub)
  HistoryTab.jsx    — история изменений
  Dashboard.jsx     — главная (дашборд)
  ScheduleTab.jsx   — расписание уроков/звонков + замены
  ScheduleUpdateModal.jsx — конструктор изменений расписания («Было → станет», черновик/публикация)
  AnnouncementsTab.jsx — объявления (редактор для комитета/учителя)
  VotesTab.jsx      — голосования
  ClassTab.jsx      — список класса, дни рождения
  TeacherTab.jsx + TeacherBoard / TeacherQuickCards / TeacherTodayStats /
    TeacherWelcomeCard / TeacherFamilyChat — кабинет учителя (редизайн 28.09.2026)
  PostChat.jsx      — обсуждения под публикациями (ann/hw/event)
  LoginScreen.jsx   — вход (родитель: ребёнок → семейный код; сотрудники: email+пароль)
  Header.jsx        — верхнее меню + BottomNav (нижнее мобильное), наборы по ролям (§6)
  FamilyPicker.jsx  — выбор семьи, useFamily/loadSeen/saveSeen
  TreasurerMascot.jsx — маскот-казначей с банкой (§9)
  ClassMascot.jsx   — анимированный маскот главной (§9)
  TeacherPlush.jsx  — розовый маскот кабинета учителя (§9)
  Art.jsx, NavIcons.jsx — иконки
  PushSettings.jsx, PwaSetup.jsx — пуши и установка PWA
  birthdaysData.js, scheduleData.js, scheduleOverrides.js — запасные данные
lib/
  supabase.js       — ВСЕ функции работы с базой (~66 функций, 871 строка)
  supabaseConfig.js — URL и anon-ключ Supabase
  push.js / pushServer.js / pushConfig.js — пуши (клиент/сервер/ключ)
  formGuard.js      — пауза фонового обновления при открытой форме, черновики, «Точно закрыть?»
  share.js          — шаринг ссылок (/?tab=votes&poll=ID и т.п.)
public/
  mascot/           — казначей: jar-low|mid|high|full.png, pose-*.png, coin.png, receipt.png
  rk-mascot/        — кадры учительского маскота (1024×1024, якорь низ-центр)
  mascot-*.webp     — части ClassMascot; bubble-*.webp — облачка
  icons/            — объёмные webp-иконки (icon-*, nav-*)
  manifest.json, sw.js, иконки PWA
*.sql               — скрипты создания таблиц Supabase (§10)
*.bat               — сценарии Кристины (§3.1), НЕ коммитить
README-запуск.md    — инструкция Кристины (частично устарела: Baloo 2, ShoppingTab)
НАСТРОЙКА-БАЗЫ.md   — шаги подключения Supabase
```

---

## 5. Архитектура: app/page.jsx — центр всего

`page.jsx` (~700 строк) держит всё состояние:

- **Роль и вход**: `role` (null | parent | committee | teacher), `login()` / `logout()` (localStorage + supabase.auth.signOut + enablePush/syncPushRole). Для комитета/учителя проверяется живая сессия Supabase Auth.
- **Вкладки**: `tab` ∈ dashboard | money | schedule | announcements | votes | class | teacher; внутри money — `moneySub` ∈ fees | expenses | history. Роутинг через URL `/?tab=...` + pushState/popstate. `applyRoute`: у учителя нет денег и «Главной» (редирект в teacher); старые ссылки fees/expenses/history/shopping → money.
- **Live-данные** (каждое `null` = таблица не создана → показываем демо из data.js или скрываем блок): liveGroups (расходы), liveSchedule, liveOverrides, liveAnnouncements, liveReads, livePolls, liveNotes, liveBirthdays, liveHomework, liveEvents, teacherNotes, familyMessages, livePostComments, liveChatClosed.
- **Обновление**: `reloadAll` по focus/visibilitychange и раз в 60 сек; **пауза, если открыта форма** (isFormOpen/onFormsChange из lib/formGuard.js). Realtime-подписка `supabase.channel("rk1g-live")` на 18 таблиц (работает после realtime-setup.sql).
- **Тосты** о новых чужих объявлениях/голосованиях/заменах/ДЗ/событиях/напоминаниях (сравнение known*Ids, автор ≠ authorRef).
- **Бейджи меню**: непросмотренные объявления/голосования (localStorage "rk1g-news-seen"/"rk1g-polls-seen"), notesBadge — невыполненные напоминания с датой ≤ сегодня.
- **Учёт посещений**: recordVisit + visitHeartbeat каждые 5 минут (app_visits, app_families_seen).
- **Экранная клавиатура**: body.kb-open при сжатии visualViewport > 140px.

Принцип отказоустойчивости: **приложение полностью работает без Supabase** — на демо-данных из components/data.js (fallbackFeeData, FAMILIES, EXPENSE_GROUPS, scheduleData и т.д.).

---

## 6. Навигация по ролям (Header.jsx)

- **Родитель / комитет**, верхнее меню: Главная, Объявления, Расписание, Сборы, Расходы, Голосования, Класс, История.
- **Родитель / комитет**, нижнее мобильное (BottomNav): Главная, Голоса, Уроки, Класс + выпадашка денег (Объявления, Сборы, Расходы, История).
- **Учитель**, верхнее: Кабинет, Объявления, Расписание, Голосования, Класс; нижнее: Кабинет, Объявления, Уроки, Класс.

Учитель видит только объявления/голосования с флагом `teacher_visible` или созданные им самим (visibleTo).

---

## 7. Дизайн-система (app/globals.css)

### 7.1. Палитра (cream editorial, :root)

```
--cream:#F4F0E7   фон        --card:#FFFDFA    карточки
--ink:#171717     текст      --muted:#7A766D   вторичный текст
--blue/--teal:#4865D6        --teal-deep:#2E49A8
--gold:#F3D770    --pink:#E8598E   --rose:#F6C5D8
--orange:#F09A4C  --red:#D9534F    --lav:#B6A8E8
--green:#B6CB90   --input:#F2F0EB  --r:24px (радиус)
```

themeColor PWA: `#F6F1E7`. **Чистый белый фон запрещён** арт-дирекшеном.

### 7.2. Типографика

- `--font-display: 'Comfortaa'` — заголовки и суммы денег;
- `--font-ui: 'Onest'` — интерфейс;
- грузятся с Google Fonts в layout.jsx (Comfortaa 500–700, Nunito 400–800, Onest 400–800).
- Деньги — `tabular-nums`, валюта уменьшенным кеглем.

### 7.3. Motion и компоненты

- Токены: `--ease-out-soft`, `--ease-spring`, `--t-micro:.18s`, `--t-base:.42s`.
- Иконки `.ic`/`.icb` — кружки 36px, Lucide-стиль (viewBox 24, stroke 2.2). Но в кабинете учителя и навигации — **объёмные webp-иконки** (public/icons), решение Кристины: не рисовать контурные SVG.
- Логин — split-layout (.login-card 2 колонки, .login-visual с маскотом и облачками-бейджами).
- Анимации: sway, blinky, floaty, twinkle; брейкпоинты @media 900px и 520px; уважать `prefers-reduced-motion`.

### 7.4. Арт-дирекшен «Золотой час»

Настроение: кабинет 166 в вечернем солнце; формула — «Спокойствие родителя, у которого всё под контролем». Палитра арт-документа (#FBF6EC, #2A2B45, #4A5BD4, золото #FFD98A→#F2A93B, розовый #F49AB8, мята #7FC8A9), тени тёплые #B98E5E 12–18%. (В документе указан Baloo 2, в коде фактически Comfortaa — код первичен.)

---

## 8. Логика денег (СЕРДЦЕ ПРИЛОЖЕНИЯ)

### 8.1. Модель взносов (components/data.js)

- Взнос семьи: **200 BYN = 175 (класс) + 25 (фонд ГПД)**. Семьи, чей ребёнок не ходит на ГПД, платят **175** (в авто-колонке «ГПД» у них ноль).
- 27 семей (FAMILIES). На ГПД **не ходят 3**: Дорошенко, Сиссауи, Тылецкий → ходят **24**.
- Колонки ведомости FEE_COLUMNS (8): `paid` «Взнос» (kind **paid**) и 7 удержаний (kind **charge**): `hoz` «Хоз. нужды», `badge` «Бейдж», `gifts` «Подарки (сентябрь)», `ward` «Гардероб», `magnets` «Магнитные значки», `gpd` «ГПД», `books` «Рабочие тетради».
- Точные доли удержаний на семью:
  - HOZ = 1211.32 / 27
  - GIFTS = 921.85 / 27
  - WARD = 198.45 / 27 — **колонка убрана** (isWardColumn): вешалки учтены в хознуждах, иначе задвоение
  - MAGNETS = 6.9
  - GPD_CUT = 25 (только у 24 ходящих)
  - BOOKS = 1250.1 / 27
  - Бейдж 3.85 — вручную у четверых.
- `AUTO_FEE_RULES`: сопоставление групп расходов с колонками по regex — /хоз/→hoz, /подар/→gifts, /гпд/→fixed 25, /тетрад/→books. Функция `applyAutoFees(columns0, rows0, expGroups)` → `{columns, rows, auto}` — подставляет фактические суммы из расходов.
- Опорные константы (сентябрь 2026, из Google-таблицы «Родительский комитет 1 Г»): TOTAL_COLLECTED=5312.40, TOTAL_SPENT=3914.79, FEE_ONLY_DEDUCTIONS=15.40, FAMILIES_COUNT=27, GPD_FUND_FEE=25, GPD_FUND_COLLECTED=675.00, GPD_FUND_SPENT=338.32, GPD_FUND_REST=336.68, GPD_FUND_CHARGE=338.32/26.

### 8.2. Формулы кассы (FeesTab.jsx)

```
totalPaid    = Σ totals колонок kind === "paid"        (взносы семей)
oneOffTotal  = Σ разовых поступлений
cashCollected = round2(totalPaid + oneOffTotal)         (собрано всего)
cashSpent     = totalCharges                            (потрачено)
cashLeft      = собрано − потрачено
mascotGoal    = round2(Σ r.target по семьям)            (живая цель банки: 200 или 175 на семью)
```

- Банка казначея: `<TreasurerMascot collected={totalPaid} goal={mascotGoal} />` — **без разовых поступлений** (принципиально: банка показывает только взносы).
- Фонд ГПД: 25 BYN фикс с 24 детей; удержание gpdCharge = расходы ГПД / число детей; отдельный список детей — таблица gpd_fund_children.
- **Любая правка суммы в ведомости пишется в журнал** (addFeeEdit → fee_edits_log) — карточка «История изменений».
- В таблице ведомости **закреплены колонки «№ + Ребёнок»** (sticky, коммит 21875a1).
- Модалки: CellModal (правка ячейки), OneOffModal (разовое поступление), GpdPaidModal (оплата ГПД).

---

## 9. Маскоты (все утверждены Кристиной)

1. **TreasurerMascot** (казначей с банкой, вкладка «Сборы»):
   - `computeProgress(collected, goal)` → `{pct: Math.max(0,(c/g)*100), full}` — **без обрезки сверху**: если собрано больше цели, показывается честный % > 100 (текст `Math.floor(pct)%`, полоска `Math.min(100,pct)`).
   - Стадии банки stageFor: пороги 25/70/100 → слои jar-low|mid|high|full.png + позы pose-*.png (public/mascot).
   - События анимации через `notifyTreasurer(...)` → CustomEvent "tm-event" (монетка, чек и т.д.).
   - MASCOT_GOAL=5400 остался запасным default, реальная цель — mascotGoal из ведомости.
2. **ClassMascot** (главная): растровые части WebP + SVG-риг (глаза, рот); дыхание CSS, моргание 4–8 с, взгляд 8–14 с, наклон 15–25 с, стакан 25–40 с; busy-замок; два жёлтых облачка постоянно; prefers-reduced-motion.
3. **TeacherPlush** (кабинет учителя): розовый маскот с блокнотом; кадры public/rk-mascot нормализованы 1024×1024 (рост 940, ступни y=1000, якорь низ-центр); rm-base.webp + rm-blink.webp.
   - Прежний заяц **TeacherMascotRig удалён 25.09.2026 по решению Кристины — НЕ возвращать**.

---

## 10. База данных Supabase

Подключение: `lib/supabaseConfig.js` (URL + anon-ключ). Флаг `isLive` в lib/supabase.js. Хранилище файлов: bucket `receipts` (чеки, фото объявлений).

Все таблицы и создающие их SQL-файлы (лежат в корне проекта):

| SQL-файл | Таблицы |
|---|---|
| supabase-setup.sql | expense_groups, expenses (+ bucket receipts) |
| fees-setup.sql | fee_columns, fee_rows, fee_values |
| fees2-setup.sql | fee_campaigns, campaign_payments, one_off_incomes, fee_edits_log |
| gpd-fund-setup.sql | gpd_fund_children |
| gpd-notes-setup.sql | child_notes |
| birthdays-setup.sql | birthdays |
| names-setup.sql, schedule-updates-setup.sql | user_roles |
| news-votes-setup.sql | announcements, polls, poll_options, poll_votes, news_reads |
| post-comments-setup.sql | post_comments, post_chat_closed |
| push-setup.sql | push_subscriptions, push_log |
| schedule-setup.sql | schedule_bells, schedule_lessons |
| schedule-updates-setup.sql | schedule_overrides, schedule_history |
| teacher-cabinet-setup.sql | family_messages |
| teacher-setup.sql | homework, class_events |
| visits-setup.sql | app_visits, app_families_seen |
| (в составе других) | family_codes, family_notes |
| realtime-setup.sql | включает realtime-подписки на 18 таблиц |
| Прочие корректирующие | merge-fees.sql, fees-fix-sverka.sql, fees-gpd-fix.sql, check-announcements.sql, committee-names-setup.sql, teacher-hide-news-setup.sql |

Вся работа с базой — только через функции `lib/supabase.js` (fetchFees, saveFeeValue, addOneOffIncome, addFeeEdit, fetchGpdFund, saveGpdPaid, fetchAnnouncements, savePoll, castVote, sendFamilyMessage, uploadReceipt, recordVisit и ещё ~50). Новые обращения к базе добавлять туда же, по тому же стилю (каждая функция устойчива к отсутствию таблицы → возвращает null).

Статусы сущностей: объявления — active; голосования — open/closed (pollState); замены расписания — draft/published.

---

## 11. ЧТО НЕЛЬЗЯ МЕНЯТЬ без явного согласия Кристины

1. **Модель взносов 200 / 175 / 25 BYN** и точные доли удержаний (§8.1).
2. **Маскот-казначей с банкой** и его механика: банка считает **только взносы (totalPaid), без разовых поступлений**; цель — живая Σ норм по семьям; честный процент выше 100.
3. **Журнал правок сумм** (addFeeEdit / fee_edits_log) — каждая правка ведомости логируется.
4. **Закреплённые (sticky) колонки «№ + Ребёнок»** в ведомости.
5. **Валюта BYN** и **русский язык интерфейса**.
6. **Объёмные webp-иконки** в кабинете учителя/навигации (не заменять контурными SVG).
7. **Удалённый TeacherMascotRig (заяц)** — не возвращать.
8. Утверждённая дизайн-система: палитра cream, Comfortaa/Onest, радиус 24px, запрет чисто-белого фона, арт-дирекшен «Золотой час».
9. Структура навигации по ролям и отсутствие денег у учителя.

Любое изменение из этого списка — сначала спросить Кристину.

---

## 12. Актуальное состояние и незавершённое (на 30.09.2026)

- **Коммит `6d7097b` «Банка казначея: живая цель из норм по семьям и честный процент выше 100» сделан, но НЕ запушен** (origin/main = `21875a1`). Пуш делает Кристина через 5-push.bat / 6-push-only.bat.
- **Неизвестен статус запуска части SQL-файлов в Supabase** (gpd-fund-setup.sql, post-comments-setup.sql, fees-gpd-fix.sql и др.) — перед опорой на соответствующие таблицы сверить с Кристиной, запущены ли скрипты; код к отсутствию таблиц устойчив (null → демо/скрытие).
- README-запуск.md частично устарел (упоминает шрифт Baloo 2 и удалённый ShoppingTab).
- В git status постоянно висят modified `*.bat` — это не изменения, не коммитить.

Недавние крупные переделки (для контекста, всё уже в коде):
- редизайн кабинета учителя 28.09.2026 (TeacherTodayStats, объёмные иконки);
- закреплённые столбцы ведомости (21875a1);
- несколько чеков на один расход (c98a6c1);
- модель фонда ГПД (8d48ba3, 013955e);
- банка казначея с живой целью (6d7097b).

---

## 13. Правила работы Claude в этом проекте

1. Общение с Кристиной — **по-русски, прозой**, без лишних списков.
2. Внутренние пути песочницы не показывать — говорить «папка проекта».
3. Перед правкой компонента — читать его целиком; после правки — проверять `npx esbuild --loader:.jsx=jsx ...` (в песочнице) или `npm run build` (на ПК).
4. Коммитить только по просьбе, осмысленными русскими сообщениями; **не пушить** (см. §3.2).
5. Не запускать `next build` в песочнице.
6. Демо-данные в data.js и живая база должны не противоречить друг другу: при изменении модели взносов обновлять оба слоя.
7. Помнить про formGuard: любые новые формы оборачивать в его механику (пауза обновления, черновики, подтверждение закрытия).
8. Новые таблицы — отдельным SQL-файлом в корне + функции в lib/supabase.js с фолбэком на null.
