"use client";
import { Fragment, useEffect, useState } from "react";
import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import { supabase, isLive, cancelScheduleOverride, deleteScheduleDraft, addScheduleHistory } from "@/lib/supabase";
import { sendManualPush } from "@/lib/push";
import {
  DAY_NAMES,
  BELLS_FALLBACK,
  LESSONS_FALLBACK,
  INFO_HOUR,
  scheduleFocus,
  subjectIcon,
  lessonDisplay,
} from "./scheduleData";
import {
  weekDates, activeOverridesFor, applyOverridesToDay, dayEndTime,
  fmtDateShort, fmtDateRu, periodLabel, viberText,
} from "./scheduleOverrides";
import ScheduleUpdateModal from "./ScheduleUpdateModal";
import { useRefreshPause, useDraftAutosave, readDraft, clearDraft, confirmDiscard, isDirty } from "@/lib/formGuard";

// Модалка редактирования урока основного расписания (только для комитета)
function LessonModal({ lesson, onClose, onSaved, toast }) {
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [saving, setSaving] = useState(false);
  const [base, setBase] = useState(null);
  const [restored, setRestored] = useState(false);

  const lessonId = lesson?.id || null;
  const dkey = lessonId ? "lesson:" + lessonId : "";

  useEffect(() => {
    if (!lesson) return;
    const b = {
      subject: lesson.subject || "",
      note: lesson.note || "",
      room: lesson.room || "166",
      teacher: lesson.teacher || "",
    };
    const d = readDraft("lesson:" + lesson.id);
    const v = d ? { ...b, ...d } : b;
    setSubject(v.subject);
    setNote(v.note);
    setRoom(v.room);
    setTeacher(v.teacher);
    setBase(b);
    setRestored(!!d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useRefreshPause(!!lesson);
  const values = { subject, note, room, teacher };
  const dirty = !!lesson && isDirty(values, base);
  useDraftAutosave(!!lesson, dkey, values, dirty);

  const close = () => {
    if (!confirmDiscard(dirty, "Закрыть урок без сохранения? Набранный текст пропадёт.")) return;
    clearDraft(dkey);
    onClose();
  };

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
    clearDraft(dkey);
    toast("Урок обновлён — родители уже видят изменения");
    sendManualPush({
      title: "📅 Изменение в расписании",
      body: `${DAY_NAMES[lesson.day]}, ${lesson.pos}-й урок: ${subject.trim()}${note.trim() ? ` · взять: ${note.trim()}` : ""}`,
      url: "/?tab=schedule",
      audience: "all",
    });
    onSaved();
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && close()}>
      <div className="modal exp-modal">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CIc id={subjectIcon(subject).id} tone={subjectIcon(subject).tone} size="sm" />
          {DAY_NAMES[lesson.day]} · {lesson.pos}-й урок
        </h3>
        <div className="muted">Это правка основного расписания. Для временной замены нажмите «Внести изменения».</div>
        {restored && <div className="chip amber" style={{ marginTop: 6 }}>Восстановлен незаконченный черновик</div>}
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
          <button className="btn small white" onClick={close} disabled={saving}>Отмена</button>
          <button className="btn small teal" onClick={save} disabled={saving}>{saving ? "Сохраняю…" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleTab({ committee, canEditSchedule, author, toast, liveSchedule, onReload, overrides, onReloadOverrides }) {
  const bells = liveSchedule?.bells?.length ? liveSchedule.bells : BELLS_FALLBACK;
  const lessons = liveSchedule?.lessons?.length ? liveSchedule.lessons : LESSONS_FALLBACK;
  const [editLesson, setEditLesson] = useState(null);
  const [updOpen, setUpdOpen] = useState(false);
  const [updDraft, setUpdDraft] = useState(null); // черновик, который продолжаем
  const [showOld, setShowOld] = useState({}); // ключ day-pos → показать «что было»
  const [histOpen, setHistOpen] = useState(false);

  const canEdit = canEditSchedule ?? committee;
  const focus = scheduleFocus();
  const bellByPos = Object.fromEntries(bells.map((b) => [b.pos, b]));
  const dates = weekDates(); // день недели → ближайшая дата (по Минску)

  const openEdit = (lesson) => {
    if (!isLive || !liveSchedule) return toast("Расписание в базе ещё не создано — сначала запустите SQL-скрипт");
    setEditLesson(lesson);
  };

  const openUpdate = (draft = null) => {
    setUpdDraft(draft);
    setUpdOpen(true);
  };

  const drafts = (overrides || []).filter((o) => o.status === "draft");
  const published = (overrides || []).filter((o) => o.status !== "draft");

  const cancelOv = async (ov) => {
    if (!confirm("Отменить это изменение? Расписание вернётся к прежнему виду.")) return;
    try {
      await cancelScheduleOverride(ov.id, author);
      await addScheduleHistory({ override_id: ov.id, action: "cancelled", actor: author, details: periodLabel(ov) });
      toast("Изменение отменено — расписание вернулось к прежнему виду");
      sendManualPush({
        title: "📅 Изменение расписания отменено",
        body: `Отменена замена ${periodLabel(ov)} — действует обычное расписание`,
        url: "/?tab=schedule",
        audience: "all",
      });
      onReloadOverrides?.();
    } catch (e) {
      toast("Не получилось отменить: " + (e.message || e));
    }
  };

  const removeDraft = async (ov) => {
    if (!confirm("Удалить черновик?")) return;
    try {
      await deleteScheduleDraft(ov.id);
      await addScheduleHistory({ override_id: null, action: "deleted_draft", actor: author, details: periodLabel(ov) });
      toast("Черновик удалён");
      onReloadOverrides?.();
    } catch (e) {
      toast("Не получилось удалить: " + (e.message || e));
    }
  };

  const copyViber = async (ov) => {
    try {
      await navigator.clipboard.writeText(viberText(ov, lessons, bells));
      toast("Текст скопирован — вставьте в чат класса в Viber");
    } catch {
      toast("Не получилось скопировать — откройте изменение и перепишите вручную");
    }
  };

  return (
    <section id="tab-schedule">
      <div className="section-cover reveal d1" style={{ background: "var(--blue-soft)" }}>
        <svg className="cover-deco"><use href="#i-spark" /></svg>
        <h2>
          <NavIcon name="schedule" uid="h-schedule" size={32} className="nvi-big" />Расписание{" "}
          <span style={{ fontFamily: "'Comfortaa'", fontSize: 13, fontWeight: 700 }}>— уроки, звонки и что взять с собой</span>
        </h2>
      </div>

      <div className="sched-badge reveal d2">
        <Ic id="i-hourglass" /> Временное расписание · действует первые 20 учебных дней (адаптационный период)
      </div>

      {canEdit && (
        <div className="reveal d2" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
          <button className="btn small teal" onClick={() => openUpdate(null)}><Ic id="i-edit" /> Внести изменения</button>
          {drafts.length > 0 && (
            <span className="chip" style={{ background: "var(--gold-soft, #fdf3d8)", padding: "4px 10px", fontSize: 12 }}>
              черновик{drafts.length > 1 ? "и" : ""}: {drafts.length}
            </span>
          )}
          {published.length > 0 && (
            <button className="pill-btn" onClick={() => setHistOpen(!histOpen)}>
              {histOpen ? "Скрыть историю изменений" : "История изменений"}
            </button>
          )}
        </div>
      )}

      {canEdit && drafts.length > 0 && (
        <div className="reveal d2" style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {drafts.map((ov) => (
            <div className="card" key={ov.id} style={{ padding: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Ic id="i-edit" />
              <div style={{ flex: 1, minWidth: 180 }}>
                <b>Черновик {periodLabel(ov)}</b>
                <div className="muted" style={{ fontSize: 12 }}>{ov.author || "без автора"} · изменений: {(ov.changes || []).length} · не опубликован, родители его не видят</div>
              </div>
              <button className="btn small teal" onClick={() => openUpdate(ov)}>Продолжить</button>
              <button className="btn small white" onClick={() => removeDraft(ov)}>Удалить</button>
            </div>
          ))}
        </div>
      )}

      {canEdit && histOpen && (
        <div className="reveal d2" style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {published.map((ov) => (
            <div className="card" key={ov.id} style={{ padding: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b>{ov.status === "cancelled" ? "Отменено" : "Опубликовано"} · {periodLabel(ov)}</b>
                {ov.status === "cancelled" && <span className="chip" style={{ padding: "2px 8px", fontSize: 11 }}>не действует</span>}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {ov.author || "автор не указан"} · {new Date(ov.published_at || ov.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Minsk", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                {ov.cancelled_at && <> · отменено: {ov.cancelled_by || ""} {new Date(ov.cancelled_at).toLocaleString("ru-RU", { timeZone: "Europe/Minsk", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</>}
              </div>
              {ov.source_text && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Основание: «{ov.source_text}»</div>}
              {ov.source_image && <a href={ov.source_image} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12 }}>фото-основание</a>}
              {ov.status === "published" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn small white" onClick={() => copyViber(ov)}>Скопировать для Viber</button>
                  <button className="btn small white" onClick={() => cancelOv(ov)}>Отменить изменение</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="sched-grid reveal d2">
        {[1, 2, 3, 4, 5].map((day) => {
          const iso = dates[day];
          const activeOvs = activeOverridesFor(overrides, iso);
          const { lessons: dayLessons, changed } = applyOverridesToDay(lessons, day, activeOvs);
          const hasChanges = Object.keys(changed).length > 0;
          const isFocus = focus.day === day;
          const end = dayEndTime(dayLessons, bells);
          return (
            <div className={"card sched-day" + (isFocus ? " today" : "")} key={day}>
              <div className={"sched-day-head dh dh-" + day}>
                <h3>{DAY_NAMES[day]}</h3>
                {isFocus && <span className="chip green">{focus.label}</span>}
                {hasChanges && <span className="chip" style={{ background: "var(--gold-soft, #fdf3d8)", fontSize: 11 }}>изменено · {fmtDateShort(iso)}</span>}
                <span className="sched-count">{dayLessons.length} урок{dayLessons.length === 5 ? "ов" : dayLessons.length === 1 ? "" : "а"}</span>
              </div>
              {dayLessons.map((l) => {
                const bell = bellByPos[l.pos];
                const si = subjectIcon(l.subject);
                const ch = changed[l.pos];
                const key = day + "-" + l.pos;
                const disp = lessonDisplay(l.subject);
                return (
                  <Fragment key={l.id}>
                    <div className="sched-lesson" style={ch ? { background: "var(--blue-soft, #eaf2fb)", borderRadius: 10 } : undefined}>
                      <div className="sched-time">
                        <b>{l.pos}</b>
                        {bell && <span>{bell.start_time}–{bell.end_time}</span>}
                      </div>
                      <div className="sched-body">
                        <div className="sched-subject">
                          <CIc id={si.id} tone={si.tone} size="sm" /> {disp.name}
                          {disp.tag && <span className="muted" style={{ fontStyle: "italic", fontWeight: 400, fontSize: 12 }}> · {disp.tag}</span>}
                        </div>
                        <div className="sched-meta">
                          {[l.room ? `каб. ${l.room}` : null, l.teacher].filter(Boolean).join(" · ")}
                        </div>
                        {l.note && <div className="sched-note"><Ic id="i-backpack" /> {l.note}</div>}
                        {ch && (
                          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                            <button className="pill-btn" style={{ fontSize: 11, padding: "1px 8px" }} onClick={() => setShowOld((s) => ({ ...s, [key]: !s[key] }))}>
                              {showOld[key] ? "скрыть" : ch.added ? "добавлен уроком" : "что было?"}
                            </button>
                            {showOld[key] && <> было: {ch.old ? ch.old.subject : "урока не было"} · замена {periodLabel(ch.ov)}</>}
                          </div>
                        )}
                      </div>
                      {committee && !ch && (
                        <button className="mini-btn" title="Изменить урок в основном расписании" onClick={() => openEdit(l)}><Ic id="i-edit" /></button>
                      )}
                    </div>
                    {day === INFO_HOUR.day && l.pos === INFO_HOUR.afterPos && (
                      <div className="sched-lesson" style={{ opacity: 0.9 }}>
                        <div className="sched-time"><span style={{ fontSize: 15 }}>📰</span></div>
                        <div className="sched-body">
                          <div className="sched-subject">
                            <CIc id="i-sub-news" tone="blue" size="sm" /> {INFO_HOUR.subject}
                            <span className="muted" style={{ fontStyle: "italic", fontWeight: 400, fontSize: 12 }}> · {INFO_HOUR.tag}</span>
                          </div>
                          <div className="sched-meta">между 3-м и 4-м уроками</div>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {Object.entries(changed).filter(([, c]) => c.removed).map(([pos, c]) => (
                <div className="sched-lesson" key={"rm" + pos} style={{ opacity: 0.7 }}>
                  <div className="sched-time"><b>{pos}</b></div>
                  <div className="sched-body">
                    <div className="sched-subject" style={{ textDecoration: "line-through" }}>{c.old ? c.old.subject : "урок"}</div>
                    <div className="sched-meta">урок отменён · {periodLabel(c.ov)}</div>
                  </div>
                </div>
              ))}
              {hasChanges && end && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Занятия закончатся в <b>{end}</b></div>
              )}
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
        {canEdit && " · «Внести изменения» — для временных замен, карандаш на уроке — для правки основного расписания"}
      </div>

      <LessonModal
        lesson={editLesson}
        onClose={() => setEditLesson(null)}
        onSaved={() => onReload?.()}
        toast={toast}
      />

      {updOpen && (
        <ScheduleUpdateModal
          open={updOpen}
          draft={updDraft}
          lessons={lessons}
          bells={bells}
          overrides={overrides}
          author={author}
          onClose={() => setUpdOpen(false)}
          onSaved={() => onReloadOverrides?.()}
          toast={toast}
        />
      )}
    </section>
  );
}
