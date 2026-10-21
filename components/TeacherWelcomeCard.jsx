"use client";

// ===== Компактное приветствие кабинета учителя =====
// Переработка 21.10.2026 (ТЗ «календарь — центральный блок»):
// блок стал низким (160–180 px на десктопе), из него ушли кнопки
// «Объявление» и «Задание» — они переехали в единую строку быстрых
// действий ниже. Слева — приветствие и одна строка с датой и числом
// уроков («Среда, 21 октября · 5 уроков сегодня»): цифра уроков
// переехала сюда из удалённой полосы «Сегодня в цифрах». Справа —
// тот же пушистый помощник (TeacherPlush), уменьшенный до 155–175 px,
// с облачком: реплику ему по приоритету подбирает TeacherTab.

import TeacherPlush from "./TeacherPlush";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const DAYS = ["воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота"];

// «Среда, 21 октября» — формат из ТЗ 21.10.2026 §6: запятая после дня
// недели (раньше была точка-разделитель «·»).
function fmtToday(iso) {
  const d = new Date(iso + "T12:00:00");
  const day = DAYS[d.getDay()];
  const cap = day.charAt(0).toUpperCase() + day.slice(1);
  return `${cap}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// «Доброе утро» до 12, «Добрый день» до 18, дальше «Добрый вечер»
function greetWord() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

// lessonsLine — готовый хвост строки («5 уроков сегодня» / «выходной»),
// idlePhrase — реплика облачка (массив коротких строк) по приоритету ТЗ §16.
export default function TeacherWelcomeCard({ name, todayIso, lessonsLine, idlePhrase }) {
  return (
    <div className="tc-welcome-wrap reveal">
      <div className="tc-welcome">
        <div className="tc-welcome-text">
          {/* Осмысленный перенос: обращение — первой строкой, имя — второй */}
          <h1 className="greeting tc-greeting">
            <span className="tc-greet-line">{greetWord()}{name ? "," : "!"}</span>
            {name && <span className="tc-greet-line tc-greet-name">{name}!</span>}
          </h1>
          {/* ТЗ §6: одна строка — дата и уроки, без отдельной плашки даты */}
          <p className="tc-dayline">
            <svg className="tc-date-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="4"
                stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>
              {fmtToday(todayIso)}
              {lessonsLine ? <> · <b>{lessonsLine}</b></> : null}
            </span>
          </p>
        </div>

        {/* Справа — сцена с пушистым помощником; на планшете и телефоне
            сцена уходит под текст (см. globals.css). */}
        <TeacherPlush idlePhrase={idlePhrase} />
      </div>
    </div>
  );
}
