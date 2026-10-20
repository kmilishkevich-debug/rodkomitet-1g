"use client";
// Демо-страница календаря класса — ТОЛЬКО для визуальной приёмки по ТЗ
// (фиксированное «сегодня» 19.10.2026, собрание 22.10, два ДР 27.10).
// Доступна только на localhost: в проде всегда отвечает «не найдено».
import { useEffect, useState } from "react";
import { ClassCalendar } from "../../components/DashboardTab";

const DEMO_EVENTS = [
  { id: 1, title: "Родительское собрание", on_date: "2026-10-22", time_text: "18:00", place: "кабинет 160" },
];
const DEMO_BDAYS = [
  { id: 1, first: "Ева", last: "Милишкевич", born: "2019-10-27" },
  { id: 2, first: "Ольга", last: "Белоус", born: "2019-10-27" },
];
const DEMO_HOLS = [
  { id: "h1", title: "Осенние каникулы", on_date: "2026-11-02", end_date: "2026-11-06", kind: "vacation", emoji: "🍂" },
  { id: "h2", title: "Новый год", on_date: "2027-01-01", kind: "holiday", emoji: "🎄" },
  { id: "h3", title: "Рождество", on_date: "2027-01-07", kind: "holiday", emoji: "✨" },
];

export default function CalendarDemoPage() {
  // Хост проверяем только после монтирования, чтобы не «утекать» в SSR-разметку
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") setOk(true);
  }, []);
  if (!ok) return null;
  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE4", padding: "28px 0" }}>
      <div style={{ width: 878, maxWidth: "100%", margin: "0 auto", padding: "0 14px" }}>
        <ClassCalendar
          events={DEMO_EVENTS}
          notes={[]}
          bdays={DEMO_BDAYS}
          family={null}
          onTab={() => {}}
          demo={{ today: "2026-10-19", hols: DEMO_HOLS }}
        />
      </div>
    </div>
  );
}
