"use client";
import { useEffect, useRef, useState } from "react";
import { sendFamilyMessage, markThreadRead, setMessageReaction } from "@/lib/supabase";
import { sendManualPush, sendFamilyChatPush } from "@/lib/push";
import { useRefreshPause } from "@/lib/formGuard";
import { familyNs } from "./data";
import { AttachPicker, AttachList } from "./Attachments";

// ===== Личная переписка семьи и учителя =====
// Одно окно на двоих, сторона задаётся пропом side:
//   • side="teacher" — учитель в кабинете, «свои» пузыри = от учителя,
//     каждое сообщение уходит адресным пушем только этой семье;
//   • side="parent" — родитель на «Главной», «свои» пузыри = от семьи,
//     сообщение уходит пушем учителю (роут /api/push/family-chat).
// Отдельной галочки «уведомить» нет: отправил — значит, уведомил.

// Набор реакций (23.10.2026): шесть эмодзи, как в привычных мессенджерах.
// У каждой стороны не больше одной реакции на сообщение; повторный тап
// по той же — убирает её.
const REACTIONS = ["❤️", "👍", "😊", "😂", "😮", "🙏"];

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
  const [files, setFiles] = useState([]); // вложения: фото, документы, скрины
  const [busy, setBusy] = useState(false);
  const [reactFor, setReactFor] = useState(null); // id сообщения с открытым выбором реакции
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
    if (open) { setText(""); setFiles([]); setReactFor(null); }
  }, [open, familyN]);

  if (!open) return null;

  const fromTeacher = side === "teacher";
  // Ключ своей стороны в reactions: {"teacher": "👍", "family": "❤️"}
  const mySide = fromTeacher ? "teacher" : "family";
  const otherSide = fromTeacher ? "family" : "teacher";

  // Поставить/убрать реакцию. На демо-страницах (/teacher-demo) в базу
  // не пишем: там фикстурные id, совпадающие с реальными строками.
  const react = async (m, emoji) => {
    setReactFor(null);
    if (/-demo\/?$/.test(window.location.pathname)) {
      toast?.("Демо: реакции здесь не сохраняются");
      return;
    }
    const cur = m.reactions?.[mySide];
    const next = cur === emoji ? null : emoji; // повтор той же — убрать
    try {
      await setMessageReaction(m.id, mySide, next);
      onSent?.(); // перезагрузить переписку, чтобы реакция появилась у всех
    } catch (e) {
      console.error(e);
      toast?.(/reactions/i.test(e?.message || "")
        ? "База ещё без реакций — запустите family-chat-reactions-setup.sql"
        : "Не получилось сохранить реакцию");
    }
  };

  const send = async () => {
    const body = text.trim();
    // Можно отправить и без текста — только вложения (фото, документ, скрин)
    if ((!body && !files.length) || busy) return;
    setBusy(true);
    try {
      await sendFamilyMessage({
        family_n: familyN,
        from_teacher: fromTeacher,
        author: authorName || (fromTeacher ? "Учитель" : "Родитель"),
        text: body,
        files: files.length ? files : null,
      });
      setText("");
      setFiles([]);
      onSent?.();
      // Предпросмотр в уведомлении: текст сообщения; если текста нет —
      // говорим про вложения, чтобы пуш не был пустым
      const preview = body
        ? (body.length > 90 ? body.slice(0, 90) + "…" : body)
        : `📎 ${files.length === 1 ? "Вложение" : "Вложения"} (${files.length})`;
      if (fromTeacher) {
        // Родителю — адресный пуш только этой семье (текст личный!)
        sendManualPush({
          title: "Сообщение от учителя",
          body: preview,
          url: "/?tab=dashboard",
          audience: "family",
          familyNs: familyNs(familyN),
        }).catch(() => {});
      } else {
        // Учителю — пуш о сообщении родителя (роут сам ограничит получателя)
        sendFamilyChatPush({
          body: preview,
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
          {thread.map((m) => {
            const mine = fromTeacher ? m.from_teacher : !m.from_teacher;
            const myR = m.reactions?.[mySide];     // моя реакция на это сообщение
            const theirR = m.reactions?.[otherSide]; // реакция собеседника
            return (
              <div key={m.id} className={"chat-msg" + (mine ? " mine" : " theirs")}>
                <div className="chat-bubble">
                  {m.text}
                  {/* Вложения: фото превьюшками со скачиванием, документы списком */}
                  {Array.isArray(m.files) && m.files.length > 0 && (
                    <AttachList files={m.files} />
                  )}
                </div>

                {/* Реакции (23.10.2026): под пузырём — поставленные эмодзи;
                    своя реакция подсвечена, тап по ней убирает. Кнопка «☺+»
                    открывает выбор — только на сообщениях собеседника:
                    реакция — это быстрый ответ, а не пометка своих слов. */}
                {(myR || theirR || !mine) && (
                  <div className="chat-reacts">
                    {theirR && (
                      <span className="chat-react-chip" title={m.from_teacher ? "Реакция семьи" : "Реакция учителя"}>
                        {theirR}
                      </span>
                    )}
                    {myR && (
                      <button
                        className="chat-react-chip mine"
                        onClick={() => react(m, myR)}
                        title="Убрать свою реакцию"
                        aria-label={`Убрать свою реакцию ${myR}`}
                      >
                        {myR}
                      </button>
                    )}
                    {!mine && !myR && (
                      <button
                        className="chat-react-add"
                        onClick={() => setReactFor(reactFor === m.id ? null : m.id)}
                        aria-label="Поставить реакцию"
                        aria-expanded={reactFor === m.id}
                        title="Поставить реакцию"
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                          <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M4.9 8.2a2.7 2.7 0 0 0 4.2 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          <circle cx="5.4" cy="5.7" r=".85" fill="currentColor" />
                          <circle cx="8.6" cy="5.7" r=".85" fill="currentColor" />
                          <path d="M13 10.2v4M11 12.2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                    {reactFor === m.id && (
                      <span className="chat-react-picker" role="menu" aria-label="Выбор реакции">
                        {REACTIONS.map((e) => (
                          <button key={e} role="menuitem" className="chat-react-opt"
                            onClick={() => react(m, e)} aria-label={`Реакция ${e}`}>
                            {e}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                )}

                <div className="chat-meta">
                  {m.from_teacher ? (m.author || "Учитель") : "Родитель"} · {fmtTime(m.created_at)}
                </div>
              </div>
            );
          })}
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
        {/* Вложения: до 5 файлов по 10 МБ — фото, документы, скрины.
            Кнопка «Прикрепить файлы» и список выбранного — из Attachments. */}
        <div style={{ marginTop: 8 }}>
          <AttachPicker files={files} onChange={setFiles} toast={toast} />
        </div>
        <div className="actions">
          <button className="btn small" onClick={onClose}>Закрыть</button>
          <button
            className="btn small primary"
            onClick={send}
            disabled={busy || (!text.trim() && !files.length)}
          >
            {busy ? "Отправляем…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
