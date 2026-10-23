"use client";
import { useMemo, useState } from "react";
import { canonicalN, familyLabel } from "./data";

// ===== Карточка «Сообщения от родителей» — мини-мессенджер =====
// ТЗ от 23.10.2026 (TZ_parent_messages.docx, 27 разделов): мягкая мятная
// шапка с 3D-конвертом, счётчик непрочитанных, переключатель
// «Все / Непрочитанные», список переписок с аватарами-инициалами,
// голубой подсветкой непрочитанных и плашками вложений, внизу —
// подпись приватности и кнопка «Написать семье».
//
// Карточка презентационная: диалоги (выбор семьи, чат) живут у родителя
// (TeacherTab / TeacherMessagesTab), чтобы не плодить дубли окон — ТЗ §20.
// Прочтение здесь НЕ фиксируется (ТЗ §18): read_teacher ставит только
// открытие чата (markThreadRead в TeacherFamilyChat).
//
// Props:
//   familyMessages  — сырой список сообщений (null = грузится/недоступно)
//   limit           — сколько строк показывать (3 на главной, null во вкладке)
//   onOpenChat(n)   — открыть переписку семьи с каноническим номером n
//   onNewChat()     — открыть выбор семьи («Написать семье»)
//   onAllLink()     — переход «Все переписки →» (только при limit)
//   onRetry()       — повторная загрузка при недоступных данных

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// Инициалы отправителя: до двух букв («Анна Ковалёва» → «АК»)
function initialsOf(label) {
  const words = String(label || "").split(/\s+/).filter((w) => /^[А-ЯЁA-Z]/i.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

// Палитра аватаров (ТЗ §11): светлый фон + тёмный текст, цвет закреплён
// за семьёй по её номеру и не меняется между перезагрузками.
const AVA_COLORS = [
  { bg: "#EAE2FF", fg: "#6247B5" }, // лавандовый
  { bg: "#FFE5D9", fg: "#9A4E39" }, // персиковый
  { bg: "#DFF4E7", fg: "#347653" }, // мятный
  { bg: "#E2EDFF", fg: "#345CB4" }, // голубой
  { bg: "#FBE3F0", fg: "#9D4578" }, // розовый
];
const avaColor = (n) => AVA_COLORS[Math.abs(Number(n) || 0) % AVA_COLORS.length];

// ===== Время последнего сообщения (ТЗ §14, Europe/Minsk) =====
// Сегодня «14:25», вчера «Вчера», в этом году «21 окт», иначе «21.10.25».
const MON3 = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function toMinsk(iso) {
  try {
    return new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
  } catch {
    return new Date(iso);
  }
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function fmtWhen(iso) {
  if (!iso) return "";
  const d = toMinsk(iso);
  const now = toMinsk(new Date().toISOString());
  if (ymd(d) === ymd(now))
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (ymd(d) === ymd(yest)) return "Вчера";
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MON3[d.getMonth()]}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}

// Полная дата для tooltip и accessible label (ТЗ §14)
function fullWhen(iso) {
  if (!iso) return "";
  const d = toMinsk(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ===== Превью сообщения (ТЗ §13) =====
// Текста нет → тип содержимого: «Фотография», «3 фотографии» или имя
// документа. Пустого превью у сообщения с вложением не бывает.
function previewOf(m) {
  const t = (m?.text || "").trim();
  if (t) return t;
  const files = Array.isArray(m?.files) ? m.files : [];
  if (!files.length) return "";
  const photos = files.filter((f) => (f?.type || "").startsWith("image/"));
  if (photos.length === files.length) {
    return files.length === 1
      ? "Фотография"
      : `${files.length} ${plural(files.length, "фотография", "фотографии", "фотографий")}`;
  }
  return files[0]?.name || "Вложение";
}

// ===== Мелкая графика =====
function PaperclipIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M13.2 7.3 8.1 12.4a3.4 3.4 0 0 1-4.8-4.8L8.9 2a2.3 2.3 0 0 1 3.2 3.2L6.7 10.7a1.1 1.1 0 0 1-1.6-1.6l4.6-4.6"
        stroke="#1765F5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="2" stroke="#81899A" strokeWidth="1.5" />
      <path d="M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7" stroke="#81899A" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="10.5" r="1.1" fill="#81899A" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M9 3.5v11M3.5 9h11" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ===== Плашка вложения (ТЗ §17) =====
// Ссылка, а не кнопка: строка переписки — div role="button", и вкладывать
// в неё <button> нельзя (ТЗ §24). stopPropagation, чтобы клик по файлу
// не открывал одновременно диалог.
function AttachmentChip({ files }) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return null;
  const f = list[0];
  return (
    <span className="attachment-row">
      <a
        className="attachment-chip"
        href={f.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={`Открыть вложение: ${f.name || "файл"}`}
        title={f.name || ""}
      >
        <PaperclipIcon />
        <span className="attachment-name">{f.name || "Файл"}</span>
      </a>
      {list.length > 1 && <span className="attachment-more">+{list.length - 1}</span>}
    </span>
  );
}

// ===== Одна строка переписки (ТЗ §10–§16) =====
function ConversationRow({ t, onOpen }) {
  const famLabel = familyLabel(t.n);
  // ТЗ §12: основное имя — автор сообщения; родство не угадываем.
  // Если имени автора нет (или оно служебное «Родитель»), главным
  // становится семейное обозначение, без второй строки.
  const author = (t.author || "").trim();
  const hasAuthor = !!author && !/^родитель$/i.test(author);
  const name = hasAuthor ? author : famLabel;
  const relation = hasAuthor ? `Семья: ${famLabel}` : null;
  const unread = t.unread > 0;
  const preview = `${t.last?.from_teacher ? "Вы: " : ""}${previewOf(t.last)}`;
  const when = fmtWhen(t.last?.created_at);

  const aria = `Переписка: ${name}${relation ? `, ${relation.toLowerCase()}` : ""}` +
    (unread ? `, непрочитанных: ${t.unread}` : "") +
    (when ? `, последнее сообщение: ${fullWhen(t.last?.created_at)}` : "");

  return (
    <div
      className={"conversation-row " + (unread ? "conversation-row--unread" : "conversation-row--read")}
      role="button"
      tabIndex={0}
      aria-label={aria}
      onClick={() => onOpen(t.n)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t.n); }
      }}
    >
      <span
        className="conversation-avatar"
        aria-hidden="true"
        style={{ background: avaColor(t.n).bg, color: avaColor(t.n).fg }}
      >
        {initialsOf(name)}
      </span>
      <span className="conversation-content">
        <span className={"conversation-name" + (unread ? " is-unread" : "")}>
          {name}
          {unread && <span className="conversation-dot" aria-hidden="true" />}
        </span>
        {relation && <span className="conversation-relation">{relation}</span>}
        <span className={"message-preview" + (relation ? " after-relation" : "")}>{preview}</span>
        <AttachmentChip files={t.last?.files} />
      </span>
      <span className="conversation-meta">
        <time className="conversation-time" title={fullWhen(t.last?.created_at)}>{when}</time>
        {unread && (
          <span className="conversation-unread-count">
            {t.unread > 99 ? "99+" : t.unread}
          </span>
        )}
      </span>
    </div>
  );
}

// ===== Скелет загрузки (ТЗ §21) =====
// familyMessages === null значит «данные недоступны»: API не различает
// загрузку и ошибку, поэтому честно показываем skeleton той же структуры
// и кнопку «Повторить» — она дёргает перезагрузку, если запрос упал.
function PmSkeleton({ onRetry }) {
  return (
    <div className="conversation-list" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div className="conversation-row conversation-row--read pm-skel-row" key={i} aria-hidden="true">
          <span className="conversation-avatar pm-skel" />
          <span className="conversation-content">
            <span className="pm-skel pm-skel-line w55" />
            <span className="pm-skel pm-skel-line w90" />
          </span>
          <span className="conversation-meta"><span className="pm-skel pm-skel-line w100" /></span>
        </div>
      ))}
      <div className="pm-skel-note">
        <span>Не удалось загрузить сообщения?</span>
        {onRetry && <button className="pm-retry" onClick={onRetry}>Повторить</button>}
      </div>
    </div>
  );
}

