"use client";
// Демо-страница кабинета учителя — ТОЛЬКО для визуальной приёмки
// переработки 21.10.2026 (вход в реальный кабинет требует пароля, поэтому
// вёрстка проверяется здесь на фикстурах). Доступна только на localhost:
// в проде страница всегда отвечает пустотой.
//
// Даты фикстур считаются от реального «сегодня» (TeacherTab сам берёт
// minskIso()), чтобы «Завтра событие», счётчики и приглушение прошедших
// дней рождения показывались как в жизни.
import { useEffect, useState } from "react";
import TeacherTab from "../../components/TeacherTab";

// ISO-дата со сдвигом в днях от сегодняшнего дня (локальное время)
function iso(delta = 0) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function TeacherDemoPage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") setOk(true);
  }, []);
  if (!ok) return null;

  const today = iso(0);
  const y = Number(today.slice(0, 4));
  const m = today.slice(5, 7); // текущий месяц для дней рождения

  const events = [
    { id: 1, title: "Родительское собрание", on_date: iso(1), time_text: "18:00", place: "кабинет 160" },
    { id: 2, title: "Экскурсия в музей", on_date: iso(9), time_text: "10:00", place: "сбор у школы" },
  ];
  const homework = [
    { id: 1, on_date: today, text: "Прописи, с. 14 — дописать строку", bring: null },
    { id: 2, on_date: iso(1), text: "Математика: счёт до 10, рабочая тетрадь с. 8", bring: "цветные карандаши" },
    { id: 3, on_date: iso(1), text: "Выучить стихотворение про осень", bring: null },
  ];
  const announcements = [
    { id: 1, status: "active", author: "Виктория Петровна", important: true, title: "Фотографирование класса в пятницу", body: "Приходим в парадной форме, начало в 9:00." },
    { id: 2, status: "active", author: "Виктория Петровна", important: false, title: "Сбор на рабочие тетради", body: "До конца недели, подробности у родительского комитета." },
  ];
  const familyMessages = [
    { id: 1, family_n: 3, from_teacher: false, read_teacher: false, text: "Добрый день! Ева завтра будет после врача, можно прийти ко второму уроку?", created_at: "2026-10-21T08:10:00" },
    { id: 2, family_n: 7, from_teacher: true, read_teacher: true, text: "Конечно, выздоравливайте!", created_at: "2026-10-20T15:30:00" },
    { id: 3, family_n: 12, from_teacher: false, read_teacher: false, text: "Подскажите, что взять на экскурсию?", created_at: "2026-10-21T09:05:00" },
  ];
  // Дни рождения: прошедший в этом месяце (приглушён), сегодняшний,
  // два будущих в один день — и один в другом месяце (не попадает в блок).
  const birthdays = [
    { id: 1, first: "Мирон", last: "Казак", born: `${y - 7}-${m}-05` },
    { id: 2, first: "София", last: "Лебедева", born: `${y - 7}-${today.slice(5)}` },
    { id: 3, first: "Ева", last: "Милишкевич", born: `${y - 7}-${m}-27` },
    { id: 4, first: "Ольга", last: "Белоус", born: `${y - 7}-${m}-27` },
    { id: 5, first: "Тимур", last: "Волков", born: `${y - 7}-12-03` },
  ];

  return (
    <main style={{ margin: "0 auto", padding: "28px 24px 56px" }}>
      <TeacherTab
        authorName="Виктория Петровна"
        greetingName="Виктория Петровна"
        toast={() => {}}
        onTab={() => {}}
        homework={homework}
        events={events}
        announcements={announcements}
        familyMessages={familyMessages}
        schedule={null}
        overrides={[]}
        birthdays={birthdays}
        postComments={null}
        chatClosed={false}
        onReload={() => {}}
        onReloadMessages={() => {}}
      />
    </main>
  );
}
