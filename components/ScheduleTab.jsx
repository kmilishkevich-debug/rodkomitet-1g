"use client";
import { useEffect, useState } from "react";
import { Ic, CIc } from "./Art";
import { supabase, isLive } from "@/lib/supabase";
import {
  DAY_NAMES,
  BELLS_FALLBACK,
  LESSONS_FALLBACK,
  scheduleFocus,
  subjectIcon,
} from "./scheduleData";

// Модалка редактирования урока (только для комитета)
function LessonModal({ lesson, onClose, onSaved, toast }) {
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    setSubject(lesson.subject || "");
    setNote(lesson.note || "");
    setRoom(lesson.room || "166");
    setTeacher(lesson.teacher || "");
  }, [lesson]);

  if (!lesson) return null;

  const save = async () => {
    if (!subject.trim()) return toast("Укажите название урока");
    setSaving(true);
    const { error } = await supabase
      .from("schedule_lessons")
      .update({
        subject: subject.trim(),
        note: note.trim() || null,
        room: room.trim() || null,
        teacher: teacher.trim() || null,
      })
      .eq("id", lesson.id);
    setSaving(false);
    if (error) return toast("Не получилось сохранить: " + error.message);
    toast("Урок обновлён — родители уже видят изменения");
    onSaved();
    onClose();
  };

  return (
    <div className="overlay">
      <div className="modal exp-modal">
        <h3>{DAY_NAMES[lesson.day]} · {lesson.pos}-й урок</h3>
        <div className="muted">Изменения сразу увидят все родители</div>
        <div className="exp-form">
          <label>Урок</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label>Что взять с собой (памятка)</label>
          <input placeholder="Например: спортивная форма, альбом, краски…" value={note} onChange={(e) => setNote(e.target.value)} />
          <label>Кабинет</label>
          <input value={room} onChange={(e) => setRoom(e.target.value)} />
          <label>Учитель</label>
          <input placeholder="Например: Головко В. П." value={teacher} onChange={(e) => setTeacher(e.target.value)} />
        </div>
        <div className="actions">
          <button className="btn small white" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="btn small teal" onClick={save} disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleTab({ committee, toast, liveSchedule, onReload }) {
  const bells = liveSchedule?.bells?.length ? liveSchedule.bells : BELLS_FALLBACK;
  const lessons = liveSchedule?.lessons?.length ? liveSchedule.lessons : LESSONS_FALLBACK;
  const [editLesson, setEditLesson] = useState(null);

  const focus = scheduleFocus();
  const bellByPos = Object.fromEntries(bells.map((b) => [b.pos, b]));

  const openEdit = (lesson) => {
    if (!isLive || !liveSchedule) return toast("Расписание в базе ещё не создано — сначала запустите SQL-скрипт");
    setEditLesson(lesson);
  };

  return (
    <section id="tab-schedule">
      <div className="section-cover reveal d1" style={{ background: "var(--blue-soft)" }}>
        <svg className="cover-deco"><use href="#i-spark" /></svg>
        <h2>
          <Ic id="i-clock" className="ic big" />Расписание{" "}
          <span style={{ fontFamily: "'Comfortaa'", fontSize: 13, fontWeight: 700 }}>— уроки, звонки и что взять с собой</span>
        </h2>
      </div>

      <div className="sched-badge reveal d2">
        <Ic id="i-hourglass" /> Временное расписание · действует первые 20 учебных дней (адаптационный период)
      </div>

      <div className="sched-grid reveal d2">
        {[1, 2, 3, 4, 5].map((day) => {
          const dayLessons = lessons.filter((l) => l.day === day);
          const isFocus = focus.day === day;
          return (
            <div className={"card sched-day" + (isFocus ? " today" : "")} key={day}>
              <div className={"sched-day-head dh dh-" + day}>
                <h3>{DAY_NAMES[day]}</h3>
                {isFocus && <span className="chip green">{focus.label}</span>}
                <span className="sched-count">{dayLessons.length} урок{dayLessons.length === 5 ? "ов" : "а"}</span>
              </div>
              {dayLessons.map((l) => {
                const bell = bellByPos[l.pos];
                const si = subjectIcon(l.subject);
                return (
                  <div className="sched-lesson" key={l.id}>
                    <div className="sched-time">
                      <b>{l.pos}</b>
                      {bell && <span>{bell.start_time}–{bell.end_time}</span>}
                    </div>
                    <div className="sched-body">
                      <div className="sched-subject"><CIc id={si.id} tone={si.tone} size="sm" /> {l.subject}</div>
                      <div className="sched-meta">
                        {[l.room ? `каб. ${l.room}` : null, l.teacher].filter(Boolean).join(" · ")}
                      </div>
                      {l.note && <div className="sched-note"><Ic id="i-backpack" /> {l.note}</div>}
                    </div>
                    {committee && (
                      <button className="mini-btn" title="Изменить урок" onClick={() => openEdit(l)}><Ic id="i-edit" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="card sched-day bells">
          <div className="sched-day-head dh dh-gold">
            <h3><CIc id="i-bell" tone="gold" size="sm" /> Звонки</h3>
          </div>
          {bells.map((b) => (
            <div className="sched-lesson" key={b.pos}>
              <div className="sched-time"><b>{b.pos}</b></div>
              <div className="sched-body">
                <div className="sched-subject">{b.start_time} – {b.end_time}</div>
              </div>
            </div>
          ))}
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Перемены по 25 минут — первоклашкам нужно отдыхать <Ic id="i-smile" />
          </div>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        Кабинет 166 · классный руководитель — Головко Виктория Петровна
        {committee && " · нажмите значок карандаша на уроке, чтобы поправить памятку, кабинет или учителя"}
      </div>

      <LessonModal
        lesson={editLesson}
        onClose={() => setEditLesson(null)}
        onSaved={() => onReload?.()}
        toast={toast}
      />
    </section>
  );
}
