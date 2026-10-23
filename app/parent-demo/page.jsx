"use client";
// Демо карточки «Переписка с учителем» (главная родителя) — только для
// визуальной приёмки на localhost: вход родителя требует семейного кода,
// поэтому вёрстка проверяется здесь на фикстурах. В проде — пустота.
import { useEffect, useState } from "react";
import ParentTeacherCard from "../../components/ParentTeacherCard";

function iso(delta = 0) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function ParentDemoPage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") setOk(true);
  }, []);
  if (!ok) return null;

  const family = { n: 18, child: "Милишкевич Ева" };
  // Непрочитанный ответ учителя с вложением — главный сценарий карточки
  const messages = [
    { id: 1, family_n: 18, from_teacher: false, read_family: true, author: "Кристина Милишкевич", text: "Добрый день! Ева завтра будет после врача.", created_at: iso(-1) + "T15:02:00" },
    { id: 2, family_n: 18, from_teacher: true, read_family: false, author: "Головко В. П.", text: "Хорошо, жду ко второму уроку. Высылаю домашнее задание на завтра.", created_at: `${iso(0)}T08:40:00`,
      files: [{ name: "домашнее-задание.pdf", url: "#", size: 52000, type: "application/pdf" }] },
  ];

  return (
    <main style={{ margin: "0 auto", maxWidth: 680, padding: "28px 24px 56px" }}>
      {/* Основной сценарий: есть непрочитанное от учителя */}
      <ParentTeacherCard
        familyMessages={messages}
        family={family}
        teacherName="Головко Виктория Петровна"
        onOpenChat={() => {}}
        onRetry={() => {}}
      />
      {/* Переписки ещё нет */}
      <ParentTeacherCard
        familyMessages={[]}
        family={family}
        teacherName="Головко Виктория Петровна"
        onOpenChat={() => {}}
        onRetry={() => {}}
      />
      {/* Семья не выбрана */}
      <ParentTeacherCard
        familyMessages={[]}
        family={null}
        teacherName="Головко Виктория Петровна"
        onOpenChat={() => {}}
        onRetry={() => {}}
      />
    </main>
  );
}
