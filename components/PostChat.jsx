"use client";
import { useEffect, useRef, useState } from "react";
import {
  sendPostComment, markPostCommentsRead, deletePostComment, setChatClosed,
} from "@/lib/supabase";
import { sendCommentPush } from "@/lib/push";
import { familyName } from "./FamilyPicker";
import { useRefreshPause } from "@/lib/formGuard";

// ===== Обсуждения под публикациями учителя =====
// Один общий чат на публикацию: объявление ('ann'), задание ('hw')
// или событие ('event'). Видят и пишут все семьи + учитель.
// У учителя чат открывается модалкой (PostChatModal), у родителей —
// раскрывающимся блоком прямо под публикацией (PostChatInline).
// Пока таблицы в базе нет (comments === null), кнопки не показываются.

// Сообщения одной публикации, по времени
export function commentsFor(comments, kind, id) {
  return (comments || [])
    .filter((m) => m.post_kind === kind && m.post_id === id)
    .sort((a, b) => ((a.created_at || "") < (b.created_at || "") ? -1 : 1));
}

// Непрочитанные учителем сообщения родителей в одной публикации
export function unreadFor(comments, kind, id) {
  return commentsFor(comments, kind, id).filter(
    (m) => !m.from_teacher && !m.read_teacher
  ).length;
}

// Закрыто ли обсуждение публикации
export function isChatClosed(closedList, kind, id) {
  return !!(closedList || []).find(
    (c) => c.post_kind === kind && c.post_id === id && c.closed
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === today.toDateString()) return hm;
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm}`;
}

// Лента сообщений + поле ввода — общая начинка для модалки и блока.
// canDeleteMsg(m) решает, показывать ли крестик удаления у сообщения.
function ChatBody({
  thread, closed, canWrite, canDeleteMsg, placeholder, emptyText,
  onSend, onDelete, busy, toast,
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    const ok = await onSend(body);
    if (ok) setText("");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  };

  return (
    <>
      <div className="chat-thread">
        {!thread.length && <div className="chat-empty">{emptyText}</div>}
        {thread.map((m) => (
          <div key={m.id} className={"chat-msg" + (m.from_teacher ? " mine" : " theirs")}>
            <div className="chat-bubble">{m.text}</div>
            <div className="chat-meta">
              {m.author || (m.from_teacher ? "Учитель" : "Родитель")} · {fmtTime(m.created_at)}
              {canDeleteMsg?.(m) && (
                <button
                  className="pc-del"
                  title="Удалить сообщение"
                  onClick={async () => {
                    if (!window.confirm("Удалить это сообщение?")) return;
                    try { await onDelete(m.id); }
                    catch (e) { console.error(e); toast?.("Не получилось удалить"); }
                  }}
                >✕</button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {closed && (
        <p className="muted pc-closed-note">
          Обсуждение закрыто учителем — писать больше нельзя.
        </p>
      )}
      {canWrite && !closed && (
        <>
          <textarea
            className="chat-input"
            rows={2}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          <div className="actions">
            <button className="btn small primary" onClick={send} disabled={busy || !text.trim()}>
              {busy ? "Отправляем…" : "Отправить"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ===== Модалка учителя =====
// title — заголовок публикации, чтобы было ясно, что обсуждаем.
export function PostChatModal({
  open, postKind, postId, title, comments, closedList, authorName,
  onSent, onClose, toast,
}) {
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  useRefreshPause(open);

  const thread = commentsFor(comments, postKind, postId);
  const closed = isChatClosed(closedList, postKind, postId);

  // Учитель открыл ветку — родительские сообщения прочитаны
  useEffect(() => {
    if (open && postId) markPostCommentsRead(postKind, postId);
  }, [open, postKind, postId, thread.length]);

  if (!open) return null;

  const send = async (body) => {
    setBusy(true);
    try {
      await sendPostComment({
        post_kind: postKind, post_id: postId, family_n: null,
        from_teacher: true, author: authorName || "Учитель", text: body,
      });
      onSent?.();
      return true;
    } catch (e) {
      console.error(e);
      toast?.("Не получилось отправить");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleClosed = async () => {
    setClosing(true);
    try {
      await setChatClosed(postKind, postId, !closed);
      onSent?.();
      toast?.(closed ? "Обсуждение снова открыто" : "Обсуждение закрыто");
    } catch (e) {
      console.error(e);
      toast?.("Не получилось изменить");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal chat-modal" role="dialog" aria-modal="true">
        <h3>Обсуждение</h3>
        {title && <p className="muted chat-privacy">{title}</p>}

        <ChatBody
          thread={thread}
          closed={false /* учитель пишет всегда, даже в закрытое */}
          canWrite={true}
          canDeleteMsg={() => true}
          placeholder="Ответить родителям…"
          emptyText="Сообщений пока нет. Родители видят это обсуждение под публикацией и могут написать первыми."
          onSend={send}
          onDelete={async (id) => { await deletePostComment(id); onSent?.(); }}
          busy={busy}
          toast={toast}
        />
        {closed && (
          <p className="muted pc-closed-note">Обсуждение закрыто: родители видят чат, но писать не могут.</p>
        )}

        <div className="actions">
          <button className="btn small" onClick={toggleClosed} disabled={closing}>
            {closing ? "…" : closed ? "Открыть обсуждение" : "Закрыть обсуждение"}
          </button>
          <button className="btn small" onClick={onClose}>Закрыть окно</button>
        </div>
      </div>
    </div>
  );
}

// ===== Раскрывающийся блок для родителей =====
// Кнопка «Обсуждение (N)» под публикацией; по нажатию раскрывается чат.
// family — выбранная семья ({n, child}); если её нет, onNeedFamily
// откроет выбор семьи и после выбора можно писать.
export function PostChatInline({
  postKind, postId, comments, closedList, family, onNeedFamily, onSent, toast, pushUrl,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (comments === null || comments === undefined) return null; // таблицы ещё нет

  const thread = commentsFor(comments, postKind, postId);
  const closed = isChatClosed(closedList, postKind, postId);

  const send = async (body) => {
    if (!family?.n) { onNeedFamily?.(); return false; }
    setBusy(true);
    try {
      await sendPostComment({
        post_kind: postKind, post_id: postId, family_n: family.n,
        from_teacher: false, author: `Семья · ${familyName(family.n)}`, text: body,
      });
      onSent?.();
      // Учителю — пуш о новом сообщении (родителям пуши не шлём)
      sendCommentPush({
        body: body.length > 90 ? body.slice(0, 90) + "…" : body,
        url: pushUrl || "/?tab=teacher",
      }).catch(() => {});
      return true;
    } catch (e) {
      console.error(e);
      toast?.("Не получилось отправить");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pc-wrap">
      <button
        className={"pc-toggle" + (open ? " open" : "")}
        onClick={() => setOpen(!open)}
      >
        💬 Обсуждение{thread.length ? ` (${thread.length})` : ""}
        <span className="pc-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="pc-panel">
          <ChatBody
            thread={thread}
            closed={closed}
            canWrite={true}
            canDeleteMsg={(m) => !m.from_teacher && family?.n && m.family_n === family.n}
            placeholder="Написать в обсуждение…"
            emptyText="Сообщений пока нет. Напишите первым — увидят учитель и все семьи класса."
            onSend={send}
            onDelete={async (id) => { await deletePostComment(id); onSent?.(); }}
            busy={busy}
            toast={toast}
          />
          {!closed && (
            <p className="muted pc-privacy">Видят все семьи класса и учитель</p>
          )}
        </div>
      )}
    </div>
  );
}
