"use client";

// ===== Приветственная карточка кабинета учителя =====
// Слева — приветствие и две главные кнопки, справа — пушистый помощник
// с блокнотом (components/TeacherPlush.jsx): моргает, записывает в
// блокнот, а по тапу радуется. Прежний заяц (TeacherMascotRig) удалён
// из проекта 25.09.2026 по решению Кристины.

import TeacherPlush from "./TeacherPlush";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const DAYS = ["воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота"];

// «Среда · 23 сентября» — день недели с заглавной (решение по ТЗ редизайна,
// 28.09.2026): раньше заглавную давал CSS ::first-letter, теперь строка
// приходит готовой и не зависит от поддержки псевдоэлемента.
function fmtToday(iso) {
  const d = new Date(iso + "T12:00:00");
  const day = DAYS[d.getDay()];
  const cap = day.charAt(0).toUpperCase() + day.slice(1);
  return `${cap} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
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
      {/* ТЗ §6: серая календарная иконка, затем день недели и дата.
          Иконка нарисована инлайн-контуром, а не взята из набора 3D-картинок:
          рядом с мелким текстом 12–13 px цветной объёмный значок читается
          как кнопка. currentColor — цвет наследуется от строки. */}
      <div className="greet-date tc-date">
        <svg className="tc-date-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="4"
            stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{fmtToday(todayIso)}</span>
      </div>

      <div className="tc-welcome">
        <div className="tc-welcome-text">
          {/* Осмысленный перенос: обращение — первой строкой, имя — второй */}
          <h1 className="greeting tc-greeting">
            <span className="tc-greet-line">{greetWord()}{name ? "," : "!"}</span>
            {name && <span className="tc-greet-line tc-greet-name">{name}!</span>}
          </h1>
          <p className="tc-sub">Что нужно сообщить классу сегодня?</p>

          {/* Редизайн 28.09.2026 (ТЗ §7): короткие подписи «+ Объявление» /
              «+ Задание» вместо «Создать объявление» / «Записать задание».
              Прежние крупные иконки (рупор и книга) заменены знаком «плюс»,
              как на референсе: плюс — тот же контурный SVG с currentColor,
              а не текстовый символ, чтобы толщина штриха совпадала на
              обеих кнопках. Системные emoji не используются. */}
          <div className="tc-main-btns">
            <button className="tc-btn tc-btn-blue" onClick={onAnnounce}>
              <svg className="tc-btn-ico tc-btn-plus" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 7.5v17M7.5 16h17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Объявление
            </button>
            <button className="tc-btn tc-btn-lav" onClick={onHomework}>
              <svg className="tc-btn-ico tc-btn-plus" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 7.5v17M7.5 16h17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Задание
            </button>
          </div>
        </div>

        {/* Правая колонка — сцена с пушистым помощником. Композиция та же,
            что была у прежнего персонажа: текст слева, маскот справа,
            на планшете и телефоне сцена уходит под текст (см. globals.css). */}
        <TeacherPlush />
      </div>
    </div>
  );
}
