"use client";
import TeacherMascotScene from "./TeacherMascotScene";

// ===== Приветственная карточка кабинета учителя =====
// Слева — обращение по имени и две главные кнопки.
// Справа — маскот с облаком; он вылезает за верхний край карточки,
// поэтому карточка ничего не обрезает (overflow: visible).

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const DAYS = ["воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота"];

// «СРЕДА · 23 СЕНТЯБРЯ»
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
          <h1 className="greeting tc-greeting">
            {greetWord()}
            {name ? `, ${name}` : ""}!
          </h1>
          <p className="tc-sub">Что передадим родителям сегодня?</p>

          <div className="tc-main-btns">
            <button className="tc-btn tc-btn-blue" onClick={onAnnounce}>
              Создать объявление
            </button>
            <button className="tc-btn tc-btn-lav" onClick={onHomework}>
              Записать задание
            </button>
          </div>
        </div>

        <TeacherMascotScene phrase="Всё важное под рукой!" />
      </div>
    </div>
  );
}
