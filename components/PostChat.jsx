"use client";
import { useEffect, useRef, useState } from "react";
import {
  sendPostComment, markPostCommentsRead, deletePostComment, setChatClosed,
  setPostCommentReaction, updatePostComment,
} from "@/lib/supabase";
import { sendCommentPush } from "@/lib/push";
import { familyLabel, familyNs, canonicalN } from "./data";
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

// Набор реакций — тот же, что в личной переписке (TeacherFamilyChat)
const REACTIONS = ["❤️", "👍", "😊", "😂", "😮", "🙏"];

// Лента сообщений + поле ввода — общая начинка для модалки и блока.
// canDeleteMsg(m) решает, показывать ли крестик удаления у сообщения.
// Реакции (23.10.2026): reactKey — ключ участника в reactions ("t" или
// "f18"); ставить можно на любое сообщение, включая своё.
// onNeedFamily — без выбранной семьи реакция сначала просит выбрать её.
function ChatBody({
  thread, closed, canWrite, canDeleteMsg, canEditMsg, placeholder, emptyText,
  onSend, onDelete, busy, toast,
  reactKey, onNeedFamily, onReacted,
}) {
  const [text, setText] = useState("");
  const [reactFor, setReactFor] = useState(null); // id сообщения с открытым выбором
  const [editId, setEditId] = useState(null);     // id своего сообщения в режиме правки
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const bottomRef = useRef(null);

  // Сохранить правку своего сообщения (23.10.2026)
  const saveEdit = async () => {
    const body = editText.trim();
    if (!body || editBusy) return;
    setEditBusy(true);
    try {
      await updatePostComment(editId, body);
      setEditId(null);
      onReacted?.(); // перезагрузить ветку с новым текстом
    } catch (e) {
      console.error(e);
      toast?.("Не получилось сохранить правку");
    } finally {
      setEditBusy(false);
    }
  };

  const react = async (m, emoji) => {
    setReactFor(null);
    if (!reactKey) { onNeedFamily?.(); return; }
    const cur = m.reactions?.[reactKey];
    const next = cur === emoji ? null : emoji; // повтор той же — убрать
    try {
      await setPostCommentReaction(m.id, reactKey, next);
      onReacted?.();
    } catch (e) {
      console.error(e);
      toast?.(/reactions/i.test(e?.message || "")
        ? "База ещё без реакций — запустите post-comments-reactions-setup.sql"
        : "Не получилось поставить реакцию");
    }
  };

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
        {thread.map((m) => {
          // Реакцию можно поставить на любое сообщение — и чужое, и своё
          // (по просьбе родителей). В обсуждении много участников, поэтому
          // чипы собираются по эмодзи со счётчиком:
          // {"t":"👍","f18":"❤️","f14":"❤️"} → ❤️2 👍
          const rx = m.reactions && typeof m.reactions === "object" ? m.reactions : {};
          const myR = reactKey ? rx[reactKey] : null;
          const groups = {};
          Object.values(rx).forEach((e) => { groups[e] = (groups[e] || 0) + 1; });
          const emojis = Object.keys(groups);
          return (
          <div key={m.id} className={"chat-msg" + (m.from_teacher ? " mine" : " theirs")}>
            {editId === m.id ? (
              <div className="chat-edit">
                <textarea
                  className="chat-input"
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
                <div className="chat-edit-actions">
                  <button className="btn small" onClick={() => setEditId(null)} disabled={editBusy}>
                    Отмена
                  </button>
                  <button className="btn small primary" onClick={saveEdit}
                    disabled={editBusy || !editText.trim()}>
                    {editBusy ? "Сохраняем…" : "Сохранить"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="chat-bubble">{m.text}</div>
            )}

            {(
              <div className="chat-reacts">
                {emojis.map((e) => (
                  <button
                    key={e}
                    className={"chat-react-chip" + (myR === e ? " mine" : "")}
                    onClick={() => react(m, e)}
                    title={myR === e ? "Убрать свою реакцию" : `Поставить ${e}`}
                    aria-label={myR === e ? `Убрать свою реакцию ${e}` : `Поставить реакцию ${e}`}
                  >
                    {e}{groups[e] > 1 && <span className="chat-react-cnt">{groups[e]}</span>}
                  </button>
                ))}
                {!myR && (
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
              {m.author || (m.from_teacher ? "Учитель" : "Родитель")} · {fmtTime(m.created_at)}
              {m.edited_at && <span className="chat-edited"> · изменено</span>}
              {canEditMsg?.(m) && editId !== m.id && (
                <button
                  className="chat-msg-act"
                  title="Изменить сообщение"
                  aria-label="Изменить сообщение"
                  onClick={() => { setEditId(m.id); setEditText(m.text || ""); }}
                >✎</button>
              )}
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
          );
        })}
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
          canEditMsg={(m) => m.from_teacher /* учитель правит только свои */}
          placeholder="Ответить родителям…"
          emptyText="Сообщений пока нет. Родители видят это обсуждение под публикацией и могут написать первыми."
          onSend={send}
          onDelete={async (id) => { await deletePostComment(id); onSent?.(); }}
          busy={busy}
          toast={toast}
          reactKey="t"
          onReacted={onSent}
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
        from_teacher: false, author: `Семья · ${familyLabel(family.n)}`, text: body,
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
            canDeleteMsg={(m) => !m.from_teacher && family?.n && familyNs(family.n).includes(m.family_n)}
            canEditMsg={(m) => !m.from_teacher && !!family?.n && familyNs(family.n).includes(m.family_n)}
            placeholder="Написать в обсуждение…"
            emptyText="Сообщений пока нет. Напишите первым — увидят учитель и все семьи класса."
            onSend={send}
            onDelete={async (id) => { await deletePostComment(id); onSent?.(); }}
            busy={busy}
            toast={toast}
            reactKey={family?.n ? "f" + canonicalN(family.n) : null}
            onNeedFamily={onNeedFamily}
            onReacted={onSent}
          />
          {!closed && (
            <p className="muted pc-privacy">Видят все семьи класса и учитель</p>
          )}
        </div>
      )}
    </div>
  );
}
