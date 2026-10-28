"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { fetchCashExtras, fetchFees, fetchFeeCampaigns, fetchPaymentRequisites, addFamilyNote, toggleFamilyNote, deleteFamilyNote, markRead, isLive, fetchHolidays, saveHoliday, deleteHoliday } from "@/lib/supabase";
import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import {
  fmt, FAMILIES_COUNT, applyAutoFees, fallbackFeeData,
  FAMILIES, familyNs, familyGroup, STAFF,
} from "./data";
import { DAY_NAMES, BELLS_FALLBACK, LESSONS_FALLBACK, INFO_HOUR, scheduleFocus, subjectIcon, lessonDisplay } from "./scheduleData";
import { weekDates, activeOverridesFor, applyOverridesToDay, dayEndTime, fmtDateRu } from "./scheduleOverrides";
import { BIRTHDAYS_FALLBACK, BD_MONTHS_PREP, birthdayEvents, upcomingBirthdays, joinNames, fmtBd, bdName, bdInfo, inDaysWord } from "./birthdaysData";
import FamilyPicker from "./FamilyPicker";
import PushSettings from "./PushSettings";
import PushBanner from "./PushBanner";
import { AbsenceCard } from "./Absences";
import TeacherBoard from "./TeacherBoard";
import TeacherFamilyChat from "./TeacherFamilyChat";
import ParentTeacherCard from "./ParentTeacherCard";
import ClassMascot from "./ClassMascot";
import { pollState, fmtDeadline } from "./VotesTab";
import { fmtNewsDate } from "./FamilyPicker";

const DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Дата и время суток считаем по Минску, а не по часовому поясу устройства
function minskNow() {
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
  } catch {
    return new Date();
  }
}

