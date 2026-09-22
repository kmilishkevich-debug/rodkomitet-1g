"use client";
// Конструктор «Внести изменения» в расписание: основание (текст/фото),
// обязательный период действия, изменения по урокам, превью «Было → станет»,
// проверка конфликтов, черновик или публикация.
import { useMemo, useState } from "react";
import { Ic } from "./Art";
import { DAY_NAMES } from "./scheduleData";
import {
  minskDateISO, isoToDay, fmtDateRu, applyOverridesToDay,
  dayEndTime, checkConflicts, periodLabel, viberText,
} from "./scheduleOverrides";
import { saveScheduleOverride, addScheduleHistory, uploadReceipt, isLive } from "@/lib/supabase";
import { sendManualPush } from "@/lib/push";
import { useRefreshPause, useDraftAutosave, readDraft, clearDraft, confirmDiscard } from "@/lib/formGuard";

const EMPTY_CHANGE = { day: "", pos: "", action: "replace", subject: "", note: "", room: "166", teacher: "" };

export default function ScheduleUpdateModal({ open, draft, lessons, bells, overrides, author, onClose, onSaved, toast }) {
  const dkey = "schedule:" + (draft?.id || "new");
  const base = {
    kind: draft?.kind || "date",
    dateFrom: draft?.date_from || minskDateISO(1),
    dateTo: draft?.date_to || "",
    changes: draft?.changes?.length ? draft.changes.map((c) => ({ ...EMPTY_CHANGE, ...c })) : [{ ...EMPTY_CHANGE }],
    comment: draft?.comment || "",
    sourceText: draft?.source_text || "",
    sourceImage: draft?.source_image || "",
  };
  const [saved0] = useState(() => (typeof window === "undefined" ? null : readDraft(dkey)));
  const start = saved0 ? { ...base, ...saved0 } : base;

  const [step, setStep] = useState(1); // 1 = форма, 2 = превью
  const [kind, setKind] = useState(start.kind);
  const [dateFrom, setDateFrom] = useState(start.dateFrom);
  const [dateTo, setDateTo] = useState(start.dateTo);
  const [changes, setChanges] = useState(
    Array.isArray(start.changes) && start.changes.length ? start.changes.map((c) => ({ ...EMPTY_CHANGE, ...c })) : [{ ...EMPTY_CHANGE }]
  );
  const [comment, setComment] = useState(start.comment);
  const [sourceText, setSourceText] = useState(start.sourceText);
  const [sourceImage, setSourceImage] = useState(start.sourceImage);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restored] = useState(!!saved0);

  // Пока конструктор открыт — фоновое обновление данных на паузе
  useRefreshPause(open);

  const formValues = { kind, dateFrom, dateTo, changes, comment, sourceText, sourceImage };
  const formDirty = JSON.stringify(formValues) !== JSON.stringify(base);
  useDraftAutosave(open, dkey, formValues, formDirty);

  const close = () => {
    if (!confirmDiscard(formDirty, "Закрыть изменение расписания? Всё, что вы набрали, пропадёт.")) return;
    clearDraft(dkey);
    onClose();
  };

  const singleDay = kind === "date" ? isoToDay(dateFrom) : null;
  const singleDayOk = singleDay && singleDay <= 5;

  const normChanges = useMemo(
    () =>
      changes
        .filter((c) => (c.pos && (c.action === "remove" || c.subject.trim())))
        .map((c) => ({
          day: kind === "date" ? singleDay : Number(c.day),
          pos: Number(c.pos),
          action: c.action,
          subject: c.subject.trim(),
          note: c.note.trim() || null,
          room: c.room.trim() || null,
          teacher: c.teacher.trim() || null,
        })),
    [changes, kind, singleDay]
  );

  const draftPayload = useMemo(
    () => ({
      kind,
      date_from: dateFrom,
      date_to: kind === "period" ? dateTo || dateFrom : null,
      changes: normChanges,
      comment: comment.trim() || null,
      source_text: sourceText.trim() || null,
      source_image: sourceImage || null,
      author,
    }),
    [kind, dateFrom, dateTo, normChanges, comment, sourceText, sourceImage, author]
  );

  const warns = useMemo(
    () => checkConflicts(draftPayload, overrides, draft?.id || null),
    [draftPayload, overrides, draft]
  );

  if (!open) return null;

  const setCh = (i, field, val) => {
    setChanges((arr) => arr.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));
  };

  const attachPhoto = async (file) => {
    if (!file) return;
    if (!isLive) return toast("Фото можно прикрепить после настройки базы");
    setUploading(true);
    try {
      const url = await uploadReceipt(file);
      setSourceImage(url);
      toast("Фото прикреплено — оно сохранится как основание изменения");
    } catch (e) {
      toast("Не получилось загрузить фото: " + (e.message || e));
    }
    setUploading(false);
  };

  const validate = () => {
    if (!dateFrom) return "Укажите дату — без периода действия изменение сохранить нельзя.";
    if (kind === "date" && !singleDayOk) return "Выбранная дата выпадает на выходной — уроков в этот день нет.";
    if (kind === "period" && (!dateTo || dateTo < dateFrom)) return "Укажите конец периода (не раньше начала).";
    if (!normChanges.length) return "Добавьте хотя бы одно изменение: номер урока и предмет (или отмену урока).";
    if (kind !== "date" && changes.some((c) => c.pos && !c.day)) return "У каждого изменения выберите день недели.";
    const noSubj = changes.find((c) => c.pos && c.action !== "remove" && !c.subject.trim());
    if (noSubj) return "У замены/добавления укажите название урока — придумывать за вас не буду.";
    return null;
  };

  const toPreview = () => {
    const err = validate();
    if (err) return toast(err);
    setStep(2);
  };

  const persist = async (publish) => {
    if (!isLive) return toast("Сохранение заработает после настройки базы (файл schedule-updates-setup.sql)");
    setSaving(true);
    try {
      const payload = {
        ...(draft?.id ? { id: draft.id } : {}),
        ...draftPayload,
        status: publish ? "published" : "draft",
        ...(publish ? { published_at: new Date().toISOString() } : {}),
      };
      const saved = await saveScheduleOverride(payload);
      await addScheduleHistory({
        override_id: saved.id,
        action: publish ? "published" : draft?.id ? "edited" : "draft",
        actor: author,
        details: `${periodLabel(saved)} · изменений: ${normChanges.length}`,
      });
      if (publish) {
        sendManualPush({
          title: "📅 Изменение расписания",
          body: viberText(saved, lessons, bells).split("\n").slice(0, 3).join(" "),
          url: "/?tab=schedule",
          audience: "all",
        });
        try {
          await navigator.clipboard.writeText(viberText(saved, lessons, bells));
          toast("Опубликовано! Текст для Viber уже скопирован — вставьте в чат класса");
        } catch {
          toast("Изменение опубликовано — родители увидят его на главной и в расписании");
        }
      } else {
        toast("Черновик сохранён — его видит второй член комитета, опубликовать можно позже");
      }
      clearDraft(dkey);
      onSaved?.();
      onClose();
    } catch (e) {
      toast("Не получилось сохранить: " + (e.message || e));
    }
    setSaving(false);
  };

  // Превью «Было → станет» по затронутым дням
  const previewDays = [...new Set(normChanges.map((c) => c.day))].sort();

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && close()}>
      <div className="modal exp-modal" style={{ maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }}>
        {step === 1 && (
          <>
            <h3><Ic id="i-edit" /> Изменение расписания</h3>
            {restored && <div className="chip amber" style={{ marginBottom: 6 }}>Восстановлен незаконченный черновик</div>}
            <div className="muted">Основное расписание не трогаем: замена действует только в свой период, потом всё вернётся само.</div>

            <div className="exp-form">
              <label>Сообщение учителя (основание — сохранится в истории)</label>
              <textarea
                rows={2}
                placeholder="Например: Завтра физкультура вместо музыки третьим уроком. Взять спортивную форму."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                style={{ resize: "vertical" }}
              />
              <label>Фото или скриншот сообщения (по желанию)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="file" accept="image/*" onChange={(e) => attachPhoto(e.target.files?.[0])} disabled={uploading} />
                {uploading && <span className="muted">Загружаю…</span>}
                {sourceImage && <a href={sourceImage} target="_blank" rel="noreferrer" className="chip green" style={{ padding: "2px 10px" }}>фото прикреплено</a>}
              </div>

              <label>Когда действует изменение (обязательно)</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["date", "Конкретная дата"],
                  ["period", "Период"],
                  ["permanent", "Новое постоянное"],
                ].map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    className={"pill-btn " + (kind === k ? "blue" : "")}
                    onClick={() => setKind(k)}
                  >{t}</button>
                ))}
              </div>
              {kind === "date" && (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <button type="button" className="pill-btn" onClick={() => setDateFrom(minskDateISO(1))}>Завтра</button>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {singleDayOk
                      ? <>Изменение на <b>{fmtDateRu(dateFrom)}</b> — проверьте дату перед сохранением (время минское)</>
                      : "Эта дата — выходной, выберите будний день"}
                  </div>
                </>
              )}
              {kind === "period" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="muted">с</span>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <span className="muted">по</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              )}
              {kind === "permanent" && (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="muted">действует с</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>Новое расписание по этим урокам — до следующего изменения</div>
                </>
              )}

              <label>Что меняется</label>
              {changes.map((c, i) => (
                <div key={i} className="card" style={{ padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {kind !== "date" && (
                      <select value={c.day} onChange={(e) => setCh(i, "day", e.target.value)}>
                        <option value="">День…</option>
                        {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
                      </select>
                    )}
                    <select value={c.pos} onChange={(e) => setCh(i, "pos", e.target.value)}>
                      <option value="">Урок…</option>
                      {[1, 2, 3, 4, 5, 6].map((p) => <option key={p} value={p}>{p}-й урок</option>)}
                    </select>
                    <select value={c.action} onChange={(e) => setCh(i, "action", e.target.value)}>
                      <option value="replace">Заменить/изменить</option>
                      <option value="add">Добавить урок</option>
                      <option value="remove">Отменить урок</option>
                    </select>
                    {changes.length > 1 && (
                      <button type="button" className="mini-btn" title="Убрать строку" onClick={() => setChanges((arr) => arr.filter((_, idx) => idx !== i))}>✕</button>
                    )}
                  </div>
                  {c.action !== "remove" && (
                    <>
                      <input placeholder="Урок (например: Физическая культура и здоровье)" value={c.subject} onChange={(e) => setCh(i, "subject", e.target.value)} />
                      <input placeholder="Что взять с собой (например: спортивная форма и обувь)" value={c.note} onChange={(e) => setCh(i, "note", e.target.value)} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input placeholder="Кабинет" value={c.room} onChange={(e) => setCh(i, "room", e.target.value)} style={{ width: 110 }} />
                        <input placeholder="Учитель" value={c.teacher} onChange={(e) => setCh(i, "teacher", e.target.value)} style={{ flex: 1 }} />
                      </div>
                    </>
                  )}
                </div>
              ))}
              <button type="button" className="pill-btn" onClick={() => setChanges((arr) => [...arr, { ...EMPTY_CHANGE }])}>+ Ещё изменение</button>

              <label>Комментарий для родителей (виден в баннере, по желанию)</label>
              <input placeholder="Например: не забудьте забрать детей раньше" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>

            <div className="actions">
              <button className="btn small white" onClick={close} disabled={saving}>Отмена</button>
              <button className="btn small teal" onClick={toPreview}>Дальше: проверить →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3><Ic id="i-eye" /> Проверьте: было → станет</h3>
            <div className="muted">Изменение {periodLabel(draftPayload)}. Пока ничего не сохранено.</div>

            {previewDays.map((day) => {
              const before = lessons.filter((l) => l.day === day);
              const { lessons: after, changed } = applyOverridesToDay(lessons, day, [draftPayload]);
              const endB = dayEndTime(before, bells);
              const endA = dayEndTime(after, bells);
              const allPos = [...new Set([...before.map((l) => l.pos), ...after.map((l) => l.pos)])].sort();
              return (
                <div key={day} className="card" style={{ padding: 12, marginTop: 10 }}>
                  <b>{DAY_NAMES[day]}</b>
                  <table style={{ width: "100%", fontSize: 13, marginTop: 6, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={{ width: 30 }}>№</th><th>Было</th><th>Станет</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPos.map((pos) => {
                        const b = before.find((l) => l.pos === pos);
                        const a = after.find((l) => l.pos === pos);
                        const isCh = !!changed[pos];
                        return (
                          <tr key={pos} style={{ background: isCh ? "var(--blue-soft, #eaf2fb)" : "transparent" }}>
                            <td style={{ padding: "4px 4px" }}><b>{pos}</b></td>
                            <td style={{ padding: "4px 4px", opacity: isCh ? 0.65 : 1 }}>{b ? b.subject : "—"}</td>
                            <td style={{ padding: "4px 4px" }}>
                              {a ? (
                                <>
                                  {isCh ? <b>{a.subject}</b> : a.subject}
                                  {a.note && <div className="muted" style={{ fontSize: 12 }}>взять: {a.note}</div>}
                                </>
                              ) : (
                                <span className="muted">урок отменён</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(endB || endA) && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Занятия закончатся в <b>{endA || "—"}</b>{endB && endA !== endB ? ` (было: ${endB})` : ""}
                    </div>
                  )}
                </div>
              );
            })}

            {warns.length > 0 && (
              <div className="card" style={{ padding: 10, marginTop: 10, background: "var(--gold-soft, #fdf3d8)" }}>
                <b>Обратите внимание:</b>
                {warns.map((w, i) => <div key={i} style={{ fontSize: 13, marginTop: 4 }}>• {w}</div>)}
              </div>
            )}

            <div className="actions" style={{ flexWrap: "wrap" }}>
              <button className="btn small white" onClick={() => setStep(1)} disabled={saving}>← Исправить</button>
              <button className="btn small white" onClick={() => persist(false)} disabled={saving}>Сохранить черновик</button>
              <button className="btn small teal" onClick={() => persist(true)} disabled={saving}>
                {saving ? "Сохраняю…" : "Подтвердить и опубликовать"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
