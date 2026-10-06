"use client";
import { useCallback, useEffect, useState } from "react";
import {
  fetchFamilyAbsences, fetchAllAbsences,
  addAbsence, updateAbsence, deleteAbsence,
} from "@/lib/supabase";
import { FAMILIES, familyNs } from "./data";
import { fmtDayWord } from "./TeacherBoard";
import { fmtDateRu } from "./scheduleOverrides";

// ===== Отсутствия детей =====
// Родитель отмечает на главной, что ребёнка не будет в школе: даты, причина
// и какой документ принесут — справку или заявление. Учитель видит сводку
// на сегодня и предупреждения на ближайшие дни. Другие родители чужих
// отсутствий не видят: семья запрашивает только свои записи.

const REASONS = [
  { id: "illness",     label: "Болезнь" },
  { id: "family",      label: "Семейные обстоятельства" },
  { id: "doctor",      label: "Визит к врачу" },
  { id: "competition", label: "Соревнования / конкурсы" },
  { id: "other",       label: "Другое" },
];

const DOCS = [
  { id: "spravka",    label: "Справка",   hint: "от врача — обычно при болезни" },
  { id: "zayavlenie", label: "Заявление", hint: "от родителей — по семейным и плановым причинам" },
];

export function reasonLabel(id) {
  return REASONS.find((r) => r.id === id)?.label || "Другое";
}
export function docLabel(id) {
  return DOCS.find((d) => d.id === id)?.label || "Документ";
}

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

// Человеческая строка периода: «сегодня», «с 8 по 10 октября», «с 8 октября, пока не выйдем»
function periodText(a, todayIso) {
  if (!a.date_to) {
    return a.date_from <= todayIso
      ? `с ${fmtDateRu(a.date_from)} · пока не выйдем`
      : `с ${fmtDateRu(a.date_from)} · без конечной даты`;
  }
  if (a.date_from === a.date_to) return fmtDayWord(a.date_from, todayIso);
  return `с ${fmtDateRu(a.date_from)} по ${fmtDateRu(a.date_to)}`;
}

// Отсутствие ещё «живое»: идёт сейчас или только предстоит
function isActive(a, todayIso) {
  return !a.date_to || a.date_to >= todayIso;
}

