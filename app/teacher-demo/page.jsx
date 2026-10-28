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
import TeacherMessagesTab from "../../components/TeacherMessagesTab";
import { BottomNav } from "../../components/Header";

// ISO-дата со сдвигом в днях от сегодняшнего дня (локальное время)
function iso(delta = 0) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function TeacherDemoPage() {
  const [ok, setOk] = useState(false);
  // Демо-переключение вкладок нижней панели (23.10.2026): «Кабинет» и
  // «Сообщения» живые, остальные кнопки просто подсвечиваются.
  const [tab, setTab] = useState("teacher");
  // ?chat=12 — сразу открыть переписку семьи №12 (скриншоты модалки)
  const [chatN, setChatN] = useState(null);
  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") setOk(true);
    // ?tab=messages — открыть демо сразу на вкладке «Сообщения» (скриншоты)
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab");
    if (t) setTab(t);
    const c = q.get("chat");
    if (c) setChatN(Number(c));
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
  // Фикстуры мини-мессенджера (ТЗ 23.10.2026 §26): непрочитанные с автором
  // и вложением, прочитанная с «Вы:», сообщение без текста (только фото),
  // четвёртая переписка — проверка обрезки до трёх строк на главной.
  const familyMessages = [
    { id: 1, family_n: 3, from_teacher: false, read_teacher: false, author: "Кристина Милишкевич", text: "Добрый день! Ева завтра будет после врача, можно прийти ко второму уроку?", created_at: `${today}T08:10:00` },
    // Семья №7 — витрина нового чата: цитата, стикер, правка, удаление,
    // время прочтения (read_at) и непрочитанный ответ.
    { id: 6, family_n: 7, from_teacher: false, read_teacher: true, author: "Елена Соловьёва", text: "Добрый день! Миша приболел, завтра нас не будет.", created_at: iso(-1) + "T15:12:00" },
    { id: 2, family_n: 7, from_teacher: true, read_teacher: true, read_family: true, author: "Виктория Петровна", text: "Конечно, выздоравливайте!", created_at: iso(-1) + "T15:30:00",
      reply_to: 6, reactions: { family: "❤️" } },
    { id: 7, family_n: 7, from_teacher: false, read_teacher: true, author: "Елена Соловьёва", text: "", sticker: "thanks", created_at: iso(-1) + "T15:33:00" },
    { id: 8, family_n: 7, from_teacher: true, read_family: true, read_at: `${today}T09:30:00`, author: "Виктория Петровна", text: "Передайте Мише, что мы его ждём! Домашнее задание пришлю вечером.", created_at: `${today}T09:12:00` },
    { id: 11, family_n: 7, from_teacher: true, read_family: true, read_at: `${today}T09:30:00`, author: "Виктория Петровна", text: "", sticker: "good-day", created_at: `${today}T09:13:00` },
    { id: 9, family_n: 7, from_teacher: false, read_teacher: true, author: "Елена Соловьёва", text: "", deleted_at: `${today}T09:35:00`, created_at: `${today}T09:34:00` },
    { id: 10, family_n: 7, from_teacher: false, read_teacher: false, author: "Елена Соловьёва", text: "Спасибо большое! Обязательно передам 😊", edited_at: `${today}T09:41:00`, created_at: `${today}T09:40:00` },
    { id: 3, family_n: 12, from_teacher: false, read_teacher: false, author: "Анна К.", text: "И во сколько сбор?", created_at: `${today}T09:04:00`,
      reactions: { teacher: "👍" } },
    { id: 4, family_n: 12, from_teacher: false, read_teacher: false, author: "Анна К.", text: "Подскажите, что взять на экскурсию?", created_at: `${today}T09:05:00`,
      files: [{ name: "список-вещей-для-экскурсии.pdf", url: "#", size: 48211, type: "application/pdf" }, { name: "маршрут.jpg", url: "#", size: 120000, type: "image/jpeg" }] },
    { id: 5, family_n: 5, from_teacher: false, read_teacher: true, author: "Ольга Белоус", text: "", created_at: iso(-9) + "T12:00:00",
      files: [{ name: "фото1.jpg", url: "#", size: 90000, type: "image/jpeg" }, { name: "фото2.jpg", url: "#", size: 91000, type: "image/jpeg" }, { name: "фото3.jpg", url: "#", size: 92000, type: "image/jpeg" }] },
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
      {tab === "messages" && (
        <TeacherMessagesTab
          authorName="Виктория Петровна"
          toast={() => {}}
          familyMessages={familyMessages}
          onReloadMessages={() => {}}
          initialChatN={chatN}
        />
      )}
      {tab !== "messages" && <TeacherTab
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
      />}
      <BottomNav tab={tab} role="teacher" onTab={setTab} msgBadge={2} />
    </main>
  );
}
