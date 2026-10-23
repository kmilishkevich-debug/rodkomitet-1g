"use client";
import { familyNs } from "./data";
import {
  plural, initialsOf, AVA_COLORS, fmtWhen, fullWhen, previewOf,
  AttachmentChip, LockIcon, PlusIcon, PmSkeleton,
} from "./ParentMessagesCard";

// ===== Карточка «Переписка с учителем» на главной родителя =====
// Тот же дизайн, что у мини-мессенджера учителя (ТЗ 23.10.2026), но у семьи
// один собеседник — классный руководитель, поэтому без фильтров и списка
// семей: одна строка с последним сообщением, счётчиком непрочитанных
// и кнопкой «Написать учителю». Прочтение здесь не фиксируется — его
// ставит открытие чата (markThreadRead в TeacherFamilyChat).
//
// Props:
//   familyMessages — сырой список сообщений (null = грузится/недоступно)
//   family         — выбранная семья {n, child} или null
//   teacherName    — имя классного руководителя из справочника STAFF
//   onOpenChat()   — открыть окно переписки (без семьи — выбор семьи)
//   onRetry()      — повторная загрузка при недоступных данных

export default function ParentTeacherCard({
  familyMessages, family, teacherName, onOpenChat, onRetry,
}) {
  const ns = family ? familyNs(family.n) : [];
  const msgs = (familyMessages || []).filter((m) => ns.includes(m.family_n));
  const last = msgs.length ? msgs[msgs.length - 1] : null;
  // Непрочитанные СЕМЬЁЙ сообщения учителя — бейдж шапки и счётчик строки
  const unread = msgs.filter((m) => m.from_teacher && !m.read_family).length;

  const loading = family && familyMessages === null;
  const name = teacherName || "Классный руководитель";
  const ava = AVA_COLORS[2]; // мятный — закреплён за учителем
  // «Вы: » — перед сообщениями своей семьи (в этой карточке «вы» = родитель)
  const preview = last ? `${last.from_teacher ? "" : "Вы: "}${previewOf(last)}` : "";
  const when = last ? fmtWhen(last.created_at) : "";

  const aria = `Переписка с учителем: ${name}` +
    (unread ? `, непрочитанных: ${unread}` : "") +
    (last ? `, последнее сообщение: ${fullWhen(last.created_at)}` : "");

  return (
    <div className="pm-wrap pm-wrap--parent">
      <section className="parent-messages-card reveal d2" aria-label="Переписка с учителем">
        <header className="parent-messages-header">
          <img src="/icons/icon-envelope.webp" className="pm-head-icon" alt="" />
          <div className="pm-title-group">
            <div className="pm-title-line">
              <h2 className="pm-title">Переписка с учителем</h2>
              {unread > 0 && (
                <span className="header-unread-badge" aria-live="polite">
                  {unread > 99 ? "99+" : unread} {plural(Math.min(unread, 99), "новое", "новых", "новых")}
                </span>
              )}
            </div>
            <p className="pm-sub">{name}</p>
          </div>
        </header>

        {loading && <PmSkeleton onRetry={onRetry} />}

        {!loading && !family && (
          <div className="pm-empty">
            <div className="pm-empty-title">Сначала выберите свою семью</div>
            <div className="pm-empty-hint">Нажмите «Написать учителю» — и выберите ребёнка из списка.</div>
          </div>
        )}

        {!loading && family && !last && (
          <div className="pm-empty">
            <div className="pm-empty-title">Переписки пока нет</div>
            <div className="pm-empty-hint">Напишите первое сообщение — учитель увидит его в своём кабинете.</div>
          </div>
        )}

        {!loading && last && (
          <div className="conversation-list">
            <div
              className={"conversation-row " + (unread ? "conversation-row--unread" : "conversation-row--read")}
              role="button"
              tabIndex={0}
              aria-label={aria}
              onClick={onOpenChat}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenChat(); }
              }}
            >
              <span
                className="conversation-avatar"
                aria-hidden="true"
                style={{ background: ava.bg, color: ava.fg }}
              >
                {initialsOf(name)}
              </span>
              <span className="conversation-content">
                {/* Имя, точка и роль — в одну строку, как на референсе */}
                <span className={"conversation-name" + (unread ? " is-unread" : "")}>
                  {name}
                  {unread > 0 && <span className="conversation-dot" aria-hidden="true" />}
                  <span className="conversation-relation">Классный руководитель</span>
                </span>
                <span className="message-preview after-relation">{preview}</span>
                <AttachmentChip files={last.files} />
              </span>
              <span className="conversation-meta">
                <time className="conversation-time" title={fullWhen(last.created_at)}>{when}</time>
                {unread > 0 && (
                  <span className="conversation-unread-count">{unread > 99 ? "99+" : unread}</span>
                )}
              </span>
            </div>
          </div>
        )}

        <footer className="parent-messages-footer">
          <span className="pm-privacy">
            <LockIcon />
            Видно только вам и учителю
          </span>
          <button className="pm-write-btn" onClick={onOpenChat}>
            <PlusIcon />
            Написать учителю
          </button>
        </footer>
      </section>
    </div>
  );
}
