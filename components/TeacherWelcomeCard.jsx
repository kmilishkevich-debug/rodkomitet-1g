"use client";
import TeacherMascotScene from "./TeacherMascotScene";

// ===== Приветственная карточка кабинета учителя =====
// Две самостоятельные части: слева — текст и две главные кнопки,
// справа — отдельная сцена маскота в своей колонке фиксированной ширины.
// Колонка зарезервирована в сетке, поэтому длинное имя переносится
// на новую строку, а не заезжает на персонажа.

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const DAYS = ["воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота"];

// «среда · 23 сентября»
function fmtToday(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// «Доброе утро» до 12, «Добрый день» до 18, дальше «Добрый вечер»
function greetWord() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export default function TeacherWelcomeCard({ name, todayIso, onAnnounce, onHomework }) {
  return (
    <div className="tc-welcome-wrap reveal">
      <div className="greet-date tc-date">{fmtToday(todayIso)}</div>

      <div className="tc-welcome">
        <div className="tc-welcome-text">
          {/* Осмысленный перенос: обращение — первой строкой, имя — второй */}
          <h1 className="greeting tc-greeting">
            <span className="tc-greet-line">{greetWord()}{name ? "," : "!"}</span>
            {name && <span className="tc-greet-line tc-greet-name">{name}!</span>}
          </h1>
          <p className="tc-sub">Что передадим родителям сегодня?</p>

          <div className="tc-main-btns">
            <button className="tc-btn tc-btn-blue" onClick={onAnnounce}>
              Создать объявление
            </button>
            <button className="tc-btn tc-btn-lav" onClick={onHomework}>
              <img src="/icons/icon-book.webp" className="tc-btn-icon" alt="" />
              Записать задание
            </button>
          </div>
        </div>

        <TeacherMascotScene phrase={["Всё важное", "под рукой!"]} />
      </div>
    </div>
  );
}
