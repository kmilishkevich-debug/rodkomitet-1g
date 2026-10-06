"use client";
import { useEffect, useRef, useState } from "react";
import { sendFamilyMessage, markThreadRead } from "@/lib/supabase";
import { sendManualPush, sendFamilyChatPush } from "@/lib/push";
import { useRefreshPause } from "@/lib/formGuard";
import { familyNs } from "./data";

// ===== Личная переписка семьи и учителя =====
// Одно окно на двоих, сторона задаётся пропом side:
//   • side="teacher" — учитель в кабинете, «свои» пузыри = от учителя,
//     каждое сообщение уходит адресным пушем только этой семье;
//   • side="parent" — родитель на «Главной», «свои» пузыри = от семьи,
//     сообщение уходит пушем учителю (роут /api/push/family-chat).
// Отдельной галочки «уведомить» нет: отправил — значит, уведомил.

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return hm;
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm}`;
}

export default function TeacherFamilyChat({
  open, familyN, familyChild, messages, authorName, teacherName,
  side = "teacher", onSent, onClose, toast,
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useRefreshPause(open);

  const thread = (messages || [])
    .filter((m) => familyNs(familyN).includes(m.family_n))
    .sort((a, b) => (a.created_at || "") < (b.created_at || "") ? -1 : 1);

  // Открыли ветку — значит, прочитали чужие сообщения в ней
  useEffect(() => {
    if (open && familyN) markThreadRead(familyNs(familyN), side);
  }, [open, familyN, side]);

  // Держим последнее сообщение на виду
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, thread.length]);

  useEffect(() => {
    if (open) setText("");
  }, [open, familyN]);

  if (!open) return null;

  const fromTeacher = side === "teacher";

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await sendFamilyMessage({
        family_n: familyN,
        from_teacher: fromTeacher,
        author: authorName || (fromTeacher ? "Учитель" : "Родитель"),
        text: body,
      });
      setText("");
      onSent?.();
      if (fromTeacher) {
        // Родителю — адресный пуш только этой семье (текст личный!)
        sendManualPush({
          title: "Сообщение от учителя",
          body: body.length > 90 ? body.slice(0, 90) + "…" : body,
          url: "/?tab=dashboard",
          audience: "family",
          familyNs: familyNs(familyN),
        }).catch(() => {});
      } else {
        // Учителю — пуш о сообщении родителя (роут сам ограничит получателя)
        sendFamilyChatPush({
          body: body.length > 90 ? body.slice(0, 90) + "…" : body,
          url: "/",
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      toast?.("Не получилось отправить");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal chat-modal" role="dialog" aria-modal="true">
        <h3>
          {fromTeacher
            ? (familyChild || `Семья №${familyN}`)
            : (teacherName || "Классный руководитель")}
        </h3>
        <p className="muted chat-privacy">
          {fromTeacher ? "Видно только вам и этой семье" : "Видно только вам и учителю"}
        </p>

        <div className="chat-thread">
          {!thread.length && (
            <div className="chat-empty">
              {fromTeacher
                ? "Переписки пока нет. Напишите первое сообщение — родитель увидит его на главной и сможет ответить."
                : "Переписки пока нет. Напишите первое сообщение — учитель увидит его в своём кабинете и сможет ответить."}
            </div>
          )}
          {thread.map((m) => (
            <div
              key={m.id}
              className={
                "chat-msg" +
                ((fromTeacher ? m.from_teacher : !m.from_teacher) ? " mine" : " theirs")
              }
            >
              <div className="chat-bubble">{m.text}</div>
              <div className="chat-meta">
                {m.from_teacher ? (m.author || "Учитель") : "Родитель"} · {fmtTime(m.created_at)}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <textarea
          className="chat-input"
          rows={3}
          placeholder="Напишите сообщение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="actions">
          <button className="btn small" onClick={onClose}>Закрыть</button>
          <button className="btn small primary" onClick={send} disabled={busy || !text.trim()}>
            {busy ? "Отправляем…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