// ===== Карточка родителя на главной =====
export function AbsenceCard({ family, toast }) {
  const ns = familyNs(family.n);
  const kids = ns.map((n) => FAMILIES.find((f) => f.n === n)).filter(Boolean);

  const [list, setList] = useState(undefined); // undefined = грузим, null = таблицы нет
  const [formOpen, setFormOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Поля формы
  const [kidN, setKidN] = useState(ns[0]);
  const [reason, setReason] = useState("illness");
  const [reasonNote, setReasonNote] = useState("");
  const [docType, setDocType] = useState("spravka");
  const [openEnd, setOpenEnd] = useState(true); // «болеем, пока не выйдем»
  const todayIso = minskIso();
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setList(await fetchFamilyAbsences(ns));
  }, [family.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (list === null) return null; // база не настроена — карточку не показываем

  const items = list || [];
  const active = items.filter((a) => isActive(a, todayIso));
  // Напоминание о документе: отсутствие закончилось, а справку/заявление ещё не передали
  const needDoc = items.filter((a) => a.date_to && a.date_to < todayIso && !a.doc_done);
  const history = items.filter((a) => a.date_to && a.date_to < todayIso);

  const resetForm = () => {
    setKidN(ns[0]); setReason("illness"); setReasonNote("");
    setDocType("spravka"); setOpenEnd(true);
    setDateFrom(minskIso()); setDateTo("");
  };

  const submit = async () => {
    const kid = kids.find((k) => k.n === kidN) || kids[0];
    const note = reasonNote.trim();
    if (reason === "other" && !note) { toast("Напишите причину в поле «Другое»"); return; }
    if (dateFrom < todayIso) { toast("Задним числом отметить нельзя — только с сегодняшнего дня"); return; }
    if (!openEnd && dateTo && dateTo < dateFrom) { toast("Последний день раньше первого — проверьте даты"); return; }
    setSaving(true);
    try {
      await addAbsence({
        family_n: kid.n,
        child: kid.child,
        date_from: dateFrom,
        date_to: openEnd ? null : (dateTo || dateFrom),
        reason,
        reason_note: note || null,
        doc_type: docType,
      });
      toast("Отметили. Учитель увидит в своей сводке");
      setFormOpen(false);
      resetForm();
      load();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  // «Вышли в школу»: закрываем открытое отсутствие вчерашним днём
  // (нажимают в день выхода — значит, последний день пропуска был вчера)
  const cameBack = async (a) => {
    const end = a.date_from < todayIso ? shiftIso(todayIso, -1) : a.date_from;
    try {
      await updateAbsence(a.id, { date_to: end });
      toast("С возвращением! Не забудьте передать " + (a.doc_type === "spravka" ? "справку" : "заявление"));
      load();
    } catch (e) { console.error(e); toast("Не получилось отметить"); }
  };

  const docDone = async (a) => {
    try {
      await updateAbsence(a.id, { doc_done: true, doc_done_at: new Date().toISOString() });
      toast("Отметили: документ передан");
      load();
    } catch (e) { console.error(e); toast("Не получилось отметить"); }
  };

  const del = async (a) => {
    try { await deleteAbsence(a.id); toast("Отметка удалена"); load(); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };

  return (
    <>
      {/* Плашки-напоминания: пропуск закончился, документ ещё не передан */}
      {needDoc.map((a) => (
        <div key={"doc" + a.id} className="attn-card reveal d1">
          <div className="attn-ico gold"><span className="abs-attn-emoji" aria-hidden="true">📄</span></div>
          <div className="attn-body">
            <div className="attn-title">
              Не забудьте передать {a.doc_type === "spravka" ? "справку" : "заявление"}
              {kids.length > 1 ? ` (${a.child.split(" ")[1] || a.child})` : ""}
            </div>
            <div className="attn-sub">
              Пропуск {periodText(a, todayIso)} · {reasonLabel(a.reason).toLowerCase()}
            </div>
          </div>
          <button className="pill-btn blue" onClick={() => docDone(a)}>Передали</button>
        </div>
      ))}

      <div className="card abs-card reveal d2">
        <div className="dash-card-head">
          <img src="/icons/icon-calendar.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">Если ребёнка не будет</h2>
            <div className="dash-card-sub">Видно только вашей семье и учителю</div>
          </div>
        </div>

        {/* Активные и будущие отсутствия */}
        {active.map((a) => (
          <div className="abs-row" key={a.id}>
            <div className="abs-row-body">
              <div className="abs-row-title">
                {kids.length > 1 ? <b>{a.child.split(" ")[1] || a.child} · </b> : null}
                {reasonLabel(a.reason)}
                {a.reason_note ? ` — ${a.reason_note}` : ""}
              </div>
              <div className="abs-row-sub">
                {periodText(a, todayIso)} · {a.doc_type === "spravka" ? "будет справка" : "будет заявление"}
              </div>
            </div>
            {!a.date_to && a.date_from <= todayIso && (
              <button className="pill-btn blue abs-back" onClick={() => cameBack(a)}>Вышли в школу</button>
            )}
            <button className="note-del" onClick={() => del(a)} aria-label="Отменить отметку" title="Отменить">✕</button>
          </div>
        ))}

        {list === undefined && <div className="muted abs-hint">Загружаем…</div>}

        {list !== undefined && !active.length && !formOpen && (
          <div className="muted abs-hint">
            Заболели, к врачу или уезжаете? Отметьте здесь — учитель сразу увидит,
            а другие родители ничего не узнают.
          </div>
        )}

        {!formOpen ? (
          <div className="abs-actions">
            <button className="pill-btn blue" onClick={() => { resetForm(); setFormOpen(true); }}>
              + Отметить отсутствие
            </button>
            {history.length > 0 && (
              <button className="abs-hist-btn" onClick={() => setHistOpen(!histOpen)}>
                История пропусков ({history.length}) {histOpen ? "▴" : "▾"}
              </button>
            )}
          </div>
        ) : (
          <div className="abs-form">
            {kids.length > 1 && (
              <div className="abs-field">
                <div className="abs-lbl">Кого не будет</div>
                <div className="abs-pills">
                  {kids.map((k) => (
                    <button key={k.n} className={"abs-pill" + (kidN === k.n ? " on" : "")}
                      onClick={() => setKidN(k.n)}>
                      {k.child.split(" ")[1] || k.child}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="abs-field">
              <div className="abs-lbl">Причина</div>
              <div className="abs-pills">
                {REASONS.map((r) => (
                  <button key={r.id} className={"abs-pill" + (reason === r.id ? " on" : "")}
                    onClick={() => {
                      setReason(r.id);
                      // Подсказываем подходящий документ, но выбор остаётся за родителем
                      if (r.id === "illness") setDocType("spravka");
                      else setDocType("zayavlenie");
                      if (r.id !== "illness") setOpenEnd(false);
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>
              {reason === "other" && (
                <input className="note-input abs-note" type="text" maxLength={120}
                  placeholder="Какая причина?"
                  value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
              )}
            </div>

            <div className="abs-field">
              <div className="abs-lbl">Какой документ принесёте</div>
              <div className="abs-pills">
                {DOCS.map((d) => (
                  <button key={d.id} className={"abs-pill" + (docType === d.id ? " on" : "")}
                    onClick={() => setDocType(d.id)} title={d.hint}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="abs-doc-hint">{DOCS.find((d) => d.id === docType)?.hint}</div>
            </div>

            <div className="abs-field">
              <div className="abs-lbl">Даты</div>
              <label className="abs-check">
                <input type="checkbox" checked={openEnd} onChange={(e) => setOpenEnd(e.target.checked)} />
                Пока не знаем, когда выйдем (отметите «Вышли» при возвращении)
              </label>
              <div className="abs-dates">
                <label className="abs-date-lbl">
                  С
                  <input className="note-date" type="date" value={dateFrom} min={todayIso}
                    onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                {!openEnd && (
                  <label className="abs-date-lbl">
                    по
                    <input className="note-date" type="date" value={dateTo} min={dateFrom}
                      onChange={(e) => setDateTo(e.target.value)} />
                  </label>
                )}
              </div>
              {!openEnd && !dateTo && (
                <div className="abs-doc-hint">Если «по» не указать — отметим один день {fmtDayWord(dateFrom, todayIso)}</div>
              )}
            </div>

            <div className="abs-form-btns">
              <button className="pill-btn blue" onClick={submit} disabled={saving}>
                {saving ? "Сохраняю…" : "Отметить"}
              </button>
              <button className="pill-btn" onClick={() => setFormOpen(false)}>Отмена</button>
            </div>
          </div>
        )}

        {/* История пропусков семьи */}
        {histOpen && history.map((a) => (
          <div className="abs-row past" key={"h" + a.id}>
            <div className="abs-row-body">
              <div className="abs-row-title">
                {kids.length > 1 ? <b>{a.child.split(" ")[1] || a.child} · </b> : null}
                {reasonLabel(a.reason)}{a.reason_note ? ` — ${a.reason_note}` : ""}
              </div>
              <div className="abs-row-sub">
                {periodText(a, todayIso)} · {a.doc_done
                  ? (a.doc_type === "spravka" ? "справка передана ✓" : "заявление передано ✓")
                  : (a.doc_type === "spravka" ? "справка ещё не передана" : "заявление ещё не передано")}
              </div>
            </div>
            <button className="note-del" onClick={() => del(a)} aria-label="Удалить из истории" title="Удалить">✕</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ===== Сводка учителя «Кого нет в школе» =====
// Самодостаточная карточка для кабинета учителя: сама грузит данные
// и обновляет их раз в минуту (плюс при возвращении на вкладку).
export function TeacherAbsenceCard() {
  const [list, setList] = useState(undefined);
  const [histOpen, setHistOpen] = useState(false);
  const todayIso = minskIso();

  const load = useCallback(async () => {
    setList(await fetchAllAbsences());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const items = list || [];
  const todayList = items
    .filter((a) => a.date_from <= todayIso && (!a.date_to || a.date_to >= todayIso))
    .sort((a, b) => a.child.localeCompare(b.child, "ru"));
  const upcoming = items
    .filter((a) => a.date_from > todayIso)
    .sort((a, b) => (a.date_from < b.date_from ? -1 : 1))
    .slice(0, 5);
  const past = items.filter((a) => a.date_to && a.date_to < todayIso).slice(0, 20);

  return (
    <div className="card tc-work reveal d3" id="tc-card-abs">
      <div className="dash-card-head tc-work-head">
        <svg className="tc-head-ico tone-blue" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="15" r="7" fill="currentColor" opacity=".16" />
          <circle cx="20" cy="15" r="7" stroke="currentColor" strokeWidth="2.4" />
          <path d="M8 34a12 12 0 0 1 24 0" fill="currentColor" opacity=".16" />
          <path d="M8 34a12 12 0 0 1 24 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M28.5 8.5 35 15M35 8.5 28.5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <div className="dash-card-titles">
          <h2 className="sec-title">Кого нет в школе</h2>
          <div className="dash-card-sub">Отметки родителей · причина и документ</div>
        </div>
      </div>

      {list === undefined && (
        <div className="tc-card-skel" aria-busy="true">
          <span className="tc-skel tc-skel-row"></span>
          <span className="tc-skel tc-skel-row w70"></span>
        </div>
      )}

      {list === null && (
        <div className="muted abs-hint">
          Раздел заработает после настройки базы (файл absences-setup.sql).
        </div>
      )}

      {Array.isArray(list) && !todayList.length && !upcoming.length && (
        <div className="muted abs-hint">Сегодня отметок нет — по данным родителей все в школе 👍</div>
      )}

      {todayList.length > 0 && (
        <div className="abs-t-lbl">Сегодня отсутствуют · {todayList.length}</div>
      )}
      {todayList.map((a) => (
        <div className="tb-row" key={a.id}>
          <div className="tb-body">
            <div className="tb-text">
              <b>{a.child}</b> — {reasonLabel(a.reason).toLowerCase()}
              {a.reason_note ? ` (${a.reason_note})` : ""}
            </div>
            <div className="tb-bring">
              {periodText(a, todayIso)} · {a.doc_type === "spravka" ? "будет справка" : "будет заявление"}
            </div>
          </div>
        </div>
      ))}

      {upcoming.length > 0 && <div className="abs-t-lbl">Предупредили заранее</div>}
      {upcoming.map((a) => (
        <div className="tb-row" key={a.id}>
          <span className="tb-day">{fmtDayWord(a.date_from, todayIso)}</span>
          <div className="tb-body">
            <div className="tb-text">
              <b>{a.child}</b> — {reasonLabel(a.reason).toLowerCase()}
              {a.reason_note ? ` (${a.reason_note})` : ""}
            </div>
            <div className="tb-bring">
              {periodText(a, todayIso)} · {a.doc_type === "spravka" ? "будет справка" : "будет заявление"}
            </div>
          </div>
        </div>
      ))}

      {past.length > 0 && (
        <button className="abs-hist-btn" onClick={() => setHistOpen(!histOpen)}>
          Прошлые пропуски ({past.length}) {histOpen ? "▴" : "▾"}
        </button>
      )}
      {histOpen && past.map((a) => (
        <div className="tb-row" key={"p" + a.id}>
          <div className="tb-body">
            <div className="tb-text">{a.child} — {reasonLabel(a.reason).toLowerCase()}</div>
            <div className="tb-bring">
              {periodText(a, todayIso)} · {a.doc_done
                ? (a.doc_type === "spravka" ? "справка передана ✓" : "заявление передано ✓")
                : (a.doc_type === "spravka" ? "ждём справку" : "ждём заявление")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
