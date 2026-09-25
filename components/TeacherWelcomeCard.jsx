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
          <p className="tc-sub">Что передадим родителям сегодня?</p>

          {/* ТЗ §7: у обеих кнопок крупная иконка — белый рупор на синей
              заливке и синяя раскрытая книга на сиреневой. В наборе
              /public/icons таких вариантов нет (там объёмные цветные
              картинки, которые не бывают белыми), поэтому обе иконки
              нарисованы контуром прямо здесь и берут цвет от кнопки
              через currentColor. Системные emoji не используются. */}
          <div className="tc-main-btns">
            <button className="tc-btn tc-btn-blue" onClick={onAnnounce}>
              <svg className="tc-btn-ico" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M24.4 5.6v20.8c0 1.05-1.21 1.65-2.05 1.01l-5.38-4.18a4.8 4.8 0 0 0-2.94-1.01H8.4A3.4 3.4 0 0 1 5 18.82v-5.64A3.4 3.4 0 0 1 8.4 9.78h5.63a4.8 4.8 0 0 0 2.94-1.01l5.38-4.18c.84-.64 2.05-.04 2.05 1.01Z" fill="currentColor" />
                <path d="M11.2 22.4v3.1a2.9 2.9 0 0 0 5.8 0" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
                <path d="M27.6 12.5a5.6 5.6 0 0 1 0 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
              </svg>
              Создать объявление
            </button>
            <button className="tc-btn tc-btn-lav" onClick={onHomework}>
              <svg className="tc-btn-ico" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 9.4C13.6 7.3 10.6 6.3 6.7 6.2A1.6 1.6 0 0 0 5 7.8v14.5c0 .87.7 1.58 1.56 1.6 3.66.09 6.45 1 9.44 3.2 2.99-2.2 5.78-3.11 9.44-3.2A1.6 1.6 0 0 0 27 22.3V7.8a1.6 1.6 0 0 0-1.7-1.6C21.4 6.3 18.4 7.3 16 9.4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M16 9.4v17.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Записать задание
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
