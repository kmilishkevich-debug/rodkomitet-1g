// Помощники для изменений расписания (замен).
// Основное расписание не трогаем: замены применяются поверх него
// только в свой период, после — расписание само возвращается к обычному.

import { DAY_NAMES } from "./scheduleData";

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Сегодняшняя дата по Минску в виде YYYY-MM-DD (offsetDays — сдвиг в днях)
export function minskDateISO(offsetDays = 0) {
  const now = new Date();
  const minsk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
  minsk.setDate(minsk.getDate() + offsetDays);
  const y = minsk.getFullYear();
  const m = String(minsk.getMonth() + 1).padStart(2, "0");
  const d = String(minsk.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// День недели по ISO-дате: 1 = Пн … 7 = Вс
export function isoToDay(iso) {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  return dow === 0 ? 7 : dow;
}

// «16 сентября (вторник)» из YYYY-MM-DD
export function fmtDateRu(iso, withDay = true) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  const day = isoToDay(iso);
  const base = `${d} ${MONTHS_GEN[m - 1]}`;
  if (!withDay || day > 5) return base;
  return `${base} (${DAY_NAMES[day].toLowerCase()})`;
}

// «16.09» коротко
export function fmtDateShort(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

// Даты недели для сетки расписания: для каждого дня (1–5) — ближайшая
// его дата (сегодня или вперёд). В выходные — вся следующая неделя.
export function weekDates(todayISO = minskDateISO()) {
  const todayDow = isoToDay(todayISO);
  const map = {};
  const base = new Date(todayISO + "T12:00:00");
  for (let day = 1; day <= 5; day++) {
    let diff = day - todayDow;
    if (diff < 0 || todayDow > 5) diff += 7;
    const d = new Date(base);
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    map[day] = `${y}-${m}-${dd}`;
  }
  return map;
}

// Действует ли замена на конкретную дату
export function overrideActiveOn(ov, iso) {
  if (ov.status !== "published") return false;
  if (ov.kind === "date") return ov.date_from === iso;
  if (ov.kind === "period") return ov.date_from <= iso && iso <= (ov.date_to || ov.date_from);
  if (ov.kind === "permanent") return iso >= ov.date_from;
  return false;
}

// Активные замены на дату (постоянные — раньше, разовые поверх них)
export function activeOverridesFor(overrides, iso) {
  return (overrides || [])
    .filter((ov) => overrideActiveOn(ov, iso))
    .sort((a, b) => {
      const w = (o) => (o.kind === "permanent" ? 0 : o.kind === "period" ? 1 : 2);
      if (w(a) !== w(b)) return w(a) - w(b);
      return (a.published_at || a.created_at || "").localeCompare(b.published_at || b.created_at || "");
    });
}

// Применяем замены к урокам одного дня.
// Возвращает { lessons, changed } — changed[pos] = { old, removed?, added?, ov }
export function applyOverridesToDay(allLessons, dayNum, activeOvs) {
  let list = allLessons.filter((l) => l.day === dayNum).map((l) => ({ ...l }));
  const changed = {};
  (activeOvs || []).forEach((ov) => {
    (ov.changes || []).forEach((ch) => {
      if (Number(ch.day) !== Number(dayNum)) return;
      const pos = Number(ch.pos);
      if (ch.action === "remove") {
        const old = list.find((l) => l.pos === pos) || null;
        list = list.filter((l) => l.pos !== pos);
        changed[pos] = { old, removed: true, ov };
      } else {
        const idx = list.findIndex((l) => l.pos === pos);
        const nl = {
          id: `ov-${ov.id}-${pos}`,
          day: dayNum,
          pos,
          subject: ch.subject,
          note: ch.note || null,
          room: ch.room || null,
          teacher: ch.teacher || null,
          override: true,
        };
        if (idx >= 0) {
          changed[pos] = { old: list[idx], ov };
          list[idx] = nl;
        } else {
          changed[pos] = { old: null, added: true, ov };
          list.push(nl);
        }
      }
    });
  });
  list.sort((a, b) => a.pos - b.pos);
  return { lessons: list, changed };
}

// Время окончания занятий: конец звонка последнего урока
export function dayEndTime(lessons, bells) {
  if (!lessons.length) return null;
  const last = Math.max(...lessons.map((l) => l.pos));
  const bell = (bells || []).find((b) => Number(b.pos) === last);
  return bell ? bell.end_time : null;
}

// Пересекаются ли периоды двух замен
export function overridesOverlap(a, b) {
  const from = (o) => o.date_from;
  const to = (o) => (o.kind === "date" ? o.date_from : o.kind === "period" ? o.date_to || o.date_from : "9999-12-31");
  return from(a) <= to(b) && from(b) <= to(a);
}

// Проверка конфликтов новой замены: возвращает список предупреждений (строки).
export function checkConflicts(draft, overrides, excludeId = null) {
  const warns = [];
  const seen = new Set();
  (draft.changes || []).forEach((ch) => {
    const key = `${ch.day}-${ch.pos}`;
    if (seen.has(key)) warns.push(`Внутри этого изменения ${DAY_NAMES[ch.day]}, ${ch.pos}-й урок указан дважды — оставьте одно.`);
    seen.add(key);
  });
  const others = (overrides || []).filter(
    (o) => o.id !== excludeId && o.status === "published" && !o.cancelled_at && overridesOverlap(draft, o)
  );
  others.forEach((o) => {
    (o.changes || []).forEach((oc) => {
      if ((draft.changes || []).some((dc) => Number(dc.day) === Number(oc.day) && Number(dc.pos) === Number(oc.pos))) {
        warns.push(
          `Пересечение с заменой от ${o.author || "комитета"} (${fmtDateRu(o.date_from, false)}${o.date_to ? `–${fmtDateRu(o.date_to, false)}` : o.kind === "permanent" ? " и далее" : ""}): ${DAY_NAMES[oc.day]}, ${oc.pos}-й урок. Новая замена будет показана поверх старой.`
        );
      }
    });
  });
  const drafts = (overrides || []).filter((o) => o.id !== excludeId && o.status === "draft");
  if (drafts.length) {
    warns.push(`Есть ${drafts.length === 1 ? "неопубликованный черновик" : "неопубликованные черновики"} (${drafts.map((d) => d.author || "без автора").join(", ")}) — проверьте, чтобы не сделать одно и то же дважды.`);
  }
  return warns;
}

// Описание периода замены словами
export function periodLabel(ov) {
  if (ov.kind === "date") return `на ${fmtDateRu(ov.date_from)}`;
  if (ov.kind === "period") return `с ${fmtDateRu(ov.date_from, false)} по ${fmtDateRu(ov.date_to || ov.date_from, false)}`;
  return `постоянно с ${fmtDateRu(ov.date_from, false)}`;
}

// Текст изменения для Viber: одна кнопка — и можно вставлять в чат класса
export function viberText(ov, allLessons, bells) {
  const lines = [`📅 Изменение расписания ${periodLabel(ov)}:`];
  const byDay = {};
  (ov.changes || []).forEach((ch) => {
    (byDay[ch.day] = byDay[ch.day] || []).push(ch);
  });
  Object.keys(byDay).sort().forEach((day) => {
    if (Object.keys(byDay).length > 1) lines.push(`${DAY_NAMES[day]}:`);
    byDay[day].sort((a, b) => a.pos - b.pos).forEach((ch) => {
      const old = allLessons.find((l) => l.day === Number(day) && l.pos === Number(ch.pos));
      if (ch.action === "remove") {
        lines.push(`• ${ch.pos}-й урок отменяется${old ? ` (был: ${old.subject})` : ""}`);
      } else {
        let s = `• ${ch.pos}-й урок: ${ch.subject}`;
        if (old && old.subject !== ch.subject) s += ` (вместо: ${old.subject})`;
        if (!old) s += " (добавлен)";
        if (ch.note) s += ` — взять: ${ch.note.toLowerCase()}`;
        lines.push(s);
      }
    });
    const { lessons } = applyOverridesToDay(allLessons, Number(day), [ov]);
    const end = dayEndTime(lessons, bells);
    if (end) lines.push(`Занятия закончатся в ${end}.`);
  });
  if (ov.comment) lines.push(ov.comment);
  return lines.join("\n");
}
