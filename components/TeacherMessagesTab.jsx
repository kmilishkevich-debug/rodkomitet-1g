"use client";
import { useMemo, useState } from "react";
import FamilyPicker from "./FamilyPicker";
import TeacherFamilyChat from "./TeacherFamilyChat";
import { canonicalN, familyLabel } from "./data";

// ===== Вкладка «Сообщения» (мобильное меню учителя, 23.10.2026) =====
// Переписка с семьями, вынесенная из кабинета в отдельный раздел: в нижней
// панели телефона появилась кнопка «Сообщения», и учителю не нужно листать
// кабинет до карточки. Здесь ПОЛНЫЙ список веток (карточка в кабинете
// показывает только три), сверху — семьи, которые ждут ответа.
// Логика веток та же, что в TeacherTab: одна строка на семью,
// близнецы — общая ветка под каноническим номером.

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function short(s, n = 70) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

// Инициалы семьи для кружка-аватара («Ева Милишкевич» → «ЕМ»)
function initialsOf(label) {
  const words = String(label || "").split(/\s+/).filter((w) => /^[А-ЯЁA-Z]/i.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

// Время последнего сообщения: сегодня — «14:05», раньше — «3 окт»
function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString())
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function TeacherMessagesTab({ authorName, toast, familyMessages, onReloadMessages }) {
  const [pickOpen, setPickOpen] = useState(false);
  const [chatFamily, setChatFamily] = useState(null); // {n, child}

  const msgNew = (familyMessages || []).filter((m) => !m.from_teacher && !m.read_teacher).length;

  // Все ветки (без обрезки до трёх, как в карточке кабинета)
  const threads = useMemo(() => {
    const byFamily = new Map();
    (familyMessages || []).forEach((m) => {
      const n = canonicalN(m.family_n);
      const cur = byFamily.get(n) || { n, last: null, unread: 0 };
      cur.last = m; // сообщения приходят по возрастанию времени
      if (!m.from_teacher && !m.read_teacher) cur.unread += 1;
      byFamily.set(n, cur);
    });
    return [...byFamily.values()].sort((a, b) => {
      if (!!b.unread !== !!a.unread) return b.unread - a.unread;
      return (a.last?.created_at || "") < (b.last?.created_at || "") ? 1 : -1;
    });
  }, [familyMessages]);

  return (
    <section className="tab active teacher-dashboard" id="tab-messages">
      <div className="card tc-work reveal">
        <div className="dash-card-head tc-work-head">
          <img src="/icons/icon-envelope.webp" className="tc-head-img" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">Сообщения от родителей</h2>
            <div className="dash-card-sub">Видно только вам и выбранной семье</div>
          </div>
          {msgNew > 0 && (
            <span className="tc-head-count">
              {msgNew} {plural(msgNew, "новое", "новых", "новых")}
            </span>
          )}
        </div>

        {familyMessages === null && <p className="muted">Загружаем переписку…</p>}
        {familyMessages !== null && !threads.length && (
          <p className="muted">Переписки пока нет. Напишите первой — семья увидит сообщение на главной.</p>
        )}
        {threads.map((t) => (
          <button className="tc-line tc-msg-line" key={t.n}
            onClick={() => setChatFamily({ n: t.n, child: familyLabel(t.n) })}>
            <span className="tc-ava" aria-hidden="true">{initialsOf(familyLabel(t.n))}</span>
            <span className="tc-msg-body">
              <span className="tc-line-title">
                {familyLabel(t.n)}
                {t.unread > 0 && <span className="tc-badge">{t.unread}</span>}
              </span>
              <span className="tc-line-sub">
                {t.last?.from_teacher ? "Вы: " : ""}
                {t.last?.text
                  ? short(t.last.text)
                  : (Array.isArray(t.last?.files) && t.last.files.length ? "📎 Вложение" : "")}
              </span>
            </span>
            <span className="tc-msg-when">{fmtWhen(t.last?.created_at)}</span>
          </button>
        ))}

        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn small primary" onClick={() => setPickOpen(true)}>
            + Написать семье
          </button>
        </div>
      </div>

      <FamilyPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Какой семье написать?"
        onPick={(f) => {
          // Близнецы: любой из детей ведёт в общую ветку семьи
          setChatFamily({ n: canonicalN(f.n), child: familyLabel(f.n) });
          setPickOpen(false);
        }}
      />

      <TeacherFamilyChat
        open={!!chatFamily}
        familyN={chatFamily?.n}
        familyChild={chatFamily?.child}
        messages={familyMessages}
        authorName={authorName || "Учитель"}
        side="teacher"
        onSent={onReloadMessages}
        onClose={() => { setChatFamily(null); onReloadMessages?.(); }}
        toast={toast}
      />
    </section>
  );
}
