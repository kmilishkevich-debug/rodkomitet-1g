"use client";
import { useEffect, useRef, useState } from "react";
import {
  sendFamilyMessage, markThreadRead, setMessageReaction,
  updateFamilyMessage, deleteFamilyMessage,
} from "@/lib/supabase";
import { sendManualPush, sendFamilyChatPush } from "@/lib/push";
import { useRefreshPause } from "@/lib/formGuard";
import { familyNs } from "./data";
import { AttachPicker, AttachList } from "./Attachments";
import { STICKERS, STICKER_SET_NAME, stickerById, recentStickers, rememberSticker } from "./stickers";

// ===== Личная переписка семьи и учителя (редизайн 28.10.2026) =====
// Одно окно на двоих, сторона задаётся пропом side:
//   • side="teacher" — учитель в кабинете, «свои» пузыри = от учителя;
//   • side="parent" — родитель на «Главной», «свои» пузыри = от семьи.
// Светлый чат по ТЗ: лавандовые исходящие, белые входящие, время внутри
// пузыря, разделители дат, статусы «Отправлено/Прочитано» (доставку
// приложение не отслеживает и не выдумывает), стикеры «Наш пушистик»,
// ответы-цитаты, контекстное меню, черновики и повтор при ошибке.

// Быстрые реакции (ТЗ п. 18)
const QUICK_REACTIONS = ["❤️", "👍", "🙏", "😊", "🎉"];

// Вкладка «Эмодзи» панели стикеров — вставляются в текст
const EMOJIS = [
  "😀", "😄", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤗",
  "🤔", "😅", "😂", "🥲", "😢", "😮", "😴", "🤒", "🤧", "😷",
  "👍", "👎", "👏", "🙏", "🤝", "💪", "👋", "✊", "🖐️", "☝️",
  "❤️", "💙", "💛", "💚", "🧡", "💜", "🎉", "🎈", "🎁", "🌟",
  "⭐", "☀️", "🌈", "🌸", "🍀", "📚", "✏️", "🎒", "⚽", "🏃",
];

const MONTHS_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Дата-время в Минске, разобранные на части
function minskParts(iso) {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
  return d;
}

