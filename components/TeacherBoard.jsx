"use client";
import { toggleFamilyNote, deleteFamilyNote } from "@/lib/supabase";
import { Ic } from "./Art";

// ===== Карточка «От учителя» на «Главной» у родителей =====
// Всё, что публикует классный руководитель, собрано в одном месте
// и визуально отделено от объявлений комитета:
//   • домашнее задание и «что взять с собой»
//   • события класса (поездки, праздники, собрания)
//   • личные заметки лично этой семье (from_teacher = true)

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Сегодня по Минску, в формате YYYY-MM-DD
function minskIso() {
  try {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function shiftIso(iso, days) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// «29 сентября», «сегодня», «завтра»
export function fmtDayWord(iso, todayIso) {
  if (!iso) return "";
  if (iso === todayIso) return "сегодня";
  if (iso === shiftIso(todayIso, 1)) return "завтра";
  if (iso === shiftIso(todayIso, -1)) return "вчера";
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function TeacherBoard({ homework, events, notes, onReloadNotes, toast, onTab }) {
  const todayIso = minskIso();

  // Задания на сегодня и вперёд (вчерашние показываем только сегодня вечером — их
  // уже отфильтровал запрос, здесь просто сортируем и ограничиваем список)
  const hw = (homework || [])
    .filter((h) => h.on_date >= shiftIso(todayIso, -1))
    .sort((a, b) => (a.on_date < b.on_date ? -1 : 1))
    .slice(0, 6);

  const ev = (events || [])
    .filter((e) => e.on_date >= todayIso)
    .sort((a, b) => (a.on_date < b.on_date ? -1 : 1))
    .slice(0, 4);

  // Личные заметки именно от учителя, невыполненные — сверху
  const personal = (notes || [])
    .filter((n) => n.from_teacher)
    .sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return (a.created_at || "") < (b.created_at || "") ? 1 : -1;
    })
    .slice(0, 6);

  if (!hw.length && !ev.length && !personal.length) return null;

  // Имя учителя берём из того, что он же и подписал
  const author =
    hw.find((h) => h.author)?.author ||
    ev.find((e) => e.author)?.author ||
    personal.find((n) => n.author)?.author ||
    "Классный руководитель";

  const toggle = async (n) => {
    try { await toggleFamilyNote(n.id, !n.done); onReloadNotes?.(); }
    catch (e) { console.error(e); toast?.("Не получилось отметить"); }
  };
  const del = async (n) => {
    try { await deleteFamilyNote(n.id); onReloadNotes?.(); toast?.("Заметка убрана"); }
    catch (e) { console.error(e); toast?.("Не получилось убрать"); }
  };

  return (
    <div className="card teacher-board reveal d1">
      <div className="dash-card-head">
        <img src="/icons/icon-backpack.webp" className="head-3d" alt="" />
        <div className="dash-card-titles">
          <h2 className="sec-title">От учителя</h2>
          <div className="dash-card-sub">
            <span className="teacher-chip"><Ic id="i-spark" />{author}</span>
            <span className="teacher-role-word">классный руководитель</span>
          </div>
        </div>
      </div>

      {hw.length > 0 && (
        <div className="tb-sect">
          <div className="tb-sect-title">Домашнее задание</div>
          {hw.map((h) => (
            <div className={"tb-row" + (h.on_date === todayIso ? " now" : "")} key={h.id}>
              <span className="tb-day">{fmtDayWord(h.on_date, todayIso)}</span>
              <div className="tb-body">
                <div className="tb-text">
                  {h.subject && <b className="tb-subject">{h.subject}. </b>}
                  {h.text}
                </div>
                {h.bring && <div className="tb-bring">Взять с собой: {h.bring}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {ev.length > 0 && (
        <div className="tb-sect">
          <div className="tb-sect-title">События класса</div>
          {ev.map((e) => (
            <div className={"tb-row" + (e.on_date === todayIso ? " now" : "")} key={e.id}>
              <span className="tb-day">{fmtDayWord(e.on_date, todayIso)}</span>
              <div className="tb-body">
                <div className="tb-text">
                  <b>{e.title}</b>
                  {e.time_text ? ` · ${e.time_text}` : ""}
                </div>
                {(e.place || e.note) && (
                  <div className="tb-bring">
                    {e.place ? e.place : ""}{e.place && e.note ? " · " : ""}{e.note ? e.note : ""}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {personal.length > 0 && (
        <div className="tb-sect">
          <div className="tb-sect-title">Лично вам</div>
          {personal.map((n) => (
            <div className={"note-row tb-note" + (n.done ? " done" : "")} key={n.id}>
              <label className="note-check">
                <input type="checkbox" checked={!!n.done} onChange={() => toggle(n)} aria-label="Прочитано" />
              </label>
              <div className="note-body">
                <div className="note-text">{n.text}</div>
                <div className="note-meta">
                  <span className="note-tag teacher-tag">от учителя{n.author ? ` · ${n.author}` : ""}</span>
                  {n.remind_date && <span className="note-when">{fmtDayWord(n.remind_date, todayIso)}</span>}
                </div>
              </div>
              <button className="note-del" onClick={() => del(n)} aria-label="Убрать заметку" title="Убрать">✕</button>
            </div>
          ))}
        </div>
      )}

      {onTab && (
        <button className="pill-btn teacher-open" onClick={() => onTab("schedule")}>
          Посмотреть расписание →
        </button>
      )}
    </div>
  );
}
