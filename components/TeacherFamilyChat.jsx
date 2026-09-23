"use client";
import { useEffect, useRef, useState } from "react";
import { sendFamilyMessage, markThreadRead } from "@/lib/supabase";
import { sendManualPush } from "@/lib/push";
import { useRefreshPause } from "@/lib/formGuard";

// ===== Переписка с одной семьёй =====
// Окно открывается поверх кабинета. Слева — что написал родитель,
// справа — что написал учитель. Каждое отправленное сообщение уходит
// родителям пушем: так решено, отдельной галочки «уведомить» больше нет.

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
  open, familyN, familyChild, messages, authorName, side = "teacher", onSent, onClose, toast,
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useRefreshPause(open);

  const thread = (messages || [])
    .filter((m) => m.family_n === familyN)
    .sort((a, b) => (a.created_at || "") < (b.created_at || "") ? -1 : 1);

  // Открыли ветку — значит, прочитали чужие сообщения в ней
  useEffect(() => {
    if (open && familyN) markThreadRead(familyN, side);
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
      // Родителю — пуш; учителю пуши не шлём, он и так в кабинете
      if (fromTeacher) {
        sendManualPush({
          title: "Сообщение от учителя",
          body: body.length > 90 ? body.slice(0, 90) + "…" : body,
          url: "/?tab=dashboard",
          audience: "parents",
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
        <h3>{familyChild || `Семья №${familyN}`}</h3>
        <p className="muted chat-privacy">Видно только вам и этой семье</p>

        <div className="chat-thread">
          {!thread.length && (
            <div className="chat-empty">
              Переписки пока нет. Напишите первое сообщение — родитель увидит его
              на главной и сможет ответить.
            </div>
          )}
          {thread.map((m) => (
            <div key={m.id} className={"chat-msg" + (m.from_teacher ? " mine" : " theirs")}>
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
