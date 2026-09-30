"use client";
import { useEffect, useState } from "react";
import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import { FAMILIES, STAFF, FAMILIES_COUNT, CHILDREN_COUNT, GPD_CHILDREN } from "./data";
import { BIRTHDAYS_FALLBACK, fmtBd, bdName, bdInfo, BD_MONTHS } from "./birthdaysData";
import {
  isLive, fetchChildNotes, saveChildNote,
  saveFamily, addFamily, renameChildEverywhere, addFamilyEdit, fetchFamilyEditsLog,
} from "@/lib/supabase";
import { useRefreshPause, useDraftAutosave, readDraft, clearDraft, confirmDiscard } from "@/lib/formGuard";

// Учебный год: с сентября по август — так календарь идёт «по порядку года класса»
const MONTH_ORDER = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7];
const MONTH_TITLES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

// «именинник/именинника/именинников» — по правилам русского языка
function pluralRu(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function BirthdayCalendar({ list }) {
  const byMonth = {};
  list.forEach((k) => {
    const m = Number(k.born.split("-")[1]) - 1;
    (byMonth[m] = byMonth[m] || []).push(k);
  });
  Object.values(byMonth).forEach((arr) =>
    arr.sort((a, b) => Number(a.born.slice(8, 10)) - Number(b.born.slice(8, 10)))
  );
  return (
    <>
      <div className="sec-head reveal d3">
        <span className="sec-dot pink"><Ic id="i-cake" /></span>
        <h2 className="sec-title">Дни рождения класса</h2>
        <span className="sec-note">{list.length} {pluralRu(list.length, "именинник", "именинника", "именинников")} · комитет получает напоминание за 5 дней, родители — за 1 день</span>
      </div>
      <div className="bday-months reveal d3">
        {MONTH_ORDER.filter((m) => byMonth[m]).map((m) => (
          <div className="card bday-month" key={m}>
            <div className="bday-month-head">{MONTH_TITLES[m]}</div>
            {byMonth[m].map((k) => {
              const info = bdInfo(k.born);
              const isToday = info.days === 0;
              return (
                <div className={"bday-row" + (isToday ? " today" : "")} key={k.id}>
                  <span className="bday-date">{Number(k.born.slice(8, 10))} {BD_MONTHS[m]}</span>
                  <span className="bday-name">{bdName(k)}</span>
                  <span className="bday-turns">{isToday ? `исполняется ${info.turns}!` : `исполнится ${info.turns}`}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// Поля семьи для мини-редактора: ключ, подпись, подсказка
const FAM_FIELDS = [
  ["child", "Ребёнок (Фамилия Имя)", ""],
  ["father", "Папа (ФИО)", ""],
  ["mother", "Мама (ФИО)", ""],
  ["phone1", "Телефон папы", "обычно 80(29) 123-45-67"],
  ["phone2", "Телефон мамы", "обычно 80(29) 123-45-67"],
  ["note", "Заметка", "например «Родительский комитет»"],
  ["twin", "Одна семья с №… (для близнецов)", "номер строки, например 3"],
];
const FAM_FIELD_TITLES = {
  child: "ребёнок", father: "папа", mother: "мама",
  phone1: "телефон папы", phone2: "телефон мамы", note: "заметка", twin: "близнецы",
};

// Семейный код для входа нового ребёнка — как в family-codes-setup.sql: «АБВ-123»
function genFamilyCode() {
  const L = "ABCDEFGHJKMNPQRSTUVWXYZ"; // без похожих I, L, O
  let s = "";
  for (let i = 0; i < 3; i++) s += L[Math.floor(Math.random() * L.length)];
  return s + "-" + String(Math.floor(100 + Math.random() * 900));
}

export default function ClassTab({ committee, teacher, toast, liveBirthdays, families, onReloadFamilies }) {
  const bdays = liveBirthdays || BIRTHDAYS_FALLBACK;
  const canEdit = committee || teacher;
  const editorName = teacher ? "Учитель" : "Комитет";

  // Строки таблицы: живой список из базы (выбывшие видны только комитету и учителю)
  // или встроенный запасной список, пока база не настроена.
  const rows = families
    ? families
        .filter((f) => !f.hidden || canEdit)
        .map((f) => ({ ...f, parents: [f.father, f.mother].filter(Boolean), phones: [f.phone1, f.phone2].filter(Boolean) }))
    : FAMILIES.map((f) => ({ ...f, hidden: false }));
  // «Фамилия Имя» → дата рождения, чтобы показать дату прямо в таблице семей
  const bornByChild = Object.fromEntries(bdays.map((k) => [`${k.last} ${k.first}`, k.born]));

  // Пометки по детям: ГПД + заметки. Живые — из базы, запасные — встроенный список
  const [notes, setNotes] = useState(null);
  const [editChild, setEditChild] = useState(null);
  const [editGpd, setEditGpd] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reloadNotes = async () => setNotes(await fetchChildNotes());
  useEffect(() => { reloadNotes(); }, []);

  const noteFor = (child) =>
    notes ? notes[child] || { gpd: false, note: "" } : { gpd: GPD_CHILDREN.includes(child), note: "" };

  // Пока открыт мини-редактор пометки — фоновое обновление на паузе,
  // а набранное сохраняется черновиком (вкладка может перезагрузиться).
  const [baseNote, setBaseNote] = useState(null);
  const dkey = editChild ? "childnote:" + editChild : "";
  useRefreshPause(!!editChild);
  useDraftAutosave(
    !!editChild,
    dkey,
    { gpd: editGpd, note: editNote },
    !!editChild && baseNote && (editGpd !== baseNote.gpd || editNote !== baseNote.note)
  );

  const startEditNote = (child) => {
    if (!isLive || !notes) {
      return toast("Редактирование пометок заработает после запуска файла gpd-notes-setup.sql в Supabase");
    }
    const cur = noteFor(child);
    const base = { gpd: !!cur.gpd, note: cur.note || "" };
    const d = readDraft("childnote:" + child);
    setEditChild(child);
    setEditGpd(d ? !!d.gpd : base.gpd);
    setEditNote(d ? d.note || "" : base.note);
    setBaseNote(base);
  };

  const cancelEditNote = () => {
    const dirty = baseNote && (editGpd !== baseNote.gpd || editNote !== baseNote.note);
    if (!confirmDiscard(dirty, "Закрыть пометку без сохранения? Набранный текст пропадёт.")) return;
    clearDraft(dkey);
    setEditChild(null);
  };

  const saveEditNote = async () => {
    setSaving(true);
    try {
      await saveChildNote(editChild, editGpd, editNote.trim());
      clearDraft(dkey);
      setEditChild(null);
      toast("Пометка сохранена");
      reloadNotes();
    } catch (e) {
      toast("Не получилось сохранить: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  // ===== Редактор семьи: ФИО, телефоны, заметка, близнецы, скрытие, добавление =====
  const [famEdit, setFamEdit] = useState(null); // номер семьи или "new"
  const [famForm, setFamForm] = useState(null);
  const [famBase, setFamBase] = useState(null);
  const [famSaving, setFamSaving] = useState(false);
  const [log, setLog] = useState(null);
  const [showLog, setShowLog] = useState(false);

  const famKey = famEdit != null ? "family:" + famEdit : "";
  const famDirty = !!(famBase && famForm && FAM_FIELDS.some(([k]) => famForm[k] !== famBase[k]));
  useRefreshPause(famEdit != null);
  useDraftAutosave(famEdit != null, famKey, famForm, famDirty);

  const famGuard = () => {
    if (!isLive || !families) {
      toast("Редактирование списков заработает после запуска файла families-setup.sql в Supabase");
      return false;
    }
    return true;
  };

  const startFamEdit = (f) => {
    if (!famGuard()) return;
    const base = {
      child: f.child, father: f.father || "", mother: f.mother || "",
      phone1: f.phone1 || "", phone2: f.phone2 || "", note: f.note || "",
      twin: f.twin_with ? String(f.twin_with) : "",
    };
    const d = readDraft("family:" + f.n);
    setFamEdit(f.n);
    setFamForm(d || { ...base });
    setFamBase(base);
  };

  const startFamAdd = () => {
    if (!famGuard()) return;
    const base = { child: "", father: "", mother: "", phone1: "", phone2: "", note: "", twin: "" };
    const d = readDraft("family:new");
    setFamEdit("new");
    setFamForm(d || base);
    setFamBase(base);
  };

  const cancelFamEdit = () => {
    if (!confirmDiscard(famDirty, "Закрыть без сохранения? Набранное пропадёт.")) return;
    clearDraft(famKey);
    setFamEdit(null);
  };

  const saveFam = async () => {
    const child = famForm.child.trim();
    if (!child) return toast("Укажите фамилию и имя ребёнка");
    const twinRaw = famForm.twin.trim();
    const twin = twinRaw === "" ? null : Number(twinRaw);
    if (twinRaw !== "" && (!Number.isInteger(twin) || twin < 1)) {
      return toast("«Одна семья с №…» — укажите номер строки из списка, например 3");
    }
    const fields = {
      child, father: famForm.father.trim(), mother: famForm.mother.trim(),
      phone1: famForm.phone1.trim(), phone2: famForm.phone2.trim(),
      note: famForm.note.trim(), twin_with: twin,
    };
    setFamSaving(true);
    try {
      if (famEdit === "new") {
        const n = Math.max(0, ...families.map((f) => f.n)) + 1;
        const code = genFamilyCode();
        await addFamily({ n, ...fields }, code);
        addFamilyEdit({ n, child, field: "добавлен", old_value: "", new_value: child, editor: editorName });
        toast(`${child} — в списке под №${n}. Семейный код для входа: ${code}`);
      } else {
        await saveFamily(famEdit, fields);
        if (child !== famBase.child) await renameChildEverywhere(famBase.child, child);
        FAM_FIELDS.forEach(([k]) => {
          const newV = k === "twin" ? twinRaw : fields[k];
          if (newV !== famBase[k]) {
            addFamilyEdit({ n: famEdit, child, field: FAM_FIELD_TITLES[k], old_value: famBase[k], new_value: newV, editor: editorName });
          }
        });
        toast("Сохранено — изменения видны во всём приложении");
      }
      clearDraft(famKey);
      setFamEdit(null);
      onReloadFamilies && onReloadFamilies();
    } catch (e) {
      toast("Не получилось сохранить: " + (e.message || e));
    } finally {
      setFamSaving(false);
    }
  };

  const toggleHidden = async (f) => {
    if (!famGuard()) return;
    const to = !f.hidden;
    if (to && !window.confirm(`Пометить, что ${f.child} выбыл(а) из класса?\nРебёнок скроется из списков, но история и деньги сохранятся — вернуть можно в любой момент.`)) return;
    try {
      await saveFamily(f.n, { hidden: to });
      addFamilyEdit({ n: f.n, child: f.child, field: to ? "скрыт" : "возвращён", old_value: "", new_value: to ? "выбыл(а)" : "снова в классе", editor: editorName });
      toast(to ? "Помечено: выбыл(а). Строка осталась у комитета — можно «Вернуть»" : `${f.child} снова в списке класса`);
      onReloadFamilies && onReloadFamilies();
    } catch (e) {
      toast("Не получилось: " + (e.message || e));
    }
  };

  const toggleLog = async () => {
    if (showLog) return setShowLog(false);
    if (!famGuard()) return;
    setLog(await fetchFamilyEditsLog());
    setShowLog(true);
  };

  return (
    <section id="tab-class">
      <div className="section-cover reveal d1" style={{ background: "var(--blue-soft)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <NavIcon name="class" uid="h-class" size={32} className="nvi-big" />Наш класс{" "}
          <span style={{ fontFamily: "'Comfortaa'", fontSize: 13, fontWeight: 700 }}>— {CHILDREN_COUNT} детей · {FAMILIES_COUNT} семей</span>
        </h2>
      </div>

      <div className="grid cols2 reveal d2" style={{ marginBottom: 14 }}>
        {STAFF.map((s) => (
          <div className="card" key={s.name}>
            <div className="muted" style={{ marginBottom: 4 }}>{s.role}</div>
            <h3 style={{ margin: "0 0 6px" }}>{s.name}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CIc id="i-phone" tone="blue" size="sm" /> {s.phone}</div>
          </div>
        ))}
      </div>

      <BirthdayCalendar list={bdays} />

      <div className="card reveal d3">
        <div className="kids-scroll">
        <table>
          <tbody>
            <tr><th>№</th><th>Ребёнок</th><th>Родители</th><th>Телефоны</th></tr>
            {rows.map((f) => (
              <tr key={f.n} style={f.hidden ? { opacity: 0.55 } : undefined}>
                <td>{f.n}</td>
                <td>
                  <b>{f.child}</b>
                  {f.hidden && (
                    <span className="chip" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5, background: "#EEE", color: "#777" }}>выбыл(а)</span>
                  )}
                  {noteFor(f.child).gpd && !f.hidden && (
                    <span className="chip green" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5 }}>ГПД</span>
                  )}
                  {canEdit && (
                    <button className="mini-btn" title="Изменить семью: ФИО, телефоны, заметка" onClick={() => startFamEdit(f)}>
                      <Ic id="i-edit" />
                    </button>
                  )}
                  {canEdit && f.hidden && (
                    <button className="mini-btn" title="Вернуть ребёнка в список класса" onClick={() => toggleHidden(f)}>↩</button>
                  )}
                  {committee && (
                    <button className="mini-btn" title="Пометка: ГПД и заметка" onClick={() => startEditNote(f.child)}>✎</button>
                  )}
                  {bornByChild[f.child] && (
                    <div className="bday-chip"><Ic id="i-cake" /> {fmtBd(bornByChild[f.child])}</div>
                  )}
                  {f.note && <div><span className="chip violet">{f.note}</span></div>}
                  {editChild === f.child ? (
                    <div style={{ marginTop: 6, display: "grid", gap: 6, maxWidth: 260 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        <input type="checkbox" checked={editGpd} onChange={(e) => setEditGpd(e.target.checked)} />
                        ходит в ГПД
                      </label>
                      <input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEditNote(); if (e.key === "Escape") cancelEditNote(); }}
                        placeholder="Заметка по ребёнку (видна всем)"
                        autoFocus
                        style={{ fontSize: 13, padding: "6px 8px" }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="mini-btn" title="Сохранить" onClick={saveEditNote} disabled={saving}>✓</button>
                        <button className="mini-btn danger" title="Отмена" onClick={cancelEditNote}>✕</button>
                      </div>
                    </div>
                  ) : (
                    noteFor(f.child).note && (
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{noteFor(f.child).note}</div>
                    )
                  )}
                </td>
                <td>
                  {f.parents.map((p) => <div key={p}>{p}</div>)}
                </td>
                <td>
                  {f.phones.map((ph) => <div key={ph} style={{ whiteSpace: "nowrap" }}>{ph}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {famEdit != null && famForm && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: "0 0 10px" }}>
            {famEdit === "new" ? "Новый ребёнок в классе" : `Семья №${famEdit} — правка`}
          </h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 440 }}>
            {FAM_FIELDS.map(([k, title, ph]) => (
              <label key={k} style={{ display: "grid", gap: 3, fontSize: 13, fontWeight: 600 }}>
                {title}
                <input
                  value={famForm[k]}
                  onChange={(e) => setFamForm({ ...famForm, [k]: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Escape") cancelFamEdit(); }}
                  placeholder={ph}
                  autoFocus={k === "child"}
                  style={{ fontSize: 13.5, padding: "8px 10px", fontWeight: 500 }}
                />
              </label>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button className="btn teal small" onClick={saveFam} disabled={famSaving}>
                {famSaving ? "Сохраняю…" : "Сохранить"}
              </button>
              <button className="btn white small" onClick={cancelFamEdit}>Отмена</button>
              {famEdit !== "new" && (() => {
                const cur = families && families.find((x) => x.n === famEdit);
                return cur && !cur.hidden ? (
                  <button className="btn white small" style={{ color: "#A33" }} onClick={() => { setFamEdit(null); clearDraft(famKey); toggleHidden(cur); }}>
                    Ребёнок выбыл — скрыть
                  </button>
                ) : null;
              })()}
            </div>
            {famEdit === "new" && (
              <div className="muted" style={{ fontSize: 12.5 }}>
                Строка в ведомости сборов и семейный код для входа создадутся сами — код покажем после сохранения.
              </div>
            )}
          </div>
        </div>
      )}

      {canEdit && famEdit == null && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn teal small" onClick={startFamAdd}>+ Добавить ребёнка</button>
          <button className="btn white small" onClick={toggleLog}>{showLog ? "Скрыть журнал правок" : "Журнал правок списков"}</button>
        </div>
      )}

      {canEdit && showLog && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: "0 0 8px" }}>Журнал правок списков</h3>
          {!log || !log.length ? (
            <div className="muted">Правок пока не было.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {log.map((e) => (
                <div key={e.id} style={{ fontSize: 13, borderBottom: "1px solid var(--input)", paddingBottom: 6 }}>
                  <b>{e.child}</b> · {e.field}
                  {(e.old_value || e.new_value) && (
                    <> : {e.old_value ? <s style={{ opacity: 0.6 }}>{e.old_value}</s> : "—"} → {e.new_value || "—"}</>
                  )}
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {e.editor} · {new Date(e.at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="muted" style={{ marginTop: 10 }}>
        {canEdit
          ? "Кнопка ✎ у имени — правка семьи: ФИО, телефоны, заметка, близнецы. Все изменения попадают в журнал."
          : "Данные — из общей таблицы класса. Если что-то поменялось, напишите родительскому комитету."}
      </div>
    </section>
  );
}