function todayLine() {
  const d = minskNow();
  return `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function greetWord() {
  const h = minskNow().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  return "Добрый вечер";
}

// Баннер на главной: активное изменение расписания на день из мини-виджета
function ScheduleChangeBanner({ activeOvs, focusIso, focusLabel, endTime, toast, onTab }) {
  if (!activeOvs.length) return null;
  const total = activeOvs.reduce((s, ov) => s + (ov.changes || []).length, 0);
  const comment = activeOvs.map((ov) => ov.comment).filter(Boolean).join(" · ");
  return (
    <div className="attn-card reveal d1" style={{ background: "var(--gold-soft, #fdf3d8)" }}>
      <div className="attn-ico blue"><NavIcon name="schedule" uid="d-sched-chg" size={26} /></div>
      <div className="attn-body">
        <div className="attn-title">Изменение расписания на {fmtDateRu(focusIso)}</div>
        <div className="attn-sub">
          {total === 1 ? "1 урок изменён" : `Изменено уроков: ${total}`}
          {endTime ? ` · занятия ${focusLabel} закончатся в ${endTime}` : ""}
          {comment ? ` · ${comment}` : ""}
        </div>
      </div>
      <button className="pill-btn blue" onClick={() => onTab("schedule")}>Подробнее</button>
    </div>
  );
}

// «урок/урока/уроков» — по правилам русского языка
function pluralRu(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// Мини-расписание на главной: до 13:00 — уроки сегодня, после — на завтра
function ScheduleWidget({ liveSchedule, overrides, onTab }) {
  const focus = scheduleFocus();
  const bells = liveSchedule?.bells?.length ? liveSchedule.bells : BELLS_FALLBACK;
  const allLessons = liveSchedule?.lessons?.length ? liveSchedule.lessons : LESSONS_FALLBACK;
  const focusIso = weekDates()[focus.day];
  const activeOvs = activeOverridesFor(overrides, focusIso);
  const { lessons, changed } = applyOverridesToDay(allLessons, focus.day, activeOvs);
  const bellByPos = Object.fromEntries(bells.map((b) => [b.pos, b]));
  const notes = [...new Set(lessons.map((l) => l.note).filter(Boolean))];
  // Заголовок внутри карточки: «Сегодня/Завтра в школе», подстрока — день недели, число уроков, кабинет
  const title = focus.label === "сегодня" ? "Сегодня в школе" : "Завтра в школе";
  const subtitle = `${DAY_NAMES[focus.day]} · ${lessons.length} ${pluralRu(lessons.length, "урок", "урока", "уроков")} · каб. 166`;
  // Метка времени занятий: от первого звонка до конца последнего урока — из актуальных данных
  const firstBell = lessons.length ? bellByPos[lessons[0].pos] : null;
  const endTime = dayEndTime(lessons, bells);
  const timeRange = firstBell && endTime ? `${firstBell.start_time}–${endTime}` : null;
  return (
    <>
      <div className="card dash-sched reveal d3">
        <div className="dash-card-head">
          <img src="/icons/icon-calendar.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">{title}</h2>
            <div className="dash-card-sub">
              {subtitle}
              {activeOvs.length > 0 && <> · <b style={{ color: "#b07d0a" }}>изменено</b></>}
            </div>
          </div>
          <div className="dash-card-side">
            {timeRange && <span className="time-pill">{timeRange}</span>}
            <button className="pill-btn blue" onClick={() => onTab("schedule")}>Вся неделя →</button>
          </div>
        </div>
        {lessons.map((l) => {
          const bell = bellByPos[l.pos];
          const si = subjectIcon(l.subject);
          const ch = changed[l.pos];
          const disp = lessonDisplay(l.subject);
          return (
            <Fragment key={l.id}>
              <div className="dash-sched-row" style={ch ? { background: "var(--blue-soft)", borderRadius: 10 } : undefined}>
                <span className="dash-sched-time">{bell ? `${bell.start_time}–${bell.end_time}` : `${l.pos}-й`}</span>
                <span className="dash-sched-subj">
                  <CIc id={si.id} tone={si.tone} size="sm" /> {disp.name}
                  {disp.tag && <span className="muted" style={{ fontStyle: "italic", fontSize: 12 }}> · {disp.tag}</span>}
                  {ch && ch.old && ch.old.subject !== l.subject && <span className="muted" style={{ fontSize: 12 }}> (вместо: {ch.old.subject})</span>}
                  {ch && ch.added && <span className="muted" style={{ fontSize: 12 }}> (добавлен)</span>}
                </span>
              </div>
              {focus.day === INFO_HOUR.day && l.pos === INFO_HOUR.afterPos && (
                <div className="dash-sched-row" style={{ opacity: 0.9 }}>
                  <span className="dash-sched-time" />
                  <span className="dash-sched-subj">
                    <CIc id="i-sub-news" tone="blue" size="sm" /> {INFO_HOUR.subject}
                    <span className="muted" style={{ fontStyle: "italic", fontSize: 12 }}> · {INFO_HOUR.tag}</span>
                  </span>
                </div>
              )}
            </Fragment>
          );
        })}
        {Object.values(changed).filter((c) => c.removed).map((c) => (
          <div className="dash-sched-row" key={"rm-" + c.old?.pos} style={{ opacity: 0.65 }}>
            <span className="dash-sched-time">{c.old ? `${c.old.pos}-й` : ""}</span>
            <span className="dash-sched-subj" style={{ textDecoration: "line-through" }}>{c.old?.subject}</span>
            <span className="muted" style={{ fontSize: 12 }}> урок отменён</span>
          </div>
        ))}
        {notes.length > 0 && (
          <div className="dash-sched-note"><img src="/icons/icon-backpack.webp" className="note-3d" alt="" /> Взять с собой: {notes.join(", ").toLowerCase()}</div>
        )}
        {activeOvs.length > 0 && (() => {
          const end = dayEndTime(lessons, bells);
          return end ? (
            <div className="dash-sched-note">Занятия закончатся в <b>{end}</b></div>
          ) : null;
        })()}
      </div>
    </>
  );
}

// Короткий фрагмент текста объявления для карточки на главной
function snippet(text, max = 140) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// Переход к конкретной карточке в разделе: запоминаем цель и открываем вкладку
function goFocus(kind, id, tab, onTab) {
  try { sessionStorage.setItem("rk1g-focus-" + kind, String(id)); } catch {}
  onTab(tab);
}

// Семья прочитала объявление? (по отметкам в базе)
function isReadBy(a, reads, family) {
  return !!(family && (reads || []).some((r) => r.announcement_id === a.id && familyNs(family.n).includes(r.family_n)));
}

// Нажали «Прочитать» на главной: сразу отмечаем прочтение семьёй (если семья выбрана)
// и переходим к объявлению. Отметка окончательная, список прочтений обновится сам (realtime).
function readAndGo(a, reads, family, onTab) {
  if (family && !isReadBy(a, reads, family)) {
    markRead(a.id, family.n, family.child).catch((e) => console.error("Отметка прочтения:", e));
  }
  goFocus("ann", a.id, "announcements", onTab);
}

// ===== Важные объявления на главной (ТЗ §7): жёлтая подложка, «Прочитать» =====
function ImportantNews({ announcements, reads, family, onTab }) {
  const imp = (announcements || []).filter((a) => a.status === "active" && a.important);
  if (!imp.length) return null;
  return (
    <>
      {imp.map((a) => {
        const read = isReadBy(a, reads, family);
        return (
          <div className="imp-card reveal d1" key={a.id} id={"home-imp-" + a.id}>
            <img className="imp-ico" src="/icon-announcement.png" alt="" aria-hidden="true" />
            <div className="imp-body">
              <div className="imp-tags">
                <span className="imp-label">Важное объявление</span>
                {read
                  ? <span className="imp-read done">Прочитано ✓</span>
                  : <span className="imp-read">Не прочитано</span>}
              </div>
              <div className="imp-title">{a.title}</div>
              {a.body && <div className="imp-sub">{snippet(a.body)}</div>}
              <div className="imp-meta">{a.author || "Комитет"} · {fmtNewsDate(a.created_at)}</div>
            </div>
            <button className="pill-btn blue imp-btn" onClick={() => readAndGo(a, reads, family, onTab)}>
              Прочитать
            </button>
          </div>
        );
      })}
    </>
  );
}

// ===== Активные голосования на главной (ТЗ §8): сиреневая подложка, персональный статус =====
function ActivePolls({ polls, family, onTab }) {
  const open = (polls || []).filter((p) => pollState(p) === "open");
  if (!open.length) return null;
  const voted = (p) => !!(family && (p.votes || []).some((v) => familyNs(family.n).includes(v.family_n)));
  // Сначала те, где семья ещё не голосовала; внутри — более срочные (ближний срок) выше
  const sorted = [...open].sort((a, b) => {
    const va = voted(a) ? 1 : 0, vb = voted(b) ? 1 : 0;
    if (va !== vb) return va - vb;
    return (a.deadline || "9999").localeCompare(b.deadline || "9999");
  });
  return (
    <>
      {sorted.map((p) => {
        const my = voted(p);
        return (
          <div className="pollhome-card reveal d1" key={p.id}>
            <div className="pollhome-ico" aria-hidden="true">🗳️</div>
            <div className="pollhome-body">
              <div className="pollhome-tags">
                <span className="pollhome-label">Нужно ваше мнение</span>
                {my
                  ? <span className="pollhome-state done">Вы проголосовали ✓</span>
                  : <span className="pollhome-state">Вы ещё не проголосовали</span>}
              </div>
              <div className="pollhome-title">{p.question}</div>
              {p.description && <div className="pollhome-sub">{snippet(p.description, 120)}</div>}
              <div className="pollhome-meta">
                {p.deadline ? `Голосуем до ${fmtDeadline(p.deadline)} включительно` : "Срок не ограничен"}
                {" · "}проголосовали {p.votes?.length || 0} из {FAMILIES_COUNT} семей
              </div>
            </div>
            <button className="pill-btn blue pollhome-btn" onClick={() => goFocus("poll", p.id, "votes", onTab)}>
              {my ? "Открыть голосование" : "Проголосовать"}
            </button>
          </div>
        );
      })}
    </>
  );
}

// ===== «Новости класса» — карточка в верхней части главной =====
// (28.10.2026 поднята из колонки у расписания, чтобы родители видели сразу)
// Последние обычные (не важные) объявления: важные показаны отдельной
// карточкой выше, поэтому здесь не дублируются.
function DashNews({ announcements, reads, family, onTab }) {
  const regular = (announcements || [])
    .filter((a) => a.status === "active" && !a.important)
    .slice(0, 3);
  return (
    <div className="card dash-news reveal d3">
      <div className="dash-card-head">
        <img src="/icons/icon-envelope.webp" className="head-3d" alt="" />
        <div className="dash-card-titles">
          <h2 className="sec-title">Новости класса</h2>
          <div className="dash-card-sub">Объявления комитета</div>
        </div>
      </div>
      {!regular.length && <div className="bday-empty muted">Новых объявлений пока нет</div>}
      {regular.map((a) => {
        const read = isReadBy(a, reads, family);
        return (
          <button className="dash-news-row" key={a.id} onClick={() => readAndGo(a, reads, family, onTab)}>
            {/* Объёмная иконка строки (как на референсе); у непрочитанного — синяя точка-метка */}
            <span className={"dash-news-ico" + (read ? "" : " unread")} aria-hidden="true">
              <img src="/icons/icon-envelope.webp" alt="" />
            </span>
            <span className="dash-news-body">
              <span className="dash-news-title">{a.pinned && <span title="Закреплено">📌 </span>}{a.title}</span>
              {a.body && <span className="dash-news-sub">{snippet(a.body, 90)}</span>}
              <span className="dash-news-meta">
                {a.author || "Комитет"} · {fmtNewsDate(a.created_at)}
                {read && <span className="dash-news-read"> · ✓ Прочитано</span>}
              </span>
            </span>
            <span className="dash-news-arrow" aria-hidden="true">›</span>
          </button>
        );
      })}
      <button className="pill-btn blue dash-news-all" onClick={() => onTab("announcements")}>
        Все объявления →
      </button>
    </div>
  );
}

// Праздничный баннер: сегодняшние именинники или День летних детей
function BdayBanner({ ev }) {
  if (ev.summerToday) {
    return (
      <div className="bday-banner summer reveal d1">
        <span className="bday-banner-ico"><Ic id="i-sun" /></span>
        <div>
          <div className="bday-banner-title">Сегодня — День летних детей!</div>
          <div className="bday-banner-sub">
            Поздравляем именинников лета: {joinNames(ev.summerToday)} <Ic id="i-spark" />
          </div>
        </div>
      </div>
    );
  }
  if (ev.today.length) {
    const many = ev.today.length > 1;
    return (
      <div className="bday-banner reveal d1">
        <span className="bday-banner-ico"><Ic id="i-cake" /></span>
        <div>
          <div className="bday-banner-title">
            {joinNames(ev.today)} {many ? "отмечают дни рождения" : "отмечает день рождения"}!
          </div>
          <div className="bday-banner-sub">
            {many ? "Им исполняется" : "Исполняется"} {ev.today[0].turns} лет — поздравляем от всего класса <Ic id="i-spark" />
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// Именинники выбранного месяца: дата, сколько исполняется, статус относительно сегодня
function kidsOfMonth(list, y, m) {
  const t = new Date();
  const tm = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return list
    .filter((k) => Number(k.born.split("-")[1]) - 1 === m)
    .map((k) => {
      const d = Number(k.born.split("-")[2]);
      const date = new Date(y, m, d);
      const days = Math.round((date - tm) / 86400000);
      const bornYear = Number(k.born.slice(0, 4));
      // Возраст показываем только если год рождения известен и правдоподобен
      const turns = bornYear >= 2000 && bornYear <= tm.getFullYear() ? y - bornYear : null;
      return { ...k, date, days, turns, passed: days < 0 };
    })
    .sort((a, b) => a.days - b.days);
}

// Блок «Дни рождения»: напоминания + все именинники месяца с переключением месяцев
function BirthdaysWidget({ committee, ev, list, onTab }) {
  // Стартовый месяц — тот, где ближайший день рождения (включая сегодня)
  const [view, setView] = useState(() => {
    const nearest = upcomingBirthdays(list, new Date(), 1)[0];
    const base = nearest ? nearest.next : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const shiftMonth = (dir) =>
    setView((v) => {
      const d = new Date(v.y, v.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const kids = kidsOfMonth(list, view.y, view.m);
  const notices = [];
  if (ev.summerTomorrow) {
    notices.push({
      key: "summer-tm", tone: "gold", icon: "i-sun",
      title: "Завтра — День летних детей!",
      sub: "Именинники лета: " + joinNames(ev.summerTomorrow),
    });
  }
  if (ev.tomorrow.length) {
    const many = ev.tomorrow.length > 1;
    notices.push({
      key: "tm", tone: "pink", icon: "i-cake",
      title: `Завтра ${many ? "дни рождения отмечают" : "день рождения отмечает"} ${joinNames(ev.tomorrow)}`,
      sub: `Исполнится ${ev.tomorrow[0].turns} лет — не забудьте поздравить!`,
    });
  }
  if (committee) {
    ev.soon.filter((g) => g.days >= 2).forEach((g) => {
      notices.push({
        key: "soon-" + g.days, tone: "blue", icon: "i-gift",
        title: `${inDaysWord(g.days).replace(/^./, (c) => c.toUpperCase())} — день рождения у ${g.kids.length > 1 ? "ребят" : "ребёнка"}: ${joinNames(g.kids)}`,
        sub: `${fmtBd(g.kids[0].born)} · исполнится ${g.kids[0].turns} лет · пора подготовить поздравление от класса`,
      });
    });
  }
  return (
    <>
      <div className="sec-head reveal d3">
        <span className="sec-dot pink"><Ic id="i-cake" /></span>
        <h2 className="sec-title">Дни рождения в {BD_MONTHS_PREP[view.m]}{view.y !== new Date().getFullYear() ? ` ${view.y}` : ""}</h2>
        <span className="bd-nav" role="group" aria-label="Переключение месяца">
          <button className="bd-nav-btn" aria-label="Предыдущий месяц" onClick={() => shiftMonth(-1)}>‹</button>
          <button className="bd-nav-btn" aria-label="Следующий месяц" onClick={() => shiftMonth(1)}>›</button>
        </span>
      </div>
      {notices.map((n) => (
        <div className={"attn-card bday-notice reveal d3"} key={n.key}>
          <div className={"attn-ico " + n.tone}><Ic id={n.icon} /></div>
          <div className="attn-body">
            <div className="attn-title">{n.title}</div>
            <div className="attn-sub">{n.sub}</div>
          </div>
        </div>
      ))}
      <div className="card bday-upcoming reveal d3">
        {kids.length === 0 && (
          <div className="bday-empty muted">В {BD_MONTHS_PREP[view.m]} дней рождения нет</div>
        )}
        {kids.map((k) => (
          <div className={"bday-row" + (k.passed ? " past" : "")} key={k.id}>
            <span className="bday-date">{fmtBd(k.born)}</span>
            <span className="bday-name"><Ic id="i-cake" /> {bdName(k)}</span>
            <span className="bday-turns">{k.turns == null ? "" : k.passed ? `исполнилось ${k.turns}` : `исполнится ${k.turns}`}</span>
            <span className={"bday-when" + (k.passed ? " past" : k.days >= 0 && k.days <= 5 ? " close" : "")}>
              {k.passed ? "уже отметили" : k.days === 0 ? "сегодня!" : inDaysWord(k.days)}
            </span>
          </div>
        ))}
        <div className="dash-sched-foot">
          <span className="muted" style={{ fontSize: 12 }}>
            {committee ? "Комитету напоминаем за 5 дней, всем родителям — за 1 день" : "Напоминание появится за день до праздника"}
          </span>
          <button className="pill-btn pink" onClick={() => onTab("class")}>Все дни рождения</button>
        </div>
      </div>
    </>
  );
}

// ===== Календарь предстоящих праздников =====

// Иконка по типу записи, если своя не задана
const HOLIDAY_EMOJI = { holiday: "🎉", vacation: "🏖️", class: "🎒" };

// ===== 3D-иконки событий (файлы public/icons/icon-*.webp) =====
// Эмодзи в интерфейсе не показываем — подбираем 3D-иконку:
// по эмодзи записи → по словам в названии → по типу записи.
const EVENT_ICON_BY_EMOJI = {
  "🎄": "tree", "✨": "star", "⭐": "star", "🌟": "star",
  "🎖": "medal", "🏅": "medal", "🥇": "medal",
  "🌷": "tulip", "💐": "tulip", "🌸": "tulip",
  "🕊": "dove", "🔔": "bell", "🍂": "autumn", "🍁": "autumn",
  "⛄": "snowman", "☃": "snowman", "❄": "snowman",
  "🌱": "sprout", "🌿": "sprout", "☀": "sun", "🌞": "sun", "🏖": "sun",
  "🎉": "party", "🎊": "party", "🎈": "party",
  "🎒": "backpack", "🎂": "cake", "📌": "note", "📝": "note",
};
const EVENT_ICON_BY_WORD = [
  ["собрани", "meeting"], ["новый год", "tree"], ["ёлк", "tree"], ["елк", "tree"],
  ["рождеств", "star"], ["защитник", "medal"], ["8 март", "tulip"], ["побед", "dove"],
  ["звонок", "bell"], ["осенн", "autumn"], ["зимн", "snowman"], ["весенн", "sprout"],
  ["летн", "sun"],
];
function eventIcon(rec) {
  // Эмодзи может быть с «селектором начертания» (️) — убираем его
  const e = (rec.emoji || "").replace(/[\uFE00-\uFE0F]/g, "");
  if (e && EVENT_ICON_BY_EMOJI[e]) return EVENT_ICON_BY_EMOJI[e];
  const t = (rec.title || "").toLowerCase();
  for (const [w, ic] of EVENT_ICON_BY_WORD) if (t.includes(w)) return ic;
  const k = rec.kind || rec.type;
  if (k === "vacation") return "sun";
  if (k === "class" || k === "event") return "backpack";
  if (k === "note") return "note";
  if (k === "bday") return "cake";
  return "party";
}
function EventIcon({ rec, size = 20, className = "" }) {
  return (
    <img
      src={`/icons/icon-${eventIcon(rec)}.webp`} alt="" aria-hidden="true"
      className={className} width={size} height={size}
      style={{ objectFit: "contain", verticalAlign: "-4px", marginRight: 6 }}
    />
  );
}

// Сколько дней осталось до даты (по Минску); 0 = сегодня, отрицательное = прошло
function daysUntil(iso) {
  if (!iso) return null;
  const now = minskNow();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(iso + "T00:00:00");
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86400000);
}

function fmtHolidayDate(iso) {
  if (!iso) return "даты уточняются";
  const d = new Date(iso + "T00:00:00");
  const year = d.getFullYear() !== minskNow().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

// Диапазон дат: «2–6 ноября» или «28 октября – 2 ноября» (для каникул)
function fmtHolidayRange(aIso, bIso) {
  if (!bIso) return fmtHolidayDate(aIso);
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  const year = b.getFullYear() !== minskNow().getFullYear() ? ` ${b.getFullYear()}` : "";
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}${year}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}${year}`;
}

