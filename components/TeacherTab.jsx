"use client";
import { useState } from "react";
import {
  saveHomework, deleteHomework,
  saveClassEvent, deleteClassEvent,
  addFamilyNote, deleteFamilyNote,
} from "@/lib/supabase";
import { sendManualPush } from "@/lib/push";
import { Ic } from "./Art";
import FamilyPicker from "./FamilyPicker";
import { fmtDayWord } from "./TeacherBoard";

// ===== Кабинет классного руководителя =====
// Отдельный экран только для учителя: крупные кнопки и короткие формы.
// Денег и личных заметок семей здесь нет — учитель их не видит.

function minskIso() {
  try {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function tomorrowIso() {
  const d = new Date(minskIso() + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Галочка «уведомить родителей» — одна на все формы, учитель решает сам
function NotifyBox({ on, onChange }) {
  return (
    <label className="notify-box">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>Уведомить родителей (пуш на телефон)</span>
    </label>
  );
}

// Одна крупная кнопка действия
function BigBtn({ icon, title, sub, tone, onClick, active }) {
  return (
    <button className={"tchr-btn " + (tone || "") + (active ? " active" : "")} onClick={onClick}>
      <span className="tchr-btn-ic"><Ic id={icon} /></span>
      <span className="tchr-btn-txt">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
}

// ===== Форма «Домашнее задание» =====
function HomeworkForm({ author, onDone, toast }) {
  const [date, setDate] = useState(tomorrowIso());
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [bring, setBring] = useState("");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = text.trim();
    if (!t) { toast("Напишите, что задано"); return; }
    setSaving(true);
    try {
      await saveHomework({
        on_date: date,
        subject: subject.trim() || null,
        text: t,
        bring: bring.trim() || null,
        author,
      });
      if (notify) {
        await sendManualPush({
          title: "Домашнее задание",
          body: (subject.trim() ? subject.trim() + ": " : "") + t,
          url: "/?tab=dashboard",
        });
      }
      toast(notify ? "Задание записано, родителям ушло уведомление" : "Задание записано");
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  return (
    <div className="tchr-form">
      <div className="tchr-form-title">Домашнее задание</div>
      <div className="tchr-grid">
        <label className="tchr-fld">
          <span>На какое число</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="tchr-fld">
          <span>Предмет (необязательно)</span>
          <input type="text" placeholder="Математика" value={subject} maxLength={40} onChange={(e) => setSubject(e.target.value)} />
        </label>
      </div>
      <label className="tchr-fld">
        <span>Что задано</span>
        <textarea rows={3} placeholder="Стр. 24, № 3–5" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Что взять с собой (необязательно)</span>
        <input type="text" placeholder="Краски, стакан для воды" value={bring} maxLength={200} onChange={(e) => setBring(e.target.value)} />
      </label>
      <NotifyBox on={notify} onChange={setNotify} />
      <div className="tchr-actions">
        <button className="pill-btn" onClick={onDone}>Отмена</button>
        <button className="pill-btn blue" onClick={save} disabled={saving}>{saving ? "Сохраняю…" : "Записать"}</button>
      </div>
    </div>
  );
}

// ===== Форма «Событие класса» =====
function EventForm({ author, onDone, toast }) {
  const [date, setDate] = useState(tomorrowIso());
  const [timeText, setTimeText] = useState("");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = title.trim();
    if (!t) { toast("Напишите название события"); return; }
    setSaving(true);
    try {
      await saveClassEvent({
        on_date: date,
        time_text: timeText.trim() || null,
        title: t,
        place: place.trim() || null,
        note: note.trim() || null,
        author,
      });
      if (notify) {
        await sendManualPush({
          title: "Событие класса",
          body: t + (timeText.trim() ? ` · ${timeText.trim()}` : ""),
          url: "/?tab=dashboard",
        });
      }
      toast(notify ? "Событие добавлено, родителям ушло уведомление" : "Событие добавлено");
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  return (
    <div className="tchr-form">
      <div className="tchr-form-title">Событие класса</div>
      <label className="tchr-fld">
        <span>Название</span>
        <input type="text" placeholder="Поездка в зоопарк" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="tchr-grid">
        <label className="tchr-fld">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="tchr-fld">
          <span>Время (словами)</span>
          <input type="text" placeholder="в 10:00 / после 3 урока" value={timeText} maxLength={60} onChange={(e) => setTimeText(e.target.value)} />
        </label>
      </div>
      <label className="tchr-fld">
        <span>Где собираемся (необязательно)</span>
        <input type="text" placeholder="У входа в школу" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Что важно знать (необязательно)</span>
        <textarea rows={2} placeholder="Форма одежды по погоде, обед с собой" value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} />
      </label>
      <NotifyBox on={notify} onChange={setNotify} />
      <div className="tchr-actions">
        <button className="pill-btn" onClick={onDone}>Отмена</button>
        <button className="pill-btn blue" onClick={save} disabled={saving}>{saving ? "Сохраняю…" : "Добавить"}</button>
      </div>
    </div>
  );
}

// ===== Форма «Заметка семье» =====
function NoteForm({ author, onDone, toast }) {
  const [pickOpen, setPickOpen] = useState(true);
  const [target, setTarget] = useState(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = text.trim();
    if (!target) { setPickOpen(true); return; }
    if (!t) { toast("Напишите текст заметки"); return; }
    setSaving(true);
    try {
      await addFamilyNote({
        family_n: target.n,
        text: t,
        remind_date: date || null,
        from_teacher: true,
        author,
      });
      if (notify) {
        await sendManualPush({
          title: "Сообщение от учителя",
          body: t,
          url: "/?tab=dashboard",
        });
      }
      toast(`Заметка отправлена: ${target.child}`);
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось отправить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  return (
    <div className="tchr-form">
      <div className="tchr-form-title">Заметка семье</div>
      <div className="tchr-target">
        {target ? <>Семья: <b>{target.child}</b></> : "Семья не выбрана"}
        <button className="pill-btn" onClick={() => setPickOpen(true)}>{target ? "Сменить" : "Выбрать"}</button>
      </div>
      <label className="tchr-fld">
        <span>Текст</span>
        <textarea rows={3} placeholder="Тимофей забыл сменку — принесите, пожалуйста, завтра" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Напомнить в день (необязательно)</span>
        <input type="date" value={date} min={minskIso()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="tchr-hint">
        Заметку увидит только эта семья — в разделе «От учителя» на своей «Главной».
      </div>
      <NotifyBox on={notify} onChange={setNotify} />
      <div className="tchr-actions">
        <button className="pill-btn" onClick={onDone}>Отмена</button>
        <button className="pill-btn blue" onClick={save} disabled={saving}>{saving ? "Отправляю…" : "Отправить"}</button>
      </div>
      <FamilyPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Какой семье написать?"
        onPick={(f) => { setTarget(f); setPickOpen(false); }}
      />
    </div>
  );
}

export default function TeacherTab({ authorName, toast, onTab, homework, events, teacherNotes, onReload }) {
  const [form, setForm] = useState(null); // 'hw' | 'event' | 'note' | null
  const author = authorName || "Учитель";
  const todayIso = minskIso();
  const close = () => { setForm(null); onReload?.(); };

  const delHw = async (h) => {
    try { await deleteHomework(h.id); onReload?.(); toast("Задание удалено"); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };
  const delEv = async (e2) => {
    try { await deleteClassEvent(e2.id); onReload?.(); toast("Событие удалено"); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };
  const delNote = async (n) => {
    try { await deleteFamilyNote(n.id); onReload?.(); toast("Заметка удалена"); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };

  const hw = (homework || []).slice().sort((a, b) => (a.on_date < b.on_date ? -1 : 1));
  const ev = (events || []).slice().sort((a, b) => (a.on_date < b.on_date ? -1 : 1));
  const notes = (teacherNotes || []).slice(0, 10);

  return (
    <section className="tab active" id="tab-teacher">
      <div className="card tchr-hero reveal">
        <div className="dash-card-head">
          <img src="/icons/icon-backpack.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">Кабинет классного руководителя</h2>
            <div className="dash-card-sub">{author} · всё, что вы публикуете, родители видят сразу</div>
          </div>
        </div>

        <div className="tchr-btns">
          <BigBtn icon="i-book" tone="blue" title="Записать ДЗ" sub="что задано и что взять"
            active={form === "hw"} onClick={() => setForm(form === "hw" ? null : "hw")} />
          <BigBtn icon="i-cake" tone="pink" title="Событие класса" sub="поездка, праздник, собрание"
            active={form === "event"} onClick={() => setForm(form === "event" ? null : "event")} />
          <BigBtn icon="i-edit" tone="green" title="Заметка семье" sub="лично одной семье"
            active={form === "note"} onClick={() => setForm(form === "note" ? null : "note")} />
          <BigBtn icon="i-bell" tone="yellow" title="Объявление" sub="для всего класса"
            onClick={() => onTab("announcements")} />
          <BigBtn icon="i-clock" tone="violet" title="Замена в расписании" sub="изменить уроки"
            onClick={() => onTab("schedule")} />
        </div>

        {form === "hw" && <HomeworkForm author={author} onDone={close} toast={toast} />}
        {form === "event" && <EventForm author={author} onDone={close} toast={toast} />}
        {form === "note" && <NoteForm author={author} onDone={close} toast={toast} />}
      </div>

      <div className="card reveal d1">
        <div className="dash-card-head">
          <img src="/icons/icon-book.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">Домашние задания</h2>
            <div className="dash-card-sub">Ближайшие — их видят все родители класса</div>
          </div>
        </div>
        {!hw.length && <div className="muted" style={{ fontSize: 13, padding: "6px 2px" }}>Пока ничего не записано.</div>}
        {hw.map((h) => (
          <div className="tb-row" key={h.id}>
            <span className="tb-day">{fmtDayWord(h.on_date, todayIso)}</span>
            <div className="tb-body">
              <div className="tb-text">{h.subject && <b className="tb-subject">{h.subject}. </b>}{h.text}</div>
              {h.bring && <div className="tb-bring">Взять с собой: {h.bring}</div>}
            </div>
            <button className="note-del" onClick={() => delHw(h)} aria-label="Удалить" title="Удалить">✕</button>
          </div>
        ))}
      </div>

      <div className="card reveal d2">
        <div className="dash-card-head">
          <img src="/icons/icon-calendar.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">События класса</h2>
            <div className="dash-card-sub">Предстоящие</div>
          </div>
        </div>
        {!ev.length && <div className="muted" style={{ fontSize: 13, padding: "6px 2px" }}>Пока событий нет.</div>}
        {ev.map((e) => (
          <div className="tb-row" key={e.id}>
            <span className="tb-day">{fmtDayWord(e.on_date, todayIso)}</span>
            <div className="tb-body">
              <div className="tb-text"><b>{e.title}</b>{e.time_text ? ` · ${e.time_text}` : ""}</div>
              {(e.place || e.note) && (
                <div className="tb-bring">{e.place || ""}{e.place && e.note ? " · " : ""}{e.note || ""}</div>
              )}
            </div>
            <button className="note-del" onClick={() => delEv(e)} aria-label="Удалить" title="Удалить">✕</button>
          </div>
        ))}
      </div>

      <div className="card reveal d3">
        <div className="dash-card-head">
          <img src="/icons/icon-people.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">Отправленные заметки семьям</h2>
            <div className="dash-card-sub">Последние 10 · видно только вам и адресату</div>
          </div>
        </div>
        {!notes.length && <div className="muted" style={{ fontSize: 13, padding: "6px 2px" }}>Вы пока никому не писали.</div>}
        {notes.map((n) => (
          <div className={"note-row" + (n.done ? " done" : "")} key={n.id}>
            <div className="note-body">
              <div className="note-text">{n.text}</div>
              <div className="note-meta">
                <span className="note-tag">семья № {n.family_n}</span>
                {n.done && <span className="note-when">прочитано</span>}
                {n.remind_date && <span className="note-when">{fmtDayWord(n.remind_date, todayIso)}</span>}
              </div>
            </div>
            <button className="note-del" onClick={() => delNote(n)} aria-label="Удалить" title="Удалить">✕</button>
          </div>
        ))}
      </div>
    </section>
  );
}