export default function ParentMessagesCard({
  familyMessages, limit = null,
  onOpenChat, onNewChat, onAllLink, onRetry,
}) {
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'

  // Счётчик шапки — непрочитанные СООБЩЕНИЯ (не семьи), включая диалоги
  // за пределами видимых строк (ТЗ §8).
  const msgNew = (familyMessages || []).filter((m) => !m.from_teacher && !m.read_teacher).length;

  // Ветки: одна строка на семью (близнецы — общая под каноническим номером),
  // непрочитанные сверху, внутри групп — по времени последнего сообщения.
  const threads = useMemo(() => {
    const byFamily = new Map();
    (familyMessages || []).forEach((m) => {
      const n = canonicalN(m.family_n);
      const cur = byFamily.get(n) || { n, last: null, unread: 0, author: null };
      cur.last = m; // сообщения приходят по возрастанию времени
      if (!m.from_teacher) {
        if (!m.read_teacher) cur.unread += 1;
        if (m.author) cur.author = m.author; // последний писавший родитель
      }
      byFamily.set(n, cur);
    });
    return [...byFamily.values()].sort((a, b) => {
      if (!!b.unread !== !!a.unread) return b.unread - a.unread;
      return (a.last?.created_at || "") < (b.last?.created_at || "") ? 1 : -1;
    });
  }, [familyMessages]);

  const filtered = filter === "unread" ? threads.filter((t) => t.unread > 0) : threads;
  const shown = limit ? filtered.slice(0, limit) : filtered;

  const loading = familyMessages === null;
  const noThreads = !loading && threads.length === 0;
  const emptyFilter = !loading && threads.length > 0 && filtered.length === 0;

  // Стрелки влево/вправо между вкладками фильтра (ТЗ §24)
  const onTabsKey = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = filter === "all" ? "unread" : "all";
      setFilter(next);
      e.currentTarget.querySelector(`[data-f="${next}"]`)?.focus();
    }
  };

  return (
    <div className="pm-wrap" id="tc-card-msg">
      <section className="parent-messages-card reveal d2" aria-label="Сообщения от родителей">
        {/* Мятная шапка (ТЗ §6–§8) */}
        <header className="parent-messages-header">
          <img src="/icons/icon-envelope.webp" className="pm-head-icon" alt="" />
          <div className="pm-title-group">
            <div className="pm-title-line">
              <h2 className="pm-title">Сообщения от родителей</h2>
              {msgNew > 0 && (
                <span className="header-unread-badge" aria-live="polite">
                  {msgNew > 99 ? "99+" : msgNew} {plural(Math.min(msgNew, 99), "новое", "новых", "новых")}
                </span>
              )}
            </div>
            <p className="pm-sub">Личная переписка с семьями</p>
          </div>
        </header>

        {/* Панель фильтров (ТЗ §9) */}
        <div className="pm-toolbar">
          <div className="pm-tabs" role="tablist" aria-label="Фильтр переписок" onKeyDown={onTabsKey}>
            <button
              className={"pm-tab" + (filter === "all" ? " is-active" : "")}
              role="tab" aria-selected={filter === "all"} data-f="all"
              tabIndex={filter === "all" ? 0 : -1}
              onClick={() => setFilter("all")}
            >Все</button>
            <button
              className={"pm-tab" + (filter === "unread" ? " is-active" : "")}
              role="tab" aria-selected={filter === "unread"} data-f="unread"
              tabIndex={filter === "unread" ? 0 : -1}
              onClick={() => setFilter("unread")}
            >Непрочитанные</button>
          </div>
          {limit != null && onAllLink && (
            <button className="pm-all-link" onClick={onAllLink}>
              Все переписки
              <ArrowIcon />
            </button>
          )}
        </div>

        {/* Список переписок (ТЗ §10–§18, §21) */}
        {loading && <PmSkeleton onRetry={onRetry} />}
        {noThreads && (
          <div className="pm-empty">
            <div className="pm-empty-title">Переписок пока нет</div>
            <div className="pm-empty-hint">Выберите семью, чтобы написать родителям.</div>
          </div>
        )}
        {emptyFilter && (
          <div className="pm-empty">
            <div className="pm-empty-title">Все сообщения прочитаны</div>
            <div className="pm-empty-hint">Новые сообщения появятся здесь.</div>
          </div>
        )}
        {!loading && shown.length > 0 && (
          <div className="conversation-list">
            {shown.map((t) => (
              <ConversationRow key={t.n} t={t} onOpen={onOpenChat} />
            ))}
          </div>
        )}

        {/* Нижняя панель (ТЗ §19–§20). Подпись честная: переписку видят
            учитель и семья — доступ другим ролям закрыт интерфейсом. */}
        <footer className="parent-messages-footer">
          <span className="pm-privacy">
            <LockIcon />
            Видно только вам и семье
          </span>
          <button className="pm-write-btn" onClick={onNewChat}>
            <PlusIcon />
            Написать семье
          </button>
        </footer>
      </section>
    </div>
  );
}