// Диапазон словами для карточки события: «со 2 по 6 ноября»
function ccalRangeText(aIso, bIso) {
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  const pre = a.getDate() === 2 ? "со" : "с";
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${pre} ${a.getDate()} по ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${pre} ${a.getDate()} ${MONTHS[a.getMonth()]} по ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

// Форма добавления/правки праздника (комитет и учитель)
function HolidayForm({ initial, authorName, onDone, onCancel, toast }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState(initial?.on_date || "");
  const [endDate, setEndDate] = useState(initial?.end_date || "");
  const [kind, setKind] = useState(initial?.kind || "holiday");
  const [emoji, setEmoji] = useState(initial?.emoji || "");
  const [note, setNote] = useState(initial?.note || "");
  const [feeLink, setFeeLink] = useState(!!initial?.fee_link);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const t = title.trim();
    if (!t) { toast("Напишите название праздника"); return; }
    setSaving(true);
    try {
      await saveHoliday({
        ...(initial?.id ? { id: initial.id } : {}),
        title: t,
        on_date: date || null,
        // Конец диапазона шлём, только если он задан (или был) —
        // иначе база без колонки end_date (до calendar-dates.sql) вернёт ошибку
        ...(endDate || initial?.end_date ? { end_date: endDate || null } : {}),
        kind,
        emoji: emoji.trim() || null,
        note: note.trim() || null,
        fee_link: feeLink,
        author: authorName || "Комитет",
      });
      toast(initial?.id ? "Праздник обновлён" : "Праздник добавлен в календарь");
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };
  return (
    <div className="note-form" style={{ alignItems: "stretch" }}>
      <input
        className="note-input" type="text" placeholder="Название: Осенний бал"
        value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
      />
      <input className="note-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
        aria-label="Дата (можно оставить пустой — покажем «даты уточняются»)" />
      <input className="note-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
        aria-label="По какую дату (для каникул; пусто = один день)"
        title="По какую дату (для каникул; пусто = один день)" />
      <select className="note-date" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Тип записи">
        <option value="holiday">Праздник</option>
        <option value="vacation">Каникулы</option>
      </select>
      <input className="note-date" type="text" placeholder="Эмодзи" value={emoji} maxLength={4}
        style={{ width: 80 }} onChange={(e) => setEmoji(e.target.value)} />
      <input
        className="note-input" type="text" placeholder="Заметка: утренник в 10:00, нарядная форма"
        value={note} maxLength={200} onChange={(e) => setNote(e.target.value)}
      />
      <label className="note-check" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input type="checkbox" checked={feeLink} onChange={(e) => setFeeLink(e.target.checked)} />
        показать кнопку «К сбору» (идёт сбор денег на этот праздник)
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="pill-btn blue" disabled={saving} onClick={save}>
          {saving ? "Сохраняю…" : initial?.id ? "Сохранить" : "Добавить"}
        </button>
        <button className="pill-btn" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

// Карточка «Предстоящие праздники»: праздники и каникулы из class_holidays
// плюс события класса от учителя (class_events) — одной лентой.
// Сама ходит в базу: fetchHolidays вернёт null, пока не запущен holidays-setup.sql.
function HolidaysWidget({ committee, role, events, authorName, toast, onTab }) {
  const canEdit = committee || role === "teacher";
  const [rows, setRows] = useState(null);     // записи class_holidays (null = нет таблицы)
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let dead = false;
    fetchHolidays().then((d) => { if (!dead) setRows(d); });
    return () => { dead = true; };
  }, [reload]);

  // Общая лента: праздники/каникулы + события класса (их правят в кабинете учителя)
  const list = [
    ...(rows || []).map((h) => ({ ...h, src: "holiday" })),
    ...(events || []).map((e) => ({
      id: "ev-" + e.id, src: "event", kind: "class", title: e.title,
      on_date: e.on_date, emoji: null,
      note: [e.time_text, e.place].filter(Boolean).join(" · ") || null,
    })),
  ].filter((x) => {
    // Диапазон (каникулы) не прошёл, пока не кончился end_date
    const d = daysUntil(x.end_date || x.on_date);
    return d === null || d >= 0; // прошедшие не показываем
  });
  const dated = list.filter((x) => x.on_date).sort((a, b) => a.on_date.localeCompare(b.on_date));
  const undated = list.filter((x) => !x.on_date);
  const visible = showAll ? [...dated, ...undated] : dated.slice(0, 4);
  const hiddenCount = dated.length + undated.length - (showAll ? 0 : visible.length);

  const del = async (h) => {
    if (!confirm(`Удалить «${h.title}» из календаря?`)) return;
    try { await deleteHoliday(h.id); setReload((r) => r + 1); toast("Запись удалена"); }
    catch (e) { console.error(e); toast("Не получилось удалить — попробуйте ещё раз"); }
  };

  // Таблицы ещё нет и событий класса тоже — карточку не показываем,
  // чтобы не висела пустая до запуска holidays-setup.sql
  if (rows === null && !(events || []).length && !canEdit) return null;

  return (
    <>
      <div className="sec-head reveal d3">
        <span className="sec-dot gold"><Ic id="i-spark" /></span>
        {/* Якорь для ссылки «Весь календарь» из блока календаря */}
        <h2 className="sec-title" id="holidays-full-title" tabIndex={-1}>Предстоящие праздники</h2>
        {canEdit && !formOpen && !editRow && (
          <button className="pill-btn blue" style={{ marginLeft: "auto" }} onClick={() => setFormOpen(true)}>+ Добавить</button>
        )}
      </div>
      <div className="card reveal d3">
        {(formOpen || editRow) && (
          <HolidayForm
            initial={editRow}
            authorName={authorName}
            toast={toast}
            onCancel={() => { setFormOpen(false); setEditRow(null); }}
            onDone={() => { setFormOpen(false); setEditRow(null); setReload((r) => r + 1); }}
          />
        )}
        {rows === null && canEdit && (
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
            Таблица календаря ещё не создана — запустите holidays-setup.sql в Supabase
          </div>
        )}
        {visible.length === 0 && <div className="bday-empty muted">Ближайших праздников пока нет</div>}
        {visible.map((h) => {
          const d = daysUntil(h.on_date);
          const going = h.end_date && d !== null && d <= 0 && daysUntil(h.end_date) >= 0;
          return (
            <div className={"bday-row" + (d === 0 || going ? " today" : "")} key={h.id}>
              <span className="bday-date">{h.end_date ? fmtHolidayRange(h.on_date, h.end_date) : fmtHolidayDate(h.on_date)}</span>
              <span className="bday-name">
                <EventIcon rec={h} size={20} />
                {h.title}
                {h.note && <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}> · {h.note}</span>}
              </span>
              <span className={"bday-when" + (d !== null && d >= 0 && d <= 5 ? " close" : "")}>
                {d === null ? "" : going ? "идут сейчас" : d === 0 ? "сегодня!" : inDaysWord(d)}
              </span>
              {h.fee_link && (
                <button className="pill-btn pink" onClick={() => onTab("fees")}>К сбору →</button>
              )}
              {canEdit && h.src === "holiday" && (
                <span style={{ display: "flex", gap: 4 }}>
                  <button className="note-del" title="Изменить" aria-label="Изменить"
                    onClick={() => { setEditRow(h); setFormOpen(false); }}>✎</button>
                  <button className="note-del" title="Удалить" aria-label="Удалить" onClick={() => del(h)}>✕</button>
                </span>
              )}
            </div>
          );
        })}
        {(hiddenCount > 0 || showAll) && (
          <div className="dash-sched-foot">
            <span className="muted" style={{ fontSize: 12 }}>
              Праздники, каникулы и события класса — одной лентой
            </span>
            <button className="pill-btn blue" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Свернуть" : `Показать все (${dated.length + undated.length})`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ===== Календарь класса (встроенный, ТЗ редизайна главной) =====
// Слева — сетка месяца (неделя с понедельника), справа — ближайшие события
// или события выбранного дня. Источники: события класса (class_events),
// праздники и каникулы (class_holidays), дни рождения, личные напоминания
// своей семьи. Объявления в события автоматически не превращаются.

const CCAL_MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const CCAL_MON_ABBR = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const CCAL_DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const CCAL_TYPE_LABEL = {
  event: "Событие класса", holiday: "Праздник", vacation: "Каникулы",
  bday: "День рождения", note: "Напоминание семьи",
};

// Цвет точки по типу записи: жёлтая — события/праздники, розовая — ДР, синяя — напоминания
function ccalTone(type) {
  return type === "bday" ? "pink" : type === "note" ? "blue" : "gold";
}

// ISO-дата из года/месяца/дня
function ccalIso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// «одно событие / 2 события / нет событий» — для aria-подписей дней
function ccalCountWord(n) {
  if (!n) return "нет событий";
  if (n === 1) return "одно событие";
  return `${n} ${pluralRu(n, "событие", "события", "событий")}`;
}

// Время «10:00» из свободного текста («в 10:00», «10.00–11.30») — для сортировки
function ccalTimeKey(t) {
  const m = /(\d{1,2})[:.](\d{2})/.exec(t || "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

// Аббревиатуры месяцев для белой плашки даты («ОКТ», как на референсе)
const CCAL_MON_UP = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];

// Имена через запятую, последние два — через «и»: «Ева Милишкевич и Ольга Белоус»
function ccalJoin(names) {
  if (!names || !names.length) return "";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " и " + names[names.length - 1];
}

// ===== SVG-иконки блока (по ТЗ: никаких текстовых «‹ ›» и эмодзи) =====

// Шеврон переключения месяца — тёмно-синий, на белой кнопке
function CcalChevron({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M9.8 3.4 5.4 8l4.4 4.6" : "M6.2 3.4 10.6 8l-4.4 4.6"}
        stroke="#1B2A5C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// Стрелка «→» для текстовых ссылок («Весь календарь», «Подробнее»)
function CcalArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1.8 6h7.6M6.2 2.6 9.6 6 6.2 9.4" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Кружок «i» у подсказки внизу правой панели
function CcalInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="ccal2-hint-ico">
      <circle cx="9" cy="9" r="7.4" stroke="#C2C6D1" strokeWidth="1.4" />
      <circle cx="9" cy="5.8" r="1" fill="#8A8FA0" />
      <path d="M9 8.2v4.2" stroke="#8A8FA0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Белая плашка даты 54×64 в карточке события: число, месяц и точка типа
function CcalPlaque({ date, tone }) {
  const d = new Date(date + "T00:00:00");
  return (
    <span className={"ccal2-plq " + tone} aria-hidden="true">
      <b>{d.getDate()}</b>
      <small>{CCAL_MON_UP[d.getMonth()]}</small>
      <i className={"ccal2-dot " + tone} />
    </span>
  );
}

// Карточка события в правой панели: жёлтая — события/праздники,
// розовая — дни рождения (с тортиком и плашкой), голубая — напоминания семьи
function CcalEventCard({ it, onTab, onPick }) {
  const tone = ccalTone(it.type);
  const days = daysUntil(it.date);
  // У каникул показываем диапазон дат, у остальных — время и место или заметку
  const meta = it.endDate
    ? ccalRangeText(it.date, it.endDate)
    : [it.time || null, it.place || null].filter(Boolean).join(" · ") || it.note || null;
  const names = it.names || (it.name ? [it.name] : []);
  return (
    <div className={"ccal2-ev " + tone}>
      <CcalPlaque date={it.date} tone={tone} />
      <span className="ccal2-ev-body">
        {it.type === "bday" ? (
          <>
            <span className="ccal2-ev-title">{names.length > 1 ? "Дни рождения" : "День рождения"}</span>
            <span className="ccal2-ev-meta">
              {ccalJoin(names)}
              {/* Сегодняшний ДР — «исполняется», будущий — «исполнится» */}
              {it.turns != null ? ` — ${days === 0 ? "исполняется" : "исполнится"} ${it.turns}` : ""}
            </span>
            <span className="ccal2-badge">Поздравляем всем классом</span>
          </>
        ) : (
          <>
            <span className="ccal2-ev-title">{it.title}</span>
            {meta && <span className="ccal2-ev-meta">{meta}</span>}
            {/* Ссылка-действие — в теле карточки, справа место занято иконкой */}
            {it.feeLink ? (
              <button className="ccal2-ev-link pink" onClick={() => onTab("fees")}>К сбору <CcalArrow /></button>
            ) : onPick ? (
              <button className="ccal2-ev-link" onClick={() => onPick(it.date)}>Подробнее <CcalArrow /></button>
            ) : null}
          </>
        )}
      </span>
      {/* Справа — большая 3D-иконка события, как тортик у дней рождения */}
      {it.type === "bday" ? (
        <img src="/icons/icon-cake.webp" className="ccal2-cake" alt="" />
      ) : (
        <img src={`/icons/icon-${eventIcon(it)}.webp`} className="ccal2-cake" alt="" />
      )}
    </div>
  );
}

// Встроенный календарь класса по референсу: шапка и обе панели внутри одной
// белой карточки. Слева — сетка месяца, справа — ближайшие события или
// события выбранного дня. Источники: события класса, праздники/каникулы,
// дни рождения и личные напоминания семьи. Проп demo — фиксированное
// состояние только для визуальной приёмки (страница /calendar-demo).
export function ClassCalendar({ events, notes, bdays, family, onTab, demo, fullLink = true, onAddEvent }) {
  const now = demo ? new Date(demo.today + "T12:00:00") : minskNow();
  const todayIso = demo ? demo.today : minskIso();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(null); // ISO выбранного дня или null
  // Праздники и каникулы комитета — календарь сам ходит в базу (как HolidaysWidget)
  const [hols, setHols] = useState(demo ? demo.hols : null);
  const [loading, setLoading] = useState(!demo);
  useEffect(() => {
    if (demo) return;
    let dead = false;
    fetchHolidays()
      .then((d) => { if (!dead) { setHols(d); setLoading(false); } })
      .catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [demo]);

  // --- Записи с датами из всех источников (кроме дней рождения — они годовые) ---
  const baseItems = [];
  (events || []).forEach((e) => {
    if (e.on_date) baseItems.push({
      id: "ev-" + e.id, type: "event", date: e.on_date, title: e.title,
      time: e.time_text || null, place: e.place || null,
    });
  });
  (hols || []).forEach((h) => {
    if (h.on_date) baseItems.push({
      id: "hol-" + h.id, type: h.kind === "vacation" ? "vacation" : "holiday",
      date: h.on_date, endDate: h.end_date || null, title: h.title,
      emoji: h.emoji || null, note: h.note || null, feeLink: !!h.fee_link,
    });
  });
  // Личные напоминания видит только своя семья
  if (family) (notes || []).forEach((n) => {
    if (!n.from_teacher && !n.done && n.remind_date) baseItems.push({
      id: "note-" + n.id, type: "note", date: n.remind_date, title: n.text,
    });
  });

  // Дни рождения месяца (y, m): дата — в этом году просмотра
  const bdayItemsFor = (y, m) => (bdays || [])
    .filter((k) => Number(k.born.split("-")[1]) - 1 === m)
    .map((k) => {
      const day = Number(k.born.split("-")[2]);
      const bornYear = Number(k.born.slice(0, 4));
      return {
        id: `bd-${k.id}-${y}`, type: "bday", date: ccalIso(y, m, day), name: bdName(k),
        turns: bornYear >= 2000 && bornYear <= y ? y - bornYear : null,
      };
    });

  // --- Сетка месяца: карта «дата → события». Каникулы (endDate) занимают
  // каждый день диапазона, попавший в просматриваемый месяц ---
  const monthItems = [];
  baseItems.forEach((it) => {
    const d = new Date(it.date + "T00:00:00");
    const end = new Date((it.endDate || it.date) + "T00:00:00");
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === view.y && d.getMonth() === view.m)
        monthItems.push({ ...it, date: ccalIso(view.y, view.m, d.getDate()) });
    }
  });
  monthItems.push(...bdayItemsFor(view.y, view.m));
  const byDate = {};
  monthItems.forEach((it) => { (byDate[it.date] = byDate[it.date] || []).push(it); });

  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // 0 = понедельник
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const cellCount = Math.ceil((firstDow + dim) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const d = i - firstDow + 1;
    // Дни соседних месяцев — пустые клетки без чисел (по ТЗ)
    if (d < 1 || d > dim) return { out: true };
    const iso = ccalIso(view.y, view.m, d);
    return { d, iso, items: byDate[iso] || [], dow: i % 7 };
  });

  // Функциональное обновление: быстрые повторные клики не теряются
  const shiftMonth = (dir) => setView((v) => {
    const nd = new Date(v.y, v.m + dir, 1);
    return { y: nd.getFullYear(), m: nd.getMonth() };
  });
  const goToday = () => {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(null);
  };
  // «Весь календарь» ведёт к полной ленте «Предстоящие праздники» ниже
  const goFull = () => {
    const el = document.getElementById("holidays-full-title");
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true }); }
  };

  // Дни рождения одной даты показываем одной карточкой со всеми именами
  const groupBd = (list) => {
    const byD = {};
    list.forEach((b) => { (byD[b.date] = byD[b.date] || []).push(b); });
    return Object.entries(byD).map(([date, kids]) => ({
      id: "bd-" + date, type: "bday", date,
      names: kids.map((k) => k.name),
      turns: kids.length === 1 ? kids[0].turns : null,
    }));
  };

  // --- Правая панель: ближайшие события или события выбранного дня ---
  let sideTitle, sideItems, sideEmpty = null;
  if (selected) {
    const [sy, sm] = selected.split("-").map(Number);
    const dayItems = [
      // Диапазон (каникулы) попадает в день, если выбранная дата внутри него
      ...baseItems.filter((it) => it.date === selected ||
        (it.endDate && it.date <= selected && selected <= it.endDate)),
      ...groupBd(bdayItemsFor(sy, sm - 1).filter((it) => it.date === selected)),
    ].sort((a, b) => (ccalTimeKey(a.time) || "") < (ccalTimeKey(b.time) || "") ? -1 : 1);
    const sd = new Date(selected + "T00:00:00");
    sideTitle = `${sd.getDate()} ${MONTHS[sd.getMonth()]}, ${DAYS[sd.getDay()].toLowerCase()}`;
    sideItems = dayItems;
    if (!dayItems.length) sideEmpty = "На этот день событий нет";
  } else {
    sideTitle = "Ближайшие события";
    // ДР: ближайшее наступление (в этом или следующем году)
    const nextBd = (bdays || []).map((k) => {
      const [, mm, dd] = k.born.split("-").map(Number);
      let y = now.getFullYear();
      if (ccalIso(y, mm - 1, dd) < todayIso) y += 1;
      const bornYear = Number(k.born.slice(0, 4));
      return {
        id: `bd-${k.id}`, type: "bday", date: ccalIso(y, mm - 1, dd), name: bdName(k),
        turns: bornYear >= 2000 && bornYear <= y ? y - bornYear : null,
      };
    });
    sideItems = [...baseItems.filter((it) => (it.endDate || it.date) >= todayIso), ...groupBd(nextBd)]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
    if (!sideItems.length) sideEmpty = "Ближайших событий пока нет";
  }

  return (
    <div className="card ccal2 reveal d2">
      {/* Шапка внутри карточки: 3D-иконка, заголовок, «Сегодня», «Весь календарь» */}
      <div className="ccal2-head">
        <img src="/icons/icon-calendar.webp" className="ccal2-ico" alt="" />
        {/* Заголовок получает фокус при переходе с плитки «Календарь» */}
        <h2 className="ccal2-title" id="class-calendar-title" tabIndex={-1}>Календарь класса</h2>
        <button className="ccal2-today" onClick={goToday}>Сегодня</button>
        {/* Кабинет учителя (ТЗ 21.10.2026): «+ Событие» прямо в шапке календаря.
            Выбранный в сетке день автоматически подставляется в форму. */}
        {onAddEvent && (
          <button className="ccal2-add" onClick={() => onAddEvent(selected || null)}>
            + Событие
          </button>
        )}
        {/* В кабинете учителя ленты «Предстоящие праздники» нет — ссылку прячем */}
        {fullLink && <button className="ccal2-link" onClick={goFull}>Весь календарь <CcalArrow /></button>}
      </div>
      <div className="ccal2-cols">
        {/* Левая панель: навигация по месяцам, сетка, легенда */}
        <div className="ccal2-left">
          <div className="ccal2-nav" role="group" aria-label="Переключение месяца">
            <button className="ccal2-nav-btn" aria-label="Предыдущий месяц" onClick={() => shiftMonth(-1)}>
              <CcalChevron dir="left" />
            </button>
            <div className="ccal2-month">{CCAL_MONTHS_NOM[view.m]} {view.y}</div>
            <button className="ccal2-nav-btn" aria-label="Следующий месяц" onClick={() => shiftMonth(1)}>
              <CcalChevron dir="right" />
            </button>
          </div>
          <div className="ccal2-grid" role="grid" aria-label={`Календарь: ${CCAL_MONTHS_NOM[view.m]} ${view.y}`}>
            {CCAL_DOW.map((d) => (
              <span className="ccal2-dow" key={d} aria-hidden="true">{d}</span>
            ))}
            {cells.map((c, i) =>
              c.out ? (
                <span className="ccal2-day out" key={"o" + i} aria-hidden="true" />
              ) : (
                <button
                  key={c.iso}
                  className={
                    "ccal2-day" +
                    (c.iso === todayIso ? " today" : "") +
                    (c.iso === selected ? " sel" : "") +
                    (c.dow >= 5 ? " wkend" : "") +
                    // Дата с событиями — мягкая заливка цвета типа; «сегодня» — синий круг
                    (c.items.length && c.iso !== todayIso ? " ev-" + ccalTone(c.items[0].type) : "")
                  }
                  aria-label={`${c.d} ${MONTHS[view.m]} ${view.y}, ${DAYS[new Date(c.iso + "T00:00:00").getDay()].toLowerCase()}, ${ccalCountWord(c.items.length)}`}
                  aria-pressed={c.iso === selected}
                  onClick={() => setSelected(c.iso === selected ? null : c.iso)}
                >
                  <span className="ccal2-num">{c.d}</span>
                  {c.items.length > 0 && c.iso !== todayIso && (
                    <span className="ccal2-dots" aria-hidden="true">
                      {/* Одна точка на ТИП записей: несколько типов — несколько точек поменьше */}
                      {[...new Set(c.items.map((it) => ccalTone(it.type)))].slice(0, 3).map((t, j, arr) => (
                        <span className={"ccal2-dot " + t + (arr.length > 1 ? " many" : "")} key={t} />
                      ))}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
          <div className="ccal2-legend" aria-hidden="true">
            <span><i className="ccal2-dot gold" /> События</span>
            <span><i className="ccal2-dot pink" /> Дни рождения</span>
            <span><i className="ccal2-dot blue" /> Напоминания</span>
          </div>
        </div>
        {/* Правая панель: ближайшие события или выбранный день */}
        <div className="ccal2-side">
          <div className="ccal2-side-title">{sideTitle}</div>
          {loading && !sideItems.length ? (
            <div className="ccal2-empty muted">События загружаются…</div>
          ) : sideEmpty ? (
            <div className="ccal2-empty muted">
              {sideEmpty}
              {/* У учителя пустой день — не тупик: событие создаётся на месте,
                  дата дня уже подставлена в форму (ТЗ 21.10.2026, §14) */}
              {onAddEvent && selected && (
                <button className="ccal2-empty-add" onClick={() => onAddEvent(selected)}>
                  + Добавить событие
                </button>
              )}
            </div>
          ) : (
            sideItems.map((it) => (
              <CcalEventCard
                key={it.id} it={it} onTab={onTab}
                onPick={selected ? null : (d) => {
                  // «Подробнее» показывает день в сетке — вместе с его месяцем
                  const [y, m] = d.split("-").map(Number);
                  setView({ y, m: m - 1 });
                  setSelected(d);
                }}
              />
            ))
          )}
          {selected ? (
            <button className="ccal2-ev-link ccal2-back" onClick={() => setSelected(null)}>
              К ближайшим событиям <CcalArrow />
            </button>
          ) : (
            <div className="ccal2-hint">
              <CcalInfo />
              <span>Все события выбранного дня — по нажатию на дату.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Персонализация (заметки, виджет семьи) =====

// Имя ребёнка в родительном падеже: Тимофей → Тимофея, Арина → Арины, Соня → Сони, Кирилл → Кирилла
export function ruGenitive(name) {
  const n = (name || "").trim();
  if (!n) return n;
  const low = n.toLowerCase();
  if (low.endsWith("й") || low.endsWith("ь")) return n.slice(0, -1) + "я";
  if (low.endsWith("а")) {
    const prev = low[low.length - 2] || "";
    return n.slice(0, -1) + ("гкхжчшщ".includes(prev) ? "и" : "ы");
  }
  if (low.endsWith("я")) return n.slice(0, -1) + "и";
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(low)) return n + "а";
  return n;
}

// Имя ребёнка из записи «Фамилия Имя»
function childFirstName(child) {
  const parts = (child || "").trim().split(/\s+/);
  return parts[1] || parts[0] || "";
}

// Сегодняшняя дата по Минску в формате ГГГГ-ММ-ДД (для сравнения с датами напоминаний)
function minskIso() {
  const d = minskNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// «22 сентября» из ISO-даты напоминания
function fmtNoteDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== minskNow().getFullYear() ? ` ${y}` : ""}`;
}

// ===== Виджет «Ваша семья»: взнос, день рождения, голосования своего ребёнка =====
function FamilyWidget({ family, polls, bdays, onTab, liveGroups }) {
  const [fees, setFees] = useState(null);
  useEffect(() => {
    fetchFees().then((data) => { if (data) setFees(data); });
  }, []);
  // У семьи-близнецов в классе двое детей — считаем по всем их строкам ведомости
  const myNs = familyNs(family.n);
  // Внесено и остаток своей семьи: та же авто-ведомость, что на вкладке «Взносы»
  let paid = null, rest = null, target = 0;
  const src = fees || fallbackFeeData();
  const { columns, rows } = applyAutoFees(src.columns, src.rows, liveGroups);
  const myRows = rows.filter((r) => myNs.includes(r.n));
  myRows.forEach((row) => {
    if (paid === null) { paid = 0; rest = 0; }
    columns.forEach((c) => {
      const v = row.values[c.id] || 0;
      if (c.kind === "paid") { paid += v; rest += v; } else rest -= v;
    });
    // Норма взноса: 200 BYN у ходящих в ГПД (175 + 25 в фонд), 175 — у не ходящих
    // (признак row.gpdIn ставит applyAutoFees — не зависит от размера доли ГПД)
    target += row.gpdIn === false ? 175 : 200;
  });
  if (paid !== null) {
    paid = Math.round(paid * 100) / 100;
    rest = Math.round(rest * 100) / 100;
  } else {
    target = 200;
  }
  const due = paid === null ? null : Math.max(0, Math.round((target - paid) * 100) / 100);
  // Дни рождения детей семьи (у близнецов — оба)
  const kids = (bdays || []).filter((k) => myNs.includes(k.id));
  // Голосования, где семья ещё не ответила
  const noAnswer = (polls || []).filter(
    (p) => pollState(p) === "open" && !(p.votes || []).some((v) => myNs.includes(v.family_n))
  );
  // «Личная сводка семьи Тимофея» / для близнецов «…Давида и Ульяны»
  const group = familyGroup(family.n);
  const firstNames = group
    ? group.ns.map((n) => childFirstName(FAMILIES.find((f) => f.n === n)?.child))
    : [childFirstName(family.child)];
  const namesGen = firstNames.map(ruGenitive).join(" и ");
  return (
    <div className="card fam-widget reveal d2">
      <div className="dash-card-head">
        <img src="/icons/icon-people.webp" className="head-3d" alt="" />
        <div className="dash-card-titles">
          <h2 className="sec-title">Ваша семья · {family.child}</h2>
          <div className="dash-card-sub">Личная сводка семьи {namesGen}</div>
        </div>
      </div>
      <div className="fam-rows">
        {paid !== null && (
          <button className="fam-row" onClick={() => onTab("fees")}>
            <span className="fam-row-ico" aria-hidden="true">💰</span>
            <span className="fam-row-body">
              <b>Взносы: внесено {fmt(paid)} из {fmt(target)} BYN</b>
              <span className="fam-row-sub">
                {due > 0 ? `Осталось сдать ${fmt(due)} BYN` : "Годовой взнос сдан полностью — спасибо!"}
                {rest !== null ? ` · остаток после списаний: ${fmt(rest)} BYN` : ""}
              </span>
            </span>
            <span className="fam-row-arrow" aria-hidden="true">›</span>
          </button>
        )}
        {kids.map((kid) => {
          const bd = bdInfo(kid.born);
          if (!bd) return null;
          return (
            <button className="fam-row" key={kid.id} onClick={() => onTab("class")}>
              <span className="fam-row-ico" aria-hidden="true">🎂</span>
              <span className="fam-row-body">
                <b>День рождения {ruGenitive(kid.first || childFirstName(family.child))} — {fmtBd(kid.born)}</b>
                <span className="fam-row-sub">
                  {bd.days === 0 ? `Сегодня исполняется ${bd.turns} — поздравляем!` : `Исполнится ${bd.turns} — ${inDaysWord(bd.days)}`}
                </span>
              </span>
              <span className="fam-row-arrow" aria-hidden="true">›</span>
            </button>
          );
        })}
        <button className="fam-row" onClick={() => onTab("votes")}>
          <span className="fam-row-ico" aria-hidden="true">🗳️</span>
          <span className="fam-row-body">
            <b>{noAnswer.length ? `Голосования без вашего ответа: ${noAnswer.length}` : "Во всех голосованиях вы уже ответили"}</b>
            <span className="fam-row-sub">{noAnswer.length ? "Комитету важно мнение каждой семьи" : "Новые голосования появятся здесь"}</span>
          </span>
          <span className="fam-row-arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}

// ===== Привязка семьи для комитета и учителя: один раз выбрать своего ребёнка =====
function BindFamilyCard({ setFamily, toast }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("rk1g-no-child") === "1"; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <>
      <div className="attn-card reveal d2">
        <div className="attn-ico blue"><Ic id="i-spark" /></div>
        <div className="attn-body">
          <div className="attn-title">Настройте личную сводку</div>
          <div className="attn-sub">Укажите своего ребёнка — на главной появятся ваши взносы, заметки и напоминания.</div>
        </div>
        <div className="bind-actions">
          <button className="pill-btn blue" onClick={() => setOpen(true)}>Выбрать ребёнка</button>
          <button className="pill-btn" onClick={() => {
            try { localStorage.setItem("rk1g-no-child", "1"); } catch {}
            setHidden(true);
          }}>У меня нет ребёнка в классе</button>
        </div>
      </div>
      <FamilyPicker
        open={open}
        onClose={() => setOpen(false)}
        title="Кто ваш ребёнок?"
        onPick={(f) => {
          setOpen(false);
          setFamily(f);
          toast(`Готово! Личная сводка настроена: ${f.child}`);
        }}
      />
    </>
  );
}

// Порядок заметок: просроченные и сегодняшние → будущие по дате → без даты → выполненные внизу
function sortNotes(notes, todayIso) {
  const rank = (n) => {
    if (n.done) return 4;
    if (n.remind_date && n.remind_date <= todayIso) return 0;
    if (n.remind_date) return 1;
    return 2;
  };
  return [...notes].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.remind_date && b.remind_date && a.remind_date !== b.remind_date) return a.remind_date < b.remind_date ? -1 : 1;
    return (a.created_at || "") < (b.created_at || "") ? 1 : -1;
  });
}

// ===== Блок «Мои заметки»: личные заметки и напоминания семьи =====
function NotesWidget({ family, notes, onReload, toast }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const todayIso = minskIso();
  // Заметки от учителя живут в отдельной карточке «От учителя» — здесь их не дублируем
  const list = sortNotes((notes || []).filter((n) => !n.from_teacher), todayIso);
  const add = async () => {
    const t = text.trim();
    if (!t) { toast("Напишите текст заметки"); return; }
    setSaving(true);
    try {
      await addFamilyNote({ family_n: family.n, text: t, remind_date: date || null });
      setText(""); setDate("");
      onReload();
      toast(date ? "Напоминание добавлено" : "Заметка добавлена");
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };
  const toggle = async (n) => {
    try { await toggleFamilyNote(n.id, !n.done); onReload(); } catch (e) { console.error(e); toast("Не получилось отметить"); }
  };
  const del = async (n) => {
    try { await deleteFamilyNote(n.id); onReload(); toast("Заметка удалена"); } catch (e) { console.error(e); toast("Не получилось удалить"); }
  };
  return (
    <div className="card notes-widget reveal d2">
      <div className="dash-card-head">
        <img src="/icons/icon-book.webp" className="head-3d" alt="" />
        <div className="dash-card-titles">
          <h2 className="sec-title">Мои заметки и напоминания</h2>
          <div className="dash-card-sub">Видны только вашей семье · выполненные удаляются через 7 дней</div>
        </div>
      </div>
      <div className="note-form">
        <input
          className="note-input"
          type="text"
          placeholder="Например: сдать 50 BYN до пятницы"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <input
          className="note-date"
          type="date"
          value={date}
          min={todayIso}
          aria-label="Дата напоминания (необязательно)"
          onChange={(e) => setDate(e.target.value)}
        />
        <button className="pill-btn blue" onClick={add} disabled={saving}>{saving ? "Сохраняю…" : "Добавить"}</button>
      </div>
      {list.length === 0 && (
        <div className="muted" style={{ fontSize: 13, padding: "6px 2px" }}>
          Пока пусто. Добавьте заметку — а если указать дату, в этот день на «Главной» появится напоминание.
        </div>
      )}
      {list.map((n) => {
        const overdue = !n.done && n.remind_date && n.remind_date < todayIso;
        const today = !n.done && n.remind_date === todayIso;
        return (
          <div className={"note-row" + (n.done ? " done" : "") + (overdue || today ? " due" : "")} key={n.id}>
            <label className="note-check">
              <input type="checkbox" checked={n.done} onChange={() => toggle(n)} aria-label="Выполнено" />
            </label>
            <div className="note-body">
              <div className="note-text">{n.text}</div>
              <div className="note-meta">
                {n.from_committee && <span className="note-tag">от комитета{n.author ? ` · ${n.author}` : ""}</span>}
                {n.remind_date && (
                  <span className={"note-when" + (overdue ? " overdue" : today ? " today" : "")}>
                    {overdue ? `просрочено · ${fmtNoteDate(n.remind_date)}` : today ? "сегодня!" : fmtNoteDate(n.remind_date)}
                  </span>
                )}
              </div>
            </div>
            <button className="note-del" onClick={() => del(n)} aria-label="Удалить заметку" title="Удалить">✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ===== Кнопка комитета «Напомнить семье»: персональное напоминание конкретной семье =====
function CommitteeRemind({ authorName, toast }) {
  const [pickOpen, setPickOpen] = useState(false);
  const [target, setTarget] = useState(null); // {n, child}
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const todayIso = minskIso();
  const send = async () => {
    const t = text.trim();
    if (!target) return;
    if (!t) { toast("Напишите текст напоминания"); return; }
    setSaving(true);
    try {
      await addFamilyNote({
        family_n: target.n, text: t, remind_date: date || null,
        from_committee: true, author: authorName || "Комитет",
      });
      toast(`Напоминание отправлено семье: ${target.child}`);
      setTarget(null); setText(""); setDate("");
    } catch (e) {
      console.error(e);
      toast("Не получилось отправить — попробуйте ещё раз");
    }
    setSaving(false);
  };
  return (
    <div className="card remind-card reveal d2">
      <div className="dash-card-head">
        <img src="/icons/icon-calendar.webp" className="head-3d" alt="" />
        <div className="dash-card-titles">
          <h2 className="sec-title">Напомнить семье</h2>
          <div className="dash-card-sub">Персональное напоминание появится у семьи на «Главной» с пометкой «от комитета»</div>
        </div>
        {!target && <button className="pill-btn blue" onClick={() => setPickOpen(true)}>Выбрать семью</button>}
      </div>
      {target && (
        <div className="note-form remind-form">
          <div className="remind-target">
            Семья: <b>{target.child}</b>
            <button className="pill-btn" onClick={() => setPickOpen(true)}>Сменить</button>
          </div>
          <input
            className="note-input"
            type="text"
            placeholder="Например: пожалуйста, сдайте 50 BYN до пятницы"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <input
            className="note-date"
            type="date"
            value={date}
            min={todayIso}
            aria-label="Дата напоминания (необязательно)"
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="pill-btn blue" onClick={send} disabled={saving}>{saving ? "Отправляю…" : "Отправить"}</button>
        </div>
      )}
      <FamilyPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Какой семье напомнить?"
        onPick={(f) => { setTarget(f); setPickOpen(false); }}
      />
    </div>
  );
}

// ===== Сетка быстрых действий на самом верху главной =====
// Крупные иконки-ярлыки «как на телефоне»: 4 в ряд, с бейджами-счётчиками.
// Личные действия (учитель, отсутствие, сводка) открываются в окошке поверх
// главной; разделы (взносы, голосования, объявления, расписание) — переходом
// на свою вкладку, потому что это полноценные страницы, а не карточки.
function QuickActions({ items, wide }) {
  return (
    <div className="qa-grid reveal d1">
      {items.map((it) => (
        <button className="qa-item" key={it.key} onClick={it.act} aria-label={it.aria || it.label}>
          <span className="qa-ico" aria-hidden="true">{it.ico}</span>
          {it.badge > 0 && <span className="qa-badge">{it.badge > 99 ? "99+" : it.badge}</span>}
          <span className="qa-label">{it.label}</span>
        </button>
      ))}
      {/* Широкая кнопка под сеткой 3×3 — отдельной строкой (ТЗ §9) */}
      {wide && (
        <button className="qa-item qa-wide" onClick={wide.act} aria-label={wide.aria || wide.label}>
          <span className="qa-ico" aria-hidden="true">{wide.ico}</span>
          <span className="qa-label">{wide.label}</span>
        </button>
      )}
    </div>
  );
}

// Окошко поверх главной с содержимым карточки (отсутствия, сводка семьи).
// Доступность: Escape закрывает, фокус не уходит за пределы окна (Tab по кругу),
// после закрытия фокус возвращается туда, откуда окно открыли.
function QuickModal({ open, onClose, children, label }) {
  const boxRef = useRef(null);
  const lastFocus = useRef(null);
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !boxRef.current) return;
      const els = boxRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    boxRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (lastFocus.current?.focus) lastFocus.current.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay qa-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal qa-modal" role="dialog" aria-modal="true" aria-label={label} ref={boxRef} tabIndex={-1}>
        <button className="qa-modal-close" onClick={onClose} aria-label="Закрыть">✕</button>
        {children}
      </div>
    </div>
  );
}

export default function DashboardTab({ committee, role, toast, onTab, onOpenUpload, liveGroups, liveSchedule, liveBirthdays, overrides, mascotRef, greetToken, authorName, announcements, polls, reads, family, setFamily, notes, onReloadNotes, homework, events, postComments, chatClosed, onReloadComments, familyMessages, onReloadMessages }) {
  // Выбор семьи по требованию (когда пишут в обсуждение, не выбрав семью)
  const [famOpen, setFamOpen] = useState(false);
  // Окошки быстрых действий: чат с учителем, отсутствия, сводка семьи
  const [chatOpen, setChatOpen] = useState(false);
  const [absOpen, setAbsOpen] = useState(false);
  const [famSumOpen, setFamSumOpen] = useState(false);
  // Персональное приветствие: у комитета/учителя — имя из базы; у семьи — по ребёнку («семья Тимофея»)
  const greetName = authorName
    ? `, ${authorName}`
    : family
      ? `, семья ${(familyGroup(family.n)
          ? familyGroup(family.n).ns.map((n) => ruGenitive(childFirstName(FAMILIES.find((f) => f.n === n)?.child))).join(" и ")
          : ruGenitive(childFirstName(family.child)))}`
      : "";
  // Разовые поступления сверх ведомости (целевые сборы на главной не учитываем)
  const [extras, setExtras] = useState(null);
  useEffect(() => {
    fetchCashExtras().then((data) => {
      if (data) setExtras(data);
    });
  }, []);
  // Касса класса = остаток по ведомости взносов + разовые поступления (без ГПД).
  // Ведомость строится так же, как на вкладке «Взносы»: авто-статьи
  // пересчитываются из раздела «Расходы» (гардероб входит в хознужды),
  // статья «ГПД» всегда 0 — траты ГПД оплачиваются из отдельного фонда ГПД
  // и классную кассу не уменьшают.
  const [feesData, setFeesData] = useState(null);
  useEffect(() => {
    fetchFees().then((data) => { if (data) setFeesData(data); });
  }, []);
  // Целевые сборы (экскурсии и т.п.): напоминание «вы ещё не сдали» своей семье
  const [feeColls, setFeeColls] = useState(null);
  useEffect(() => {
    fetchFeeCampaigns().then((data) => { if (data) setFeeColls(data); });
  }, []);
  // Реквизиты для перевода (карта/телефон/банк) — показываем в напоминании о сборе
  const [payReqs, setPayReqs] = useState(null);
  useEffect(() => {
    fetchPaymentRequisites().then(setPayReqs);
  }, []);
  const reqsLine = payReqs && (payReqs.card_number || payReqs.phone)
    ? "Для перевода" + (payReqs.bank ? ` (${payReqs.bank})` : "") +
      (payReqs.card_number ? `: карта ${payReqs.card_number}` : "") +
      (payReqs.phone ? `${payReqs.card_number ? " ·" : ":"} тел. ${payReqs.phone}` : "")
    : null;
  const feeSrc = feesData || fallbackFeeData();
  const feeCalc = applyAutoFees(feeSrc.columns, feeSrc.rows, liveGroups);
  const feesRest = Math.round(feeCalc.rows.reduce((s, r) => {
    let rest = 0;
    feeCalc.columns.forEach((c) => {
      const v = r.values[c.id] || 0;
      rest += c.kind === "paid" ? v : -v;
    });
    return s + rest;
  }, 0) * 100) / 100;
  // Остаток только главного сбора: ведомость + разовые поступления (без целевых сборов),
  // минус взносы фонда ГПД, сданные детьми класса внутри классного сбора (gpdOwn) —
  // эти деньги принадлежат фонду ГПД и в кассе класса не остаются.
  const cashMain = Math.round((feesRest + (extras?.oneOff || 0) - (extras?.gpdOwn || 0)) * 100) / 100;
  // Долги своей семьи по целевым сборам: сумма — с семьи, близнецы сдают один раз
  const myCollDues = (() => {
    if (!family || !Array.isArray(feeColls) || !feeColls.length) return [];
    const ns = familyNs(family.n);
    const kids = feeCalc.rows.filter((r) => ns.includes(r.n)).map((r) => r.child);
    return feeColls
      .filter((c) => c.status !== "closed")
      .map((c) => {
        const parts = Array.isArray(c.participants) && c.participants.length ? c.participants : null;
        if (parts && !ns.some((n) => parts.includes(n))) return null; // семья не участвует
        const paid = (c.payments || []).filter((p) => kids.includes(p.child)).reduce((s, p) => s + p.amount, 0);
        const due = Math.round((Number(c.amount) - paid) * 100) / 100;
        // Заявка семьи «на проверке» (чек или наличные) — показываем статус вместо «не сдали»
        const pending = (c.claims || []).find((cl) => cl.status === "pending" && kids.includes(cl.child));
        return due > 0.005 ? { title: c.title, due, paid, deadline: c.deadline, pending: pending ? pending.method : null } : null;
      })
      .filter(Boolean);
  })();
  // Долг своей семьи по главному (годовому) сбору: «сдал» = отметка комитета
  // в ведомости (загруженный чек сам по себе не считается). Норма с ребёнка:
  // 200 BYN у ходящих в ГПД, 175 — у не ходящих; близнецы — по каждой строке.
  const myFeeDue = (() => {
    if (!family) return null;
    const ns = familyNs(family.n);
    const myRows = feeCalc.rows.filter((r) => ns.includes(r.n));
    if (!myRows.length) return null;
    let paid = 0, target = 0;
    myRows.forEach((row) => {
      feeCalc.columns.forEach((c) => { if (c.kind === "paid") paid += row.values[c.id] || 0; });
      target += row.gpdIn === false ? 175 : 200;
    });
    paid = Math.round(paid * 100) / 100;
    const due = Math.round((target - paid) * 100) / 100;
    return due > 0.005 ? { due, paid, target } : null;
  })();
  const bdays = liveBirthdays || BIRTHDAYS_FALLBACK;
  const bdayEv = birthdayEvents(bdays, committee);
  // Изменение расписания на день из мини-виджета — баннер сверху
  const schedFocus = scheduleFocus();
  const schedBells = liveSchedule?.bells?.length ? liveSchedule.bells : BELLS_FALLBACK;
  const schedAll = liveSchedule?.lessons?.length ? liveSchedule.lessons : LESSONS_FALLBACK;
  const schedIso = weekDates()[schedFocus.day];
  const schedOvs = activeOverridesFor(overrides, schedIso);
  const focusLessons = applyOverridesToDay(schedAll, schedFocus.day, schedOvs).lessons;
  const schedEnd = schedOvs.length ? dayEndTime(focusLessons, schedBells) : null;
  // Состояния для приветствия и блоков (ТЗ §4, §7, §8):
  // важное непрочитанное → голосование без ответа → вещи с собой → ДР сегодня → изменения → нейтральная
  const impUnread = (announcements || []).filter(
    (a) => a.status === "active" && a.important && !isReadBy(a, reads, family)
  );
  // Без выбранной семьи (комитет/учитель) «неотвеченных» голосований не считаем —
  // иначе любой открытый опрос показывал бы им «нужно ваше мнение»
  const pollsNoAnswer = family
    ? (polls || []).filter(
        (p) => pollState(p) === "open" && !(p.votes || []).some((v) => familyNs(family.n).includes(v.family_n))
      )
    : [];
  const eventsCount =
    (impUnread.length ? 1 : 0) + (pollsNoAnswer.length ? 1 : 0) +
    (bdayEv.today.length ? 1 : 0) + (schedOvs.length ? 1 : 0);
  const focusNotes = [...new Set(focusLessons.map((l) => l.note).filter(Boolean))];
  let headline, subline;
  if (eventsCount >= 2) {
    headline = "Всё важное для родителей в одном месте";
    subline = "Сегодня несколько событий: посмотрите блоки ниже — там объявления, голосования и напоминания.";
  } else if (impUnread.length) {
    headline = "Есть важная информация для родителей";
    subline = "Есть новое объявление — посмотрите ниже.";
  } else if (pollsNoAnswer.length) {
    headline = "Нужно ваше мнение в голосовании";
    subline = "Идёт голосование, где ваша семья ещё не ответила, — карточка ниже ведёт прямо к нему.";
  } else if (focusNotes.length) {
    headline = schedFocus.label === "сегодня" ? "Сегодня есть что взять с собой" : "На завтра нужно собрать вещи";
    subline = `${schedFocus.label === "сегодня" ? "Сегодня" : "Завтра"} пригодится: ${focusNotes.join(", ").toLowerCase()}. Подробности — в расписании ниже.`;
  } else if (bdayEv.today.length) {
    headline = "Сегодня в классе праздник!";
    subline = `День рождения у ${joinNames(bdayEv.today, false)} — не забудьте поздравить.`;
  } else if (schedOvs.length) {
    headline = "В расписании есть изменения";
    subline = `Проверьте уроки ${schedFocus.label} — подробности в баннере выше и в расписании.`;
  } else {
    // Нейтральное состояние (ТЗ §7): спокойная подпись без выдуманных событий
    headline = "Всё важное — под рукой";
    subline = "Все важные дела выполнены. Ниже — календарь, расписание и новости класса.";
  }
  // Реплики облачков маскота (ТЗ §6): только реальные события, по приоритету.
  // Несколько событий — реплики чередуются, первой идёт самая важная.
  const scrollHome = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const cues = [];
  if (impUnread.length) cues.push({
    top: "Есть новости!",
    text: "Важное объявление! Посмотрите ниже ↓",
    action: () => scrollHome("home-imp-" + impUnread[0].id),
  });
  if (pollsNoAnswer.length) cues.push({
    top: "Решаем вместе!",
    text: "Нужно ваше мнение. Загляните в голосование",
    action: () => goFocus("poll", pollsNoAnswer[0].id, "votes", onTab),
  });
  if (focusNotes.length) cues.push({
    top: schedFocus.label === "сегодня" ? "Я рядом!" : "Готовимся к завтра!",
    text: `${schedFocus.label === "сегодня" ? "Сегодня" : "Завтра"} пригодятся: ${focusNotes.join(", ").toLowerCase()}`,
    action: () => scrollHome("home-schedule"),
  });
  if (bdayEv.today.length) cues.push({
    top: "Есть новости!",
    text: `Сегодня день рождения у ${joinNames(bdayEv.today, false)}!`,
  });
  if (!cues.length) cues.push({
    top: "Всё под контролем",
    text: "Всё важное — под рукой!",
  });
  // ===== Данные для сетки быстрых действий =====
  // Имя учителя — из справочника класса (STAFF). Раньше оно угадывалось
  // по автору ближайшей записи, и если первой попадалась запись комитета,
  // над чатом с учителем красовалось «Комитет» (баг со скриншота 23.10.2026).
  const teacherName =
    STAFF.find((s) => /классн/i.test(s.role || ""))?.name || null;
  // Непрочитанные семьёй сообщения от учителя — бейдж на иконке «Учителю»
  const qaNs = family ? familyNs(family.n) : [];
  const teacherUnread = family
    ? (familyMessages || []).filter((m) => qaNs.includes(m.family_n) && m.from_teacher && !m.read_family).length
    : 0;
  // Непрочитанные объявления (только при выбранной семье — иначе считать не от кого)
  const annUnread = family
    ? (announcements || []).filter((a) => a.status === "active" && !isReadBy(a, reads, family)).length
    : 0;
  // Долги семьи: годовой взнос (1, если не сдан) + целевые сборы без заявки на проверке
  const feesBadge = (myFeeDue ? 1 : 0) + myCollDues.filter((d) => !d.pending).length;
  // Открыть чат/отсутствия/сводку: без выбранной семьи сначала просим выбрать её
  const needFamily = (fn) => () => { if (!family) { setFamOpen(true); return; } fn(); };
  const quickItems = [
    { key: "teacher", label: "Учителю", aria: "Написать учителю",
      ico: <img src="/icons/icon-envelope.webp" alt="" />,
      badge: teacherUnread, act: needFamily(() => setChatOpen(true)) },
    { key: "absence", label: "Отсутствие", aria: "Отметить отсутствие ребёнка",
      ico: <img src="/icons/icon-calendar.webp" alt="" />,
      badge: 0, act: needFamily(() => setAbsOpen(true)) },
    { key: "family", label: "Моя семья", aria: "Сводка семьи",
      ico: <img src="/icons/icon-people.webp" alt="" />,
      badge: 0, act: needFamily(() => setFamSumOpen(true)) },
    // «Фото» заняли место «Взносов»: до денег всё равно ведут «Платёж» и верхнее меню
    { key: "photos", label: "Фото", aria: "Фото класса",
      ico: <NavIcon name="photos" uid="qa-photos" size={38} />,
      badge: 0, act: () => onTab("photos") },
    { key: "votes", label: "Голосования",
      ico: <NavIcon name="votes" uid="qa-votes" size={38} />,
      badge: pollsNoAnswer.length, act: () => onTab("votes") },
    { key: "ann", label: "Объявления",
      ico: <NavIcon name="announcements" uid="qa-ann" size={38} />,
      badge: annUnread, act: () => onTab("announcements") },
    { key: "sched", label: "Расписание",
      ico: <img src="/icons/icon-calendar-clock.webp" alt="" />,
      badge: schedOvs.length, act: () => onTab("schedule") },
    // «Календарь» прокручивает к встроенному календарю класса и переводит фокус
    // к его заголовку (ТЗ §9). Иконка — календарь, а не хлопушка.
    { key: "calendar", label: "Календарь", aria: "Календарь класса",
      ico: <img src="/icons/icon-calendar.webp" alt="" />,
      badge: 0, act: () => {
        const el = document.getElementById("class-calendar-title");
        // При prefers-reduced-motion прокручиваем без анимации
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        el?.focus({ preventScroll: true });
      } },
    { key: "pay", label: "Платёж", aria: "Отметить платёж",
      ico: <img src="/icons/icon-wallet.webp" alt="" />,
      badge: 0, act: () => onTab("fees") },
  ];
  // «Создать объявление» — отдельной широкой строкой под сеткой, только комитету
  const quickWide = committee
    ? { key: "newann", label: "Создать объявление", aria: "Создать объявление",
        ico: <img src="/icons/icon-note-plus.webp" alt="" />,
        act: () => {
          try { sessionStorage.setItem("rk1g-open-newann", "1"); } catch {}
          onTab("announcements");
        } }
    : null;
  // Строка-подсказка с самым срочным: ответ учителя → долг → голосование
  let urgent = null;
  if (teacherUnread > 0) {
    urgent = {
      text: teacherUnread === 1 ? "Ответ учителя не прочитан" : `Непрочитанных сообщений от учителя: ${teacherUnread}`,
      act: needFamily(() => setChatOpen(true)),
    };
  } else if (myFeeDue) {
    urgent = { text: `Долг по годовому взносу: ${fmt(myFeeDue.due)} BYN`, act: () => onTab("fees") };
  } else {
    const firstDue = myCollDues.find((d) => !d.pending);
    if (firstDue) {
      urgent = { text: `Долг по сбору «${firstDue.title}»: ${fmt(firstDue.due)} BYN`, act: () => onTab("fees") };
    } else if (pollsNoAnswer.length) {
      urgent = {
        text: `Новое голосование: ${snippet(pollsNoAnswer[0].question, 60)}`,
        act: () => goFocus("poll", pollsNoAnswer[0].id, "votes", onTab),
      };
    }
  }
  return (
    <section id="tab-dashboard">
      <div className="greet-date">{todayLine()}</div>

      {/* Шапка главной: на широких экранах — приветствие слева, быстрые действия
          справа в своей панели; на телефоне — друг под другом */}
      <div className="home-hero">
        <div className="welcome compact reveal d1">
          <div className="welcome-copy">
            {/* Приветствие и главная мысль дня — двумя абзацами, с воздухом между ними */}
            <h1 className="welcome-h1">
              <span className="welcome-greet">{greetWord()}{greetName}!</span>
              <span className="blue welcome-headline">{headline}</span>
            </h1>
            <p className="welcome-sub">{subline}</p>
          </div>
          <div className="welcome-visual">
            <ClassMascot ref={mascotRef} cues={cues} greetToken={greetToken} />
          </div>
        </div>
        <div className="qa-panel reveal d1">
          <QuickActions items={quickItems} wide={quickWide} />
        </div>
      </div>
      {urgent && (
        <button className="qa-urgent reveal d1" onClick={urgent.act}>
          <span className="qa-urgent-ico" aria-hidden="true">❗</span>
          <span>{urgent.text}</span>
          <span className="qa-urgent-arrow" aria-hidden="true">›</span>
        </button>
      )}

      {/* Плашка-напоминание про уведомления: висит каждый заход, пока
          родитель их не включит (модалку PushNag можно закрыть — эту нет) */}
      {role !== "teacher" && <PushBanner role={role} familyN={family?.n} toast={toast} />}

      {/* Порядок секций — как на новом макете: сначала «Важное от учителя»,
          затем объявления класса и баннеры, а финансовые напоминания — после них. */}
      <TeacherBoard
        homework={homework}
        events={events}
        notes={notes}
        onReloadNotes={onReloadNotes}
        toast={toast}
        onTab={onTab}
        postComments={postComments}
        chatClosed={chatClosed}
        family={family}
        onNeedFamily={() => setFamOpen(true)}
        onReloadComments={onReloadComments}
      />

      {/* Переписка с учителем — в новом дизайне мини-мессенджера (23.10.2026):
          последнее сообщение, счётчик непрочитанных, кнопка «Написать учителю».
          Без выбранной семьи клик сначала попросит выбрать её. */}
      {role !== "teacher" && (
        <ParentTeacherCard
          familyMessages={familyMessages}
          family={family}
          teacherName={teacherName}
          onOpenChat={needFamily(() => setChatOpen(true))}
          onRetry={onReloadMessages}
        />
      )}

      <ImportantNews announcements={announcements} reads={reads} family={family} onTab={onTab} />
      {/* Новости класса — высоко на главной (просьба 28.10.2026), чтобы
          родители сразу видели свежие объявления, не листая вниз */}
      <DashNews announcements={announcements} reads={reads} family={family} onTab={onTab} />
      <BdayBanner ev={bdayEv} />
      <ScheduleChangeBanner
        activeOvs={schedOvs}
        focusIso={schedIso}
        focusLabel={schedFocus.label}
        endTime={schedEnd}
        toast={toast}
        onTab={onTab}
      />

      {/* Яркое напоминание о годовом взносе: видно только семье, которая ещё не сдала.
          «Сдал» = отметка комитета в ведомости (загруженный чек сам по себе не считается). */}
      {myFeeDue && (
        <div className="attn-card pay-due-card reveal d1">
          <div className="attn-ico"><Ic id="i-coin" /></div>
          <div className="attn-body">
            <div className="attn-title">Пожалуйста, сдайте годовой взнос — осталось {fmt(myFeeDue.due)} BYN</div>
            <div className="attn-sub">
              Внесено {fmt(myFeeDue.paid)} из {fmt(myFeeDue.target)} BYN с семьи
              {reqsLine ? <><br />{reqsLine}</> : null}
            </div>
          </div>
          <button className="pill-btn" onClick={() => onTab("fees")}>К взносам</button>
        </div>
      )}

      {/* Напоминание о целевых сборах: висит, пока семья не сдаст полную сумму.
          Пока заявка семьи на проверке — плашка спокойная, не тревожная. */}
      {myCollDues.map((d) => (
        <div key={d.title} className={"attn-card reveal d1" + (d.pending ? "" : " pay-due-card")}>
          <div className={"attn-ico" + (d.pending ? " blue" : "")}><Ic id="i-coin" /></div>
          <div className="attn-body">
            <div className="attn-title">
              {d.pending ? `Заявка по сбору «${d.title}» на проверке` : `Вы ещё не сдали на «${d.title}»`}
            </div>
            <div className="attn-sub">
              {d.pending
                ? d.pending === "cash"
                  ? "Вы передадите наличными — комитет отметит платёж, когда получит деньги"
                  : "Ваш чек на проверке — комитет подтвердит платёж"
                : <>
                    {d.paid > 0 ? `Сдано ${fmt(d.paid)} BYN, осталось ${fmt(d.due)} BYN` : `Нужно сдать ${fmt(d.due)} BYN с семьи`}
                    {d.deadline ? ` · сдать до ${fmtDateRu(d.deadline)}` : ""}
                    {reqsLine ? <><br />{reqsLine}</> : null}
                  </>}
            </div>
          </div>
          <button className="pill-btn blue" onClick={() => onTab("fees")}>К сборам</button>
        </div>
      ))}

      <ActivePolls polls={polls} family={family} onTab={onTab} />

      {/* Встроенный календарь класса: события, праздники, дни рождения
          и личные напоминания семьи — к нему ведёт плитка «Календарь» */}
      <ClassCalendar
        committee={committee} role={role} events={events} notes={notes}
        bdays={bdays} family={family} authorName={authorName} toast={toast} onTab={onTab}
      />

      {/* Личная переписка семьи с учителем — открывается с иконки «Учителю».
          Отдельной карточки на главной больше нет: её заменила сетка сверху. */}
      {role !== "teacher" && (
        <TeacherFamilyChat
          open={chatOpen}
          familyN={family?.n}
          familyChild={family?.child}
          messages={familyMessages}
          teacherName={teacherName}
          side="parent"
          onSent={onReloadMessages}
          onClose={() => setChatOpen(false)}
          toast={toast}
        />
      )}
      <FamilyPicker
        open={famOpen}
        onClose={() => setFamOpen(false)}
        title="Выберите свою семью"
        onPick={(f) => setFamily(f)}
      />

      {/* Отсутствия и сводка семьи — в окошках поверх главной (иконки сверху).
          Другие родители чужих отсутствий по-прежнему не видят. */}
      <QuickModal open={absOpen && !!family} onClose={() => setAbsOpen(false)} label="Отсутствие ребёнка">
        {family && <AbsenceCard family={family} toast={toast} />}
      </QuickModal>
      <QuickModal open={famSumOpen && !!family} onClose={() => setFamSumOpen(false)} label="Сводка семьи">
        {family && (
          <FamilyWidget
            family={family} polls={polls} bdays={bdays} liveGroups={liveGroups}
            onTab={(t) => { setFamSumOpen(false); onTab(t); }}
          />
        )}
      </QuickModal>
      {/* Привязка семьи — только для комитета: у учителя «Главной» больше нет,
          да и своей семьи в списке класса у него не бывает */}
      {!family && committee && <BindFamilyCard setFamily={setFamily} toast={toast} />}
      {family && <NotesWidget family={family} notes={notes} onReload={onReloadNotes} toast={toast} />}
      {committee && <CommitteeRemind authorName={authorName} toast={toast} />}

      <div className="dash-cols">
        <div className="dash-col-main" id="home-schedule">
          <ScheduleWidget liveSchedule={liveSchedule} overrides={overrides} onTab={onTab} />
        </div>
        <div className="dash-col-side">
          {/* Новости класса переехали выше — к важным объявлениям (28.10.2026) */}
          <div className="card cash-card reveal d3">
            <div className="dash-card-head">
              <img src="/icons/icon-piggy.webp" className="head-3d" alt="" />
              <div className="dash-card-titles">
                <h2 className="sec-title">Касса класса</h2>
                <div className="dash-card-sub">Главный сбор · {FAMILIES_COUNT} семей</div>
              </div>
            </div>

            {/* Остаток только по главному сбору: ведомость + разовые поступления.
                Целевые сборы и фонд ГПД на главной не показываем — они во вкладке «Взносы» */}
            <div className="cash-hero">
              <div className="cash-hero-main">
                <div className="cash-hero-lbl">Сейчас в кассе</div>
                <div className="cash-hero-val">{fmt(cashMain)} BYN</div>
                <div className="cash-hero-note">
                  {isLive && extras === null ? "поступления обновляются…" : "Главный сбор · без фонда ГПД и целевых сборов"}
                </div>
              </div>
              <img src="/icons/icon-wallet.webp" className="cash-hero-3d" alt="" />
            </div>

            <button className="pill-btn blue cash-open" onClick={() => onTab("fees")}>Подробнее →</button>
          </div>
        </div>
      </div>

      <BirthdaysWidget committee={committee} ev={bdayEv} list={bdays} onTab={onTab} />

      <HolidaysWidget committee={committee} role={role} events={events} authorName={authorName} toast={toast} onTab={onTab} />

      <PushSettings committee={committee} role={role} familyN={family?.n} toast={toast} />
    </section>
  );
}
