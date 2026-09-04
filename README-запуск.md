# Касса класса — как запустить и опубликовать

Проект: Next.js 15, полный перенос прототипа на React-компоненты.
Папка: `D:\CLODE\Родительский комитет`

## Шаг 1. Установка (один раз)

Двойной клик по **`1-install.bat`** — установит зависимости (2–4 минуты).

## Шаг 2. Локальный запуск

Двойной клик по **`2-start-local.bat`** — откроется http://localhost:3000.
Остановить сервер: Ctrl+C в чёрном окне (или просто закрыть окно).

## Шаг 3. GitHub (один раз)

1. Создай пустой репозиторий на github.com → «New repository» → имя **rodkomitet-1g** (без README и .gitignore).
2. В папке проекта открой PowerShell (Shift+ПКМ по папке → «Открыть окно PowerShell здесь») и вставь блок целиком, подставив свой логин GitHub вместо `ТВОЙ_ЛОГИН`:

```powershell
git init
git add .
git commit -m "Касса класса: перенос прототипа на Next.js"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЛОГИН/rodkomitet-1g.git
git push -u origin main
```

## Шаг 4. Vercel (один раз)

Вариант А — через сайт (рекомендую, включит автодеплой):
1. vercel.com → «Add New… → Project» → «Import» рядом с репозиторием **rodkomitet-1g**.
2. Ничего не меняй (Vercel сам определит Next.js) → «Deploy».
3. Через минуту получишь публичную ссылку вида `rodkomitet-1g.vercel.app`.

Вариант Б — через CLI: двойной клик по **`3-deploy-vercel.bat`** (спросит логин при первом запуске).

## Дальше (после каждой правки)

Если подключён GitHub-автодеплой (вариант А), достаточно:

```powershell
git add .
git commit -m "правки"
git push
```

Vercel сам пересоберёт и обновит сайт через ~1 минуту.

## Структура проекта

- `app/page.jsx` — главная страница, всё состояние (роль, вкладки, уведомления, тост, модалка)
- `app/globals.css` — стили из прототипа (перенесены 1-в-1)
- `app/layout.jsx` — шрифты Baloo 2 + Nunito, метаданные
- `components/Art.jsx` — все SVG: спрайт иконок, школа, маскот
- `components/LoginScreen.jsx` — экран входа с демо-ролями
- `components/Header.jsx` — шапка, верхнее меню, панель уведомлений + нижнее меню (мобильное)
- `components/DashboardTab.jsx`, `FeesTab.jsx`, `ExpensesTab.jsx`, `ShoppingTab.jsx`, `VotesTab.jsx`, `HistoryTab.jsx` — вкладки
- `components/UploadModal.jsx` — модалка загрузки чека
