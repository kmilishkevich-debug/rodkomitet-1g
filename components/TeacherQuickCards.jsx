"use client";

// ===== Три быстрых действия под приветствием =====
// Каждая карточка открывает форму поверх кабинета — со страницы не уходим,
// после сохранения остаёмся на том же месте.

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
    icon: "/icons/icon-people.webp",
    title: "Написать семье",
    sub: "Лично, только этой семье",
  },
  {
    id: "schedule",
    tone: "lav",
    icon: "/icons/icon-book.webp",
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
          className={"tc-quick-card tone-" + c.tone}
          onClick={() => onPick(c.id)}
        >
          <img src={c.icon} className="tc-quick-icon" alt="" />
          <span className="tc-quick-title">{c.title}</span>
          <span className="tc-quick-sub">{c.sub}</span>
        </button>
      ))}
    </div>
  );
}