// «09:12» — время внутри пузыря (Минск)
function fmtClock(iso) {
  if (!iso) return "";
  const d = minskParts(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Ключ дня для группировки «Сегодня/Вчера/23 октября»
function dayKey(iso) {
  const d = minskParts(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Подпись разделителя дат
function dayLabel(iso) {
  const d = minskParts(iso);
  const now = minskParts(new Date().toISOString());
  const k = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (k === today) return "Сегодня";
  if (k === dayKey(yest.toISOString())) return "Вчера";
  const base = `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// «Головко Виктория Петровна» → «Виктория Петровна»: в шапке чата полное
// ФИО не нужно, оно остаётся в данных и в подсказке при наведении
function shortPerson(full) {
  const w = (full || "").trim().split(/\s+/);
  return w.length === 3 ? `${w[1]} ${w[2]}` : (full || "");
}

// «ВП» — инициалы для аватара (первые буквы двух первых слов)
function initialsOf(name) {
  const w = (name || "").trim().split(/\s+/).filter(Boolean);
  return w.slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
}

// «28 октября 2026, 19:40» — для «Информации о сообщении»
function fmtFull(iso) {
  if (!iso) return "";
  const d = minskParts(iso);
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}, ${fmtClock(iso)}`;
}

// Галочки статуса: одна серая — сохранено на сервере, две синие —
// собеседник открыл чат и увидел сообщение. Подтверждений доставки
// на устройство у приложения нет, поэтому «Доставлено» не показываем.
function Checks({ read }) {
  return (
    <span className={"nchat-checks" + (read ? " read" : "")}
      aria-label={read ? "Прочитано" : "Отправлено"} role="img">
      <svg viewBox="0 0 18 12" width="16" height="11" fill="none" aria-hidden="true">
        <path d="M1.5 6.2 5 9.7 11 2.6" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        {read && (
          <path d="M7.5 6.2 11 9.7 17 2.6" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}

export default function TeacherFamilyChat({
  open, familyN, familyChild, messages, authorName, teacherName,
  side = "teacher", onSent, onClose, toast,
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);     // последняя неудачная отправка
  const [panelTab, setPanelTab] = useState(null); // null | recent | pack | emoji
  const [menuFor, setMenuFor] = useState(null);   // id сообщения с открытым меню
  const [menuUp, setMenuUp] = useState(false);    // меню вверх, если сообщение внизу
  const [reactFor, setReactFor] = useState(null); // id сообщения с выбором реакции
  // Своя реакция видна сразу, не дожидаясь перезагрузки сообщений:
  // { [id]: эмодзи | null }, null = «убрала реакцию»
  const [localReacts, setLocalReacts] = useState({});
  const [replyTo, setReplyTo] = useState(null);   // сообщение, на которое отвечаем
  const [infoFor, setInfoFor] = useState(null);   // «Информация о сообщении»
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [unreadMark, setUnreadMark] = useState(null); // id первого непрочитанного
  const [pendingNew, setPendingNew] = useState(0);    // новые ниже при чтении истории
  const threadRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const atBottomRef = useRef(true);
  const lenRef = useRef(0);
  const pressTimer = useRef(null);

  useRefreshPause(open);

  const fromTeacher = side === "teacher";
  const mySide = fromTeacher ? "teacher" : "family";
  const otherSide = fromTeacher ? "family" : "teacher";
  const draftKey = `rk1g-chat-draft:${side}:${familyN || 0}`;

  const thread = (messages || [])
    .filter((m) => familyNs(familyN).includes(m.family_n))
    .sort((a, b) => ((a.created_at || "") < (b.created_at || "") ? -1 : 1));

  const isUnreadForMe = (m) =>
    (fromTeacher ? !m.from_teacher : m.from_teacher) &&
    !(fromTeacher ? m.read_teacher : m.read_family);

  // Открыли чат: черновик в поле, метка «Новые сообщения», прокрутка
  useEffect(() => {
    if (!open) return;
    setFiles([]); setAttachOpen(false); setPanelTab(null); setMenuFor(null);
    setReactFor(null); setEditId(null); setReplyTo(null); setInfoFor(null);
    setFailed(null); setPendingNew(0); setLocalReacts({});
    try { setText(localStorage.getItem(draftKey) || ""); } catch { setText(""); }
    const firstUnread = thread.find(isUnreadForMe);
    setUnreadMark(firstUnread ? firstUnread.id : null);
    // Прокрутка: к первому непрочитанному, иначе к последним сообщениям
    setTimeout(() => {
      const el = firstUnread && document.getElementById("nmsg-" + firstUnread.id);
      if (el) el.scrollIntoView({ block: "center" });
      else bottomRef.current?.scrollIntoView({ block: "nearest" });
    }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familyN]);

  // Черновик: сохраняем при каждом изменении, переживает закрытие чата
  useEffect(() => {
    if (!open) return;
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [text, open, draftKey]);

  // Прочтение — только когда чат открыт и вкладка на экране (ТЗ п. 10).
  // Фоновая вкладка прочтением не считается: ждём возвращения.
  useEffect(() => {
    if (!open || !familyN) return;
    const mark = () => {
      if (document.visibilityState === "visible") markThreadRead(familyNs(familyN), side);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [open, familyN, side, thread.length]);

  // Новые сообщения: внизу — показываем сразу; читаем историю — копим счётчик
  useEffect(() => {
    if (!open) { lenRef.current = thread.length; return; }
    if (thread.length > lenRef.current) {
      if (atBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        setPendingNew((n) => n + (thread.length - lenRef.current));
      }
    }
    lenRef.current = thread.length;
  }, [thread.length, open]);

  // Панель стикеров сжимает историю: если пользователь был внизу,
  // держим последнее сообщение видимым; если читал старое — не трогаем
  useEffect(() => {
    if (!open || !panelTab) return;
    if (atBottomRef.current) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "nearest" }));
    }
  }, [panelTab, open]);

  if (!open) return null;

  const isDemo = () => /-demo\/?$/.test(window.location.pathname);

  // ===== Отправка: текст с вложениями или стикер отдельным сообщением =====
  const doSend = async ({ sticker = null } = {}) => {
    const raw = text;
    const body = sticker ? "" : raw.trim();
    if (!sticker && !body && !files.length) return;
    if (busy) return; // защита от двойного нажатия
    if (isDemo()) { toast?.("Демо: отправка здесь не работает"); return; }
    setBusy(true);
    try {
      await sendFamilyMessage({
        family_n: familyN,
        from_teacher: fromTeacher,
        author: authorName || (fromTeacher ? "Учитель" : "Родитель"),
        text: body,
        files: !sticker && files.length ? files : null,
        sticker,
        reply_to: !sticker && replyTo ? replyTo.id : null,
      });
      if (sticker) {
        rememberSticker(sticker); // текстовый черновик не трогаем (ТЗ п. 17)
      } else {
        // Чистим только отправленный текст: если за время отправки успели
        // допечатать новое — его не трогаем (ТЗ п. 14)
        setText((cur) => (cur === raw ? "" : cur));
        try { if (raw) localStorage.removeItem(draftKey); } catch {}
        setFiles([]); setAttachOpen(false); setReplyTo(null);
      }
      setFailed(null);
      onSent?.();
      const preview = sticker
        ? `Стикер: ${stickerById(sticker)?.label || ""}`
        : body
          ? (body.length > 90 ? body.slice(0, 90) + "…" : body)
          : `📎 ${files.length === 1 ? "Вложение" : "Вложения"} (${files.length})`;
      if (fromTeacher) {
        sendManualPush({
          title: "Сообщение от учителя", body: preview, url: "/?tab=dashboard",
          audience: "family", familyNs: familyNs(familyN),
        }).catch(() => {});
      } else {
        sendFamilyChatPush({ body: preview, url: "/" }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      // Текст и вложения сохранены — показываем строку с повтором
      setFailed({ sticker });
      if (sticker && /sticker/.test(e?.message || "")) {
        toast?.("База ещё без стикеров — запустите chat-redesign-setup.sql");
      }
    } finally {
      setBusy(false);
    }
  };

  const retry = () => doSend(failed || {});

  // ===== Реакции =====
  const react = async (m, emoji) => {
    setReactFor(null); setMenuFor(null);
    if (isDemo()) { toast?.("Демо: реакции здесь не сохраняются"); return; }
    const cur = localReacts[m.id] !== undefined ? localReacts[m.id] : m.reactions?.[mySide];
    const next = cur === emoji ? null : emoji;
    // Показываем свою реакцию сразу, сервер догонит
    setLocalReacts((r) => ({ ...r, [m.id]: next }));
    try {
      await setMessageReaction(m.id, mySide, next);
      onSent?.();
    } catch (e) {
      console.error(e);
      // Не сохранилось — возвращаем как было
      setLocalReacts((r) => { const c = { ...r }; delete c[m.id]; return c; });
      toast?.("Не получилось сохранить реакцию");
    }
  };

  // ===== Правка и удаление =====
  const saveEdit = async () => {
    const body = editText.trim();
    if (!body || editBusy) return;
    if (isDemo()) { toast?.("Демо: правки здесь не сохраняются"); setEditId(null); return; }
    setEditBusy(true);
    try {
      await updateFamilyMessage(editId, body);
      setEditId(null);
      onSent?.();
    } catch (e) {
      console.error(e);
      toast?.("Не получилось сохранить правку");
    } finally {
      setEditBusy(false);
    }
  };

  const delMsg = async (m) => {
    setMenuFor(null);
    if (isDemo()) { toast?.("Демо: удаление здесь не работает"); return; }
    if (!window.confirm("Удалить сообщение у вас и собеседника? В переписке останется строка «Сообщение удалено».")) return;
    try {
      await deleteFamilyMessage(m.id);
      onSent?.();
    } catch (e) {
      console.error(e);
      toast?.("Не получилось удалить");
    }
  };

  const copyMsg = async (m) => {
    setMenuFor(null);
    try {
      await navigator.clipboard.writeText(m.text || "");
      toast?.("Текст скопирован");
    } catch { toast?.("Не получилось скопировать"); }
  };

  // Переход к процитированному сообщению с короткой подсветкой
  const jumpTo = (id) => {
    const el = document.getElementById("nmsg-" + id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("nchat-flash");
    setTimeout(() => el.classList.remove("nchat-flash"), 1600);
  };

  // ===== Ввод =====
  const canSend = !!text.trim() || files.length > 0;

  const autosize = (el) => {
    el.style.height = "auto";
    // 5 строк по 24px + вертикальные отступы поля, дальше — прокрутка внутри
    el.style.height = Math.min(el.scrollHeight, 24 * 5 + 24) + "px";
  };

  const onKey = (e) => {
    if (e.key !== "Enter" || e.nativeEvent?.isComposing) return;
    // Компьютер: Enter — отправить, Shift+Enter — новая строка.
    // Телефон (без hover): Enter — перенос, отправка кнопкой.
    const desktop = window.matchMedia("(hover:hover)").matches;
    if (desktop && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const insertEmoji = (em) => {
    const el = inputRef.current;
    if (!el) { setText((t) => t + em); return; }
    const s = el.selectionStart ?? text.length;
    const eIdx = el.selectionEnd ?? text.length;
    const next = text.slice(0, s) + em + text.slice(eIdx);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + em.length;
      autosize(el);
    });
  };

  // Открыть меню: у сообщений в нижней половине истории — вверх,
  // чтобы список действий не обрезался краем окна
  const openMenu = (id, el) => {
    const th = threadRef.current;
    if (th && el) {
      const tr = th.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setMenuUp(r.top - tr.top > tr.height * 0.45);
    }
    setMenuFor(id);
  };

  // Долгое нажатие на сообщение — контекстное меню (телефоны)
  const pressStart = (id, el) => {
    pressTimer.current = setTimeout(() => openMenu(id, el), 450);
  };
  const pressEnd = () => clearTimeout(pressTimer.current);

  const onRootKey = (e) => {
    if (e.key !== "Escape") return;
    // Сначала закрываются верхние панели, потом само окно (ТЗ п. 26)
    if (infoFor) { setInfoFor(null); return; }
    if (menuFor || reactFor) { setMenuFor(null); setReactFor(null); return; }
    if (panelTab) { setPanelTab(null); return; }
    onClose();
  };

  // ===== Шапка =====
  // Полное имя — в подсказку и aria-label, короткое — на экран
  const headFull = fromTeacher
    ? (familyChild || `Семья №${familyN}`)
    : (teacherName || "Классный руководитель");
  const headName = fromTeacher ? headFull : (shortPerson(teacherName) || "Классный руководитель");
  const headRole = fromTeacher
    ? `Родители · семья №${familyN || "—"} · 1 «Г»`
    : "Классный руководитель · 1 «Г»";
  const privacyLine = fromTeacher
    ? "Видно только вам и этому родителю"
    : "Видно только вам и учителю";

  const lastMine = [...thread].reverse().find((m) => (fromTeacher ? m.from_teacher : !m.from_teacher) && !m.deleted_at);
  const lastMineRead = lastMine && (fromTeacher ? lastMine.read_family : lastMine.read_teacher);
  const lastReadMine = lastMineRead
    ? lastMine
    : [...thread].reverse().find((m) =>
        (fromTeacher ? m.from_teacher : !m.from_teacher) && !m.deleted_at &&
        (fromTeacher ? m.read_family : m.read_teacher));

  const recents = typeof window !== "undefined" ? recentStickers() : [];
  const panelStickers = panelTab === "recent" ? recents : STICKERS;

  let prevDay = null;
  let prevFrom = null;

  return (
    <div className="overlay nchat-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nchat-modal" role="dialog" aria-modal="true" aria-label={`Переписка: ${headFull}`}
        onKeyDown={onRootKey}>

        {/* ===== Шапка ===== */}
        <header className="nchat-head">
          <button className="nchat-back" onClick={onClose} aria-label="Назад">
            <svg viewBox="0 0 20 20" width="21" height="21" fill="none" aria-hidden="true">
              <path d="M12.5 4 6.5 10l6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="nchat-ava" aria-hidden="true">{initialsOf(headName)}</span>
          <div className="nchat-head-txt">
            <div className="nchat-name" title={headFull}>{headName}</div>
            <div className="nchat-role">{headRole}</div>
          </div>
          <button className="nchat-close" onClick={onClose} aria-label="Закрыть переписку">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="nchat-privacy">
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden="true">
            <rect x="2.4" y="6" width="9.2" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4.6 6V4.5a2.4 2.4 0 0 1 4.8 0V6" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          {privacyLine}
        </div>

        {/* ===== История ===== */}
        <div
          className="nchat-thread"
          ref={threadRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            atBottomRef.current = atBottom;
            if (atBottom && pendingNew) setPendingNew(0);
          }}
        >
          {!thread.length && (
            <div className="nchat-empty">
              {fromTeacher
                ? "Переписки пока нет. Напишите первое сообщение — родитель увидит его на главной и сможет ответить."
                : "Переписки пока нет. Напишите первое сообщение — учитель увидит его в своём кабинете и сможет ответить."}
            </div>
          )}

          {thread.map((m) => {
            const mine = fromTeacher ? m.from_teacher : !m.from_teacher;
            const myR = localReacts[m.id] !== undefined ? localReacts[m.id] : m.reactions?.[mySide];
            const theirR = m.reactions?.[otherSide];
            const read = fromTeacher ? m.read_family : m.read_teacher;
            const day = dayKey(m.created_at);
            const showDay = day !== prevDay;
            const follow = !showDay && prevFrom === m.from_teacher;
            prevDay = day; prevFrom = m.from_teacher;
            const quoted = m.reply_to ? thread.find((x) => x.id === m.reply_to) : null;
            const st = m.sticker ? stickerById(m.sticker) : null;

            return (
              <div key={m.id}>
                {showDay && <div className="nchat-day"><span>{dayLabel(m.created_at)}</span></div>}
                {unreadMark === m.id && (
                  <div className="nchat-day nchat-new"><span>Новые сообщения</span></div>
                )}
                <div
                  id={"nmsg-" + m.id}
                  className={"nchat-msg" + (mine ? " mine" : " theirs") + (follow ? " follow" : "")}
                  onTouchStart={(e) => !m.deleted_at && pressStart(m.id, e.currentTarget)}
                  onTouchEnd={pressEnd}
                  onTouchMove={pressEnd}
                  onContextMenu={(e) => {
                    if (m.deleted_at) return;
                    e.preventDefault();
                    menuFor === m.id ? setMenuFor(null) : openMenu(m.id, e.currentTarget);
                  }}
                >
                  {m.deleted_at ? (
                    <div className="nchat-bubble nchat-deleted">Сообщение удалено</div>
                  ) : editId === m.id ? (
                    <div className="nchat-editbox">
                      <div className="nchat-edit-note">Редактирование сообщения</div>
                      <textarea
                        className="nchat-edit-input" rows={3} value={editText}
                        onChange={(e) => setEditText(e.target.value)} autoFocus
                      />
                      <div className="nchat-edit-actions">
                        <button className="btn small" onClick={() => setEditId(null)} disabled={editBusy}>Отмена</button>
                        <button className="btn small primary" onClick={saveEdit}
                          disabled={editBusy || !editText.trim()}>
                          {editBusy ? "Сохраняем…" : "Сохранить"}
                        </button>
                      </div>
                    </div>
                  ) : st ? (
                    /* Стикер — отдельный тип сообщения, без пузырька (ТЗ п. 16) */
                    <div className="nchat-sticker-wrap">
                      <img
                        className="nchat-sticker" src={st.file}
                        alt={`Стикер: ${st.label}`}
                        onError={(e) => { e.currentTarget.outerHTML = `<span class="nchat-sticker-miss">Стикер: ${st.label}</span>`; }}
                      />
                      <span className="nchat-sticker-meta">
                        {m.edited_at && <span className="nchat-edited">изменено · </span>}
                        {fmtClock(m.created_at)}
                        {mine && <Checks read={read} />}
                      </span>
                    </div>
                  ) : (
                    <div className="nchat-bubble">
                      {quoted && (
                        <button className="nchat-quote" onClick={() => jumpTo(quoted.id)}
                          aria-label="Перейти к исходному сообщению">
                          <span className="nchat-quote-author">
                            {quoted.from_teacher ? (teacherName || quoted.author || "Учитель") : (quoted.author || "Родитель")}
                          </span>
                          <span className="nchat-quote-text">
                            {quoted.deleted_at ? "Сообщение удалено"
                              : quoted.sticker ? `Стикер: ${stickerById(quoted.sticker)?.label || ""}`
                              : quoted.text ? (quoted.text.length > 80 ? quoted.text.slice(0, 80) + "…" : quoted.text)
                              : "📎 Вложение"}
                          </span>
                        </button>
                      )}
                      {m.reply_to && !quoted && (
                        <span className="nchat-quote nchat-quote-dead">
                          <span className="nchat-quote-text">Сообщение удалено</span>
                        </span>
                      )}
                      {m.text && <span className="nchat-text">{m.text}</span>}
                      {Array.isArray(m.files) && m.files.length > 0 && <AttachList files={m.files} />}
                      <span className="nchat-meta">
                        {m.edited_at && <span className="nchat-edited">изменено</span>}
                        <span className="nchat-time">{fmtClock(m.created_at)}</span>
                        {mine && <Checks read={read} />}
                      </span>
                    </div>
                  )}

                  {/* Кнопка меню: на компьютере видна при наведении */}
                  {!m.deleted_at && editId !== m.id && (
                    <button
                      className="nchat-more"
                      aria-label="Действия с сообщением"
                      aria-expanded={menuFor === m.id}
                      onClick={(e) => {
                        menuFor === m.id ? setMenuFor(null) : openMenu(m.id, e.currentTarget.parentElement);
                        setReactFor(null);
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
                        <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" />
                      </svg>
                    </button>
                  )}

                  {/* Поставленные реакции — видны всегда */}
                  {(myR || theirR) && !m.deleted_at && (
                    <div className="nchat-reacts">
                      {theirR && <span className="nchat-react-chip">{theirR}</span>}
                      {myR && (
                        <button className="nchat-react-chip mine" onClick={() => react(m, myR)}
                          title="Убрать свою реакцию" aria-label={`Убрать свою реакцию ${myR}`}>
                          {myR}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Контекстное меню */}
                  {menuFor === m.id && (
                    <div className={"nchat-menu" + (menuUp ? " up" : "")} role="menu">
                      <div className="nchat-menu-reacts">
                        {QUICK_REACTIONS.map((e) => (
                          <button key={e} role="menuitem" className="nchat-menu-react"
                            onClick={() => react(m, e)} aria-label={`Реакция ${e}`}>{e}</button>
                        ))}
                      </div>
                      <button role="menuitem" onClick={() => { setReplyTo(m); setMenuFor(null); inputRef.current?.focus(); }}>
                        Ответить
                      </button>
                      {m.text && <button role="menuitem" onClick={() => copyMsg(m)}>Копировать текст</button>}
                      {mine && !m.sticker && m.text && (
                        <button role="menuitem" onClick={() => { setEditId(m.id); setEditText(m.text || ""); setMenuFor(null); }}>
                          Изменить
                        </button>
                      )}
                      {mine && (
                        <button role="menuitem" onClick={() => { setInfoFor(m); setMenuFor(null); }}>
                          Информация о сообщении
                        </button>
                      )}
                      {mine && (
                        <button role="menuitem" className="danger" onClick={() => delMsg(m)}>Удалить</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Статусная подпись — сразу под своим сообщением (ТЗ п. 10) */}
                {lastMine && !lastMineRead && m.id === lastMine.id && (
                  <div className="nchat-status-line">Отправлено</div>
                )}
                {lastReadMine && m.id === lastReadMine.id && (
                  <div className="nchat-status-line read">
                    Прочитано{lastReadMine.read_at ? ` · ${fmtClock(lastReadMine.read_at)}` : ""}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Кнопка «вниз» с числом новых, пока читаем историю */}
        {pendingNew > 0 && (
          <button className="nchat-down" onClick={() => {
            setPendingNew(0);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}>
            ↓ {pendingNew}
          </button>
        )}

        {/* Ошибка отправки: содержимое сохранено, можно повторить */}
        {failed && (
          <div className="nchat-fail" role="alert">
            Не отправлено
            <button onClick={retry} disabled={busy}>{busy ? "Отправляем…" : "Повторить"}</button>
          </div>
        )}

        {/* Превью ответа */}
        {replyTo && (
          <div className="nchat-replybar">
            <div className="nchat-replybar-txt">
              <b>{replyTo.from_teacher ? (teacherName || replyTo.author || "Учитель") : (replyTo.author || "Родитель")}</b>
              <span>
                {replyTo.sticker ? `Стикер: ${stickerById(replyTo.sticker)?.label || ""}`
                  : replyTo.text ? (replyTo.text.length > 70 ? replyTo.text.slice(0, 70) + "…" : replyTo.text)
                  : "📎 Вложение"}
              </span>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Отменить ответ">✕</button>
          </div>
        )}

        {/* Выбранные вложения */}
        {attachOpen && (
          <div className="nchat-attachbar">
            <AttachPicker files={files} onChange={setFiles} toast={toast} />
          </div>
        )}

        {/* ===== Панель ввода ===== */}
        <div className="nchat-inputbar">
          <button
            className={"nchat-plus" + (attachOpen ? " on" : "")}
            onClick={() => setAttachOpen(!attachOpen)}
            aria-label="Прикрепить файлы" aria-expanded={attachOpen}
          >
            <svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            className="nchat-input"
            rows={1}
            placeholder={typeof window !== "undefined" && window.innerWidth < 480 ? "Сообщение…" : "Напишите сообщение…"}
            value={text}
            onChange={(e) => { setText(e.target.value); autosize(e.target); }}
            onKeyDown={onKey}
            onFocus={() => setPanelTab(null)}
          />
          <button
            className={"nchat-stick-btn" + (panelTab ? " on" : "")}
            onClick={() => setPanelTab(panelTab ? null : "pack")}
            aria-label="Стикеры" aria-expanded={!!panelTab}
          >
            <svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h7A3.5 3.5 0 0 1 18 7.5v4.3a2 2 0 0 1-.6 1.4l-4.2 4.2a2 2 0 0 1-1.4.6H7.5A3.5 3.5 0 0 1 4 14.5v-7Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12.5 17.6V15a2.5 2.5 0 0 1 2.5-2.5h2.6" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="8.6" cy="9.3" r=".95" fill="currentColor" />
              <circle cx="13.4" cy="9.3" r=".95" fill="currentColor" />
              <path d="M8.3 12.1a3.4 3.4 0 0 0 3.4 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="nchat-send"
            onClick={() => doSend()}
            disabled={busy || !canSend}
            aria-label="Отправить сообщение"
          >
            <svg viewBox="0 0 22 22" width="20" height="20" fill="none" aria-hidden="true">
              <path d="M4 11h13M12 5.5 17.8 11 12 16.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ===== Панель стикеров ===== */}
        {panelTab && (
          <div className="nchat-stickers">
            <div className="nchat-stick-tabs" role="tablist">
              {[["recent", "Недавние"], ["pack", STICKER_SET_NAME], ["emoji", "Эмодзи"]].map(([k, label]) => (
                <button key={k} role="tab" aria-selected={panelTab === k}
                  className={"nchat-stick-tab" + (panelTab === k ? " on" : "")}
                  onClick={() => setPanelTab(k)}>
                  {label}
                </button>
              ))}
            </div>
            {panelTab === "emoji" ? (
              <div className="nchat-emoji-grid">
                {EMOJIS.map((em) => (
                  <button key={em} className="nchat-emoji" onClick={() => insertEmoji(em)}
                    aria-label={`Эмодзи ${em}`}>{em}</button>
                ))}
              </div>
            ) : panelStickers.length === 0 ? (
              <div className="nchat-stick-empty muted">
                Здесь появятся стикеры, которые вы отправляли
              </div>
            ) : (
              <div className="nchat-stick-grid">
                {panelStickers.map((s) => (
                  <button key={s.id} className="nchat-stick-cell"
                    onClick={() => doSend({ sticker: s.id })}
                    disabled={busy}
                    aria-label={`Отправить стикер: ${s.label}`}>
                    <img src={s.file} alt={`Стикер: ${s.label}`} loading="lazy"
                      onError={(e) => { e.currentTarget.outerHTML = `<span class="nchat-sticker-miss">${s.label}</span>`; }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Информация о сообщении ===== */}
        {infoFor && (
          <div className="nchat-info-overlay" onClick={(e) => e.target === e.currentTarget && setInfoFor(null)}>
            <div className="nchat-info" role="dialog" aria-modal="true" aria-label="Информация о сообщении">
              <h4>Информация о сообщении</h4>
              <div className="nchat-info-row">
                <span>Отправлено</span><b>{fmtFull(infoFor.created_at)}</b>
              </div>
              <div className="nchat-info-row">
                <span>Прочитано</span>
                <b>
                  {(fromTeacher ? infoFor.read_family : infoFor.read_teacher)
                    ? (infoFor.read_at ? fmtFull(infoFor.read_at) : "да, время не записано")
                    : "ещё нет"}
                </b>
              </div>
              <p className="muted nchat-info-note">
                Доставку на устройство приложение не отслеживает, поэтому
                показываются только отправка и прочтение.
              </p>
              <div className="actions">
                <button className="btn small" onClick={() => setInfoFor(null)}>Закрыть</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
