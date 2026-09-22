"use client";
import { Fragment, useEffect, useState } from "react";
import { fetchCashExtras, isLive } from "@/lib/supabase";
import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import {
  fmt, TOTAL_COLLECTED, TOTAL_SPENT, CASH_NOW, FAMILIES_COUNT, EXPENSE_GROUPS, groupTotal,
  GPD_FUND_REST,
} from "./data";
import { DAY_NAMES, BELLS_FALLBACK, LESSONS_FALLBACK, INFO_HOUR, scheduleFocus, subjectIcon, lessonDisplay } from "./scheduleData";
import { weekDates, activeOverridesFor, applyOverridesToDay, dayEndTime, fmtDateRu } from "./scheduleOverrides";
import { BIRTHDAYS_FALLBACK, BD_MONTHS_PREP, birthdayEvents, upcomingBirthdays, joinNames, fmtBd, bdName, inDaysWord } from "./birthdaysData";
import PushSettings from "./PushSettings";
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

// 3D-иконки предметов (как на референсе): штаны, смайлик, книга
function subject3d(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("введение")) return "/icons/icon-trousers.webp";
  if (s.includes("физ")) return "/icons/icon-smiley.webp";
  if (s.includes("логик")) return "/icons/icon-book.webp";
  return null;
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
  const subtitle = `${DAY_NAMES[focus.day]} · ${lessons.length} урок${lessons.length === 5 ? "ов" : "а"} · каб. 166`;
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
          const si3 = subject3d(l.subject);
          const ch = changed[l.pos];
          const disp = lessonDisplay(l.subject);
          return (
            <Fragment key={l.id}>
              <div className="dash-sched-row" style={ch ? { background: "var(--blue-soft)", borderRadius: 10 } : undefined}>
                <span className="dash-sched-time">{bell ? `${bell.start_time}–${bell.end_time}` : `${l.pos}-й`}</span>
                <span className="dash-sched-subj">
                  {si3 ? <img src={si3} className="les-3d" alt="" /> : <CIc id={si.id} tone={si.tone} size="sm" />} {disp.name}
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
        <div className="dash-sched-foot">
          <span className="muted" style={{ fontSize: 12 }}>Временное расписание · первые 20 учебных дней</span>
        </div>
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
  return !!(family && (reads || []).some((r) => r.announcement_id === a.id && r.family_n === family.n));
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
            <div className="imp-ico" aria-hidden="true">📣</div>
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
            <button className="pill-btn blue imp-btn" onClick={() => goFocus("ann", a.id, "announcements", onTab)}>
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
  const voted = (p) => !!(family && (p.votes || []).some((v) => v.family_n === family.n));
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

// ===== Обычные объявления внизу главной (ТЗ §11): без дублирования важных =====
function RegularNews({ announcements, onTab }) {
  const regular = (announcements || []).filter((a) => a.status === "active" && !a.important).slice(0, 3);
  if (!regular.length) return null;
  return (
    <>
      <div className="sec-head reveal d3">
        <span className="sec-dot blue"><Ic id="i-bell" /></span>
        <h2 className="sec-title">Объявления класса</h2>
      </div>
      {regular.map((a) => (
        <div className="card homenews-card reveal d3" key={a.id}>
          <div className="homenews-body">
            <div className="homenews-title">{a.pinned && <span title="Закреплено">📌 </span>}{a.title}</div>
            {a.body && <div className="homenews-sub">{snippet(a.body)}</div>}
            <div className="homenews-meta">{a.author || "Комитет"} · {fmtNewsDate(a.created_at)}</div>
          </div>
          <button className="pill-btn blue" onClick={() => goFocus("ann", a.id, "announcements", onTab)}>Читать</button>
        </div>
      ))}
      <button className="pill-btn news-all-link reveal d3" onClick={() => onTab("announcements")}>
        Все объявления →
      </button>
    </>
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

export default function DashboardTab({ committee, role, toast, onTab, onOpenUpload, liveGroups, liveSchedule, liveBirthdays, overrides, mascotRef, greetToken, authorName, announcements, polls, reads, family }) {
  // Персональное приветствие: имя берём из базы (user_roles.display_name); если имени нет — без имени
  const greetName = authorName ? `, ${authorName}` : "";
  // Живые итоги из базы: потрачено и остаток кассы пересчитываются автоматически
  const spent = liveGroups ? liveGroups.reduce((s, g) => s + groupTotal(g), 0) : TOTAL_SPENT;
  // Поступления сверх старого сбора: платежи по новым сборам + разовые поступления
  const [extras, setExtras] = useState(null);
  // Раскрытие «Как рассчитано» в синем блоке остатка
  const [howOpen, setHowOpen] = useState(false);
  useEffect(() => {
    fetchCashExtras().then((data) => {
      if (data) setExtras(data);
    });
  }, []);
  const extraIncome = extras ? extras.oneOff + extras.campaigns : 0;
  // Касса класса = остаток по ведомости взносов (CASH_NOW) + разовые поступления.
  // Не считаем через «собрано − потрачено»: в «потрачено» входят расходы фонда ГПД,
  // который собирается отдельно и классную кассу не уменьшает.
  const cash = Math.round((CASH_NOW + extraIncome) * 100) / 100;
  const groupsCount = (liveGroups || EXPENSE_GROUPS).length;
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
  const pollsNoAnswer = (polls || []).filter(
    (p) => pollState(p) === "open" && !(family && (p.votes || []).some((v) => v.family_n === family.n))
  );
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
    subline = "Комитет опубликовал важное объявление — карточка с ним сразу под приветствием.";
  } else if (pollsNoAnswer.length) {
    headline = "Нужно ваше мнение";
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
    headline = "Сейчас нет задач, требующих вашего действия";
    subline = "Всё важное собрано ниже: расписание, касса класса и дни рождения.";
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
    text: "Посмотрим, что завтра?",
  });
  return (
    <section id="tab-dashboard">
      <div className="greet-date">{todayLine()}</div>

      <BdayBanner ev={bdayEv} />

      <ScheduleChangeBanner activeOvs={schedOvs} focusIso={schedIso} focusLabel={schedFocus.label} endTime={schedEnd} toast={toast} onTab={onTab} />

      <div className="welcome compact reveal d1">
        <div className="welcome-copy">
          <h1 className="welcome-h1">
            {greetWord()}{greetName}!<br />
            <span className="blue">{headline}</span>
          </h1>
          <p className="welcome-sub">{subline}</p>
        </div>
        <div className="welcome-visual">
          <ClassMascot ref={mascotRef} cues={cues} greetToken={greetToken} />
        </div>
      </div>

      <ImportantNews announcements={announcements} reads={reads} family={family} onTab={onTab} />

      <ActivePolls polls={polls} family={family} onTab={onTab} />

      <div className="dash-cols">
        <div className="dash-col-main" id="home-schedule">
          <ScheduleWidget liveSchedule={liveSchedule} overrides={overrides} onTab={onTab} />
        </div>
        <div className="dash-col-side">
          <div className="card cash-card reveal d3">
            <div className="dash-card-head">
              <img src="/icons/icon-piggy.webp" className="head-3d" alt="" />
              <div className="dash-card-titles">
                <h2 className="sec-title">Деньги класса</h2>
                <div className="dash-card-sub">{groupsCount} групп расходов · {FAMILIES_COUNT} семей</div>
              </div>
            </div>

            {/* Синий блок остатка */}
            <div className="cash-hero">
              <div className="cash-hero-main">
                <div className="cash-hero-lbl">Сейчас в кассе</div>
                <div className="cash-hero-val">{fmt(cash)} BYN</div>
                <div className="cash-hero-note">
                  {isLive && extras === null ? "поступления обновляются…" : "Без фонда ГПД"}
                </div>
                <button className="cash-how" onClick={() => setHowOpen(!howOpen)} aria-expanded={howOpen}>
                  Как рассчитано {howOpen ? "▴" : "▾"}
                </button>
                {howOpen && (
                  <div className="cash-how-body">
                    Остаток по ведомости взносов ({fmt(CASH_NOW)} BYN) + разовые поступления ({fmt(extraIncome)} BYN).
                    Фонд ГПД собирается отдельно и в эту сумму не входит.
                  </div>
                )}
              </div>
              <img src="/icons/icon-wallet.webp" className="cash-hero-3d" alt="" />
            </div>

            {/* Годовой сбор — единственное место с суммой «собрано» */}
            <div className="cash-year">
              <div className="cash-year-top">
                <b>Годовой сбор 2026–2027</b>
                <span>Собрано {fmt(TOTAL_COLLECTED)} из {fmt(200 * FAMILIES_COUNT)} BYN</span>
              </div>
              <div className="dprogress"><i style={{ width: Math.round((TOTAL_COLLECTED / (200 * FAMILIES_COUNT)) * 100) + "%" }}></i></div>
              <div className="cash-year-note">Осталось собрать {fmt(Math.max(0, Math.round((200 * FAMILIES_COUNT - TOTAL_COLLECTED) * 100) / 100))} BYN</div>
            </div>

            {/* Расходы за год — включают расходы фонда ГПД (см. раздел «Расходы») */}
            <div className="cash-rows">
              <button className="cash-row pinkrow" onClick={() => onTab("expenses")}>
                <span className="cash-row-lbl"><img src="/icons/icon-receipt.webp" className="row-3d" alt="" /> Расходы, включая ГПД</span>
                <span className="cash-row-val">{fmt(spent)} BYN</span>
              </button>
            </div>

            {/* Фонд ГПД одной строкой — вся строка ведёт в «Деньги → Расходы» */}
            <button className="cash-row gpd" onClick={() => onTab("expenses")}>
              <span className="cash-row-lbl"><img src="/icons/icon-people.webp" className="row-3d" alt="" /> Фонд ГПД <span className="tag-pill">Отдельный сбор</span></span>
              <span className="cash-row-val">Остаток: {fmt(GPD_FUND_REST)} BYN <span className="gpd-arrow" aria-hidden="true">›</span></span>
            </button>

            <button className="pill-btn blue cash-open" onClick={() => onTab("fees")}>Открыть финансы →</button>
          </div>
        </div>
      </div>

      <BirthdaysWidget committee={committee} ev={bdayEv} list={bdays} onTab={onTab} />

      <RegularNews announcements={announcements} onTab={onTab} />

      <PushSettings committee={committee} role={role} toast={toast} />
    </section>
  );
}
