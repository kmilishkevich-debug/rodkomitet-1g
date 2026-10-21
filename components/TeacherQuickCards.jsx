"use client";

// ===== Единая строка быстрых действий кабинета учителя =====
// Переработка 21.10.2026 (ТЗ §7): пять действий в ОДНУ строку сразу под
// компактным приветствием. Сюда переехали «Объявление» и «Задание» из
// приветствия; «Объявление» — главная синяя кнопка, остальные четыре —
// светлые. Высота кнопок 56–60 px, иконки 28–32 px, радиус 16 px —
// заметно компактнее прежних карточек 108 px: строка должна читаться
// как панель инструментов, а не как ряд плиток.
//
// Иконки — фирменные объёмные webp из /public/icons: мегафон (сгенерирован
// 21.10.2026 тем же пайплайном, что и набор календаря), книга, календарь,
// конверт, календарь с часами.

const CARDS = [
  {
    id: "ann",
    tone: "blue",
    icon: "/icons/icon-megaphone.webp",
    title: "Объявление",
  },
  {
    id: "hw",
    tone: "soft",
    icon: "/icons/icon-book.webp",
    title: "Задание",
  },
  {
    id: "event",
    tone: "soft",
    icon: "/icons/icon-calendar.webp",
    title: "Событие",
  },
  {
    id: "note",
    tone: "soft",
    icon: "/icons/icon-envelope.webp",
    title: "Написать семье",
  },
  {
    id: "schedule",
    tone: "soft",
    icon: "/icons/icon-calendar-clock.webp",
    title: "Изменить расписание",
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
          <span className="tc-quick-title">{c.title}</span>
        </button>
      ))}
    </div>
  );
}
