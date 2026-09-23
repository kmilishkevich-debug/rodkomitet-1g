"use client";

// ===== Три быстрых действия под приветствием =====
// Композиция как в макете: крупная иконка слева → название и подпись →
// стрелка справа. Кликабельна вся карточка, есть наведение и видимый
// фокус с клавиатуры.
//
// Иконки: «Событие класса» — календарь, «Написать семье» — конверт,
// «Изменить расписание» — календарь с часами. Конверта и календаря
// с часами в проекте пока нет — Кристина их пришлёт. До тех пор стоят
// ближайшие по смыслу; чтобы заменить, достаточно поправить одну
// строчку icon ниже. Книгу с расписания убрали: она означает задания.

const CARDS = [
  {
    id: "event",
    tone: "pink",
    icon: "/icons/icon-calendar.webp",
    title: "Событие класса",
    sub: "Поездка, праздник, собрание",
  },
  {
    id: "note",
    tone: "green",
    icon: "/icons/icon-people.webp", // → заменить на конверт, когда придёт ассет
    title: "Написать семье",
    sub: "Лично, только этой семье",
  },
  {
    id: "schedule",
    tone: "lav",
    icon: "/icons/nav-schedule.webp", // → заменить на календарь с часами
    title: "Изменить расписание",
    sub: "Замена, отмена, другой кабинет",
  },
];

export default function TeacherQuickCards({ onPick }) {
  return (
    <div className="tc-quick reveal d1">
      {CARDS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={"tc-quick-card tone-" + c.tone}
          onClick={() => onPick(c.id)}
        >
          <img src={c.icon} className="tc-quick-icon" alt="" />
          <span className="tc-quick-body">
            <span className="tc-quick-title">{c.title}</span>
            <span className="tc-quick-sub">{c.sub}</span>
          </span>
          <svg className="tc-quick-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
