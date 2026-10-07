"use client";
import { Fragment, useEffect, useState } from "react";
import { fetchCashExtras, fetchFees, fetchFeeCampaigns, fetchPaymentRequisites, addFamilyNote, toggleFamilyNote, deleteFamilyNote, markRead, isLive } from "@/lib/supabase";
import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import {
  fmt, FAMILIES_COUNT, applyAutoFees, fallbackFeeData,
  FAMILIES, familyNs, familyGroup,
} from "./data";
import { DAY_NAMES, BELLS_FALLBACK, LESSONS_FALLBACK, INFO_HOUR, scheduleFocus, subjectIcon, lessonDisplay } from "./scheduleData";
import { weekDates, activeOverridesFor, applyOverridesToDay, dayEndTime, fmtDateRu } from "./scheduleOverrides";
import { BIRTHDAYS_FALLBACK, BD_MONTHS_PREP, birthdayEvents, upcomingBirthdays, joinNames, fmtBd, bdName, bdInfo, inDaysWord } from "./birthdaysData";
import FamilyPicker from "./FamilyPicker";
import PushSettings from "./PushSettings";
import { AbsenceCard } from "./Absences";
import TeacherBoard from "./TeacherBoard";
import TeacherFamilyChat from "./TeacherFamilyChat";
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

// ===== Обычные объявления внизу главной (ТЗ §11): без дублирования важных =====
function RegularNews({ announcements, reads, family, onTab }) {
  const active = (announcements || []).filter((a) => a.status === "active");
  const regular = active.filter((a) => !a.important).slice(0, 3);
  // Если все объявления важные — карточки уже показаны вверху,
  // но путь в ленту оставляем: одна кнопка без заголовка и списка.
  if (!regular.length) {
    if (!active.length) return null;
    return (
      <button className="pill-btn news-all-link reveal d3" onClick={() => onTab("announcements")}>
        Все объявления →
      </button>
    );
  }
  return (
    <>
      <div className="sec-head reveal d3">
        <span className="sec-dot blue"><Ic id="i-bell" /></span>
        <h2 className="sec-title">Объявления класса</h2>
      </div>
      {regular.map((a) => {
        const read = isReadBy(a, reads, family);
        return (
          <div className="card homenews-card reveal d3" key={a.id}>
            <div className="homenews-body">
              <div className="homenews-title">{a.pinned && <span title="Закреплено">📌 </span>}{a.title}</div>
              {a.body && <div className="homenews-sub">{snippet(a.body)}</div>}
              <div className="homenews-meta">
                {a.author || "Комитет"} · {fmtNewsDate(a.created_at)}
                {read && <span style={{ color: "var(--green, #2e7d32)", fontWeight: 600 }}> · ✓ Прочитано</span>}
              </div>
            </div>
            <button className="pill-btn blue" onClick={() => readAndGo(a, reads, family, onTab)}>Читать</button>
          </div>
        );
      })}
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

// ===== Карточка «Личное сообщение учителю» на «Главной» у родителей =====
// Вход в личную переписку семьи с классным руководителем: открывает то же
// окно TeacherFamilyChat, что и у учителя в кабинете, но со стороны родителя
// (side="parent"). Если семья ещё не выбрана — сначала просим выбрать её.
function TeacherChatCard({ family, onNeedFamily, messages, teacherName, onSent, toast }) {
  const [open, setOpen] = useState(false);
  const ns = family ? familyNs(family.n) : [];
  // Непрочитанные этой семьёй сообщения от учителя — для бейджа на кнопке
  const unread = family
    ? (messages || []).filter((m) => ns.includes(m.family_n) && m.from_teacher && !m.read_family).length
    : 0;
  const openChat = () => {
    if (!family) { onNeedFamily?.(); return; }
    setOpen(true);
  };
  return (
    <>
      <div className="card reveal d2 teacher-chat-card">
        <div className="dash-card-head">
          <img src="/icons/icon-envelope.webp" className="head-3d" alt="" />
          <div className="dash-card-titles">
            <h2 className="sec-title">Личное сообщение учителю</h2>
            <div className="dash-card-sub">
              {unread > 0
                ? `Новых сообщений от учителя: ${unread}`
                : `Переписку видите только вы и ${teacherName || "классный руководитель"}`}
            </div>
          </div>
        </div>
        <button className="pill-btn teacher-open" onClick={openChat}>
          {unread > 0 ? "Прочитать и ответить →" : "Написать учителю →"}
        </button>
      </div>
      <TeacherFamilyChat
        open={open}
        familyN={family?.n}
        familyChild={family?.child}
        messages={messages}
        teacherName={teacherName}
        side="parent"
        onSent={onSent}
        onClose={() => setOpen(false)}
        toast={toast}
      />
    </>
  );
}

export default function DashboardTab({ committee, role, toast, onTab, onOpenUpload, liveGroups, liveSchedule, liveBirthdays, overrides, mascotRef, greetToken, authorName, announcements, polls, reads, family, setFamily, notes, onReloadNotes, homework, events, postComments, chatClosed, onReloadComments, familyMessages, onReloadMessages }) {
  // Выбор семьи по требованию (когда пишут в обсуждение, не выбрав семью)
  const [famOpen, setFamOpen] = useState(false);
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
  // Касса класса = остаток по ведомости взносов + разовые поступления.
  // Ведомость строится так же, как на вкладке «Взносы»: авто-статьи
  // пересчитываются из раздела «Расходы» (гардероб входит в хознужды).
  // Не считаем через «собрано − потрачено»: в «потрачено» входят расходы
  // фонда ГПД, который собирается отдельно и классную кассу не уменьшает.
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
  // Остаток только главного сбора: ведомость + разовые поступления (без целевых сборов)
  const cashMain = Math.round((feesRest + (extras?.oneOff || 0)) * 100) / 100;
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
    subline = "Комитет опубликовал важное объявление — карточка с ним в самом верху страницы.";
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

      {/* Объявления класса — на самом верху главной: сначала важные, затем обычные */}
      <ImportantNews announcements={announcements} reads={reads} family={family} onTab={onTab} />
      <RegularNews announcements={announcements} reads={reads} family={family} onTab={onTab} />

      <BdayBanner ev={bdayEv} />

      <ScheduleChangeBanner activeOvs={schedOvs} focusIso={schedIso} focusLabel={schedFocus.label} endTime={schedEnd} toast={toast} onTab={onTab} />

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

      <ActivePolls polls={polls} family={family} onTab={onTab} />

      {/* Персонализация: привязка семьи (для комитета/учителя), сводка семьи, заметки, напоминания семьям */}
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

      {/* Личная переписка семьи с учителем — у всех, кроме самого учителя */}
      {role !== "teacher" && (
        <TeacherChatCard
          family={family}
          onNeedFamily={() => setFamOpen(true)}
          messages={familyMessages}
          teacherName={
            (homework || []).find((h) => h.author)?.author ||
            (events || []).find((e) => e.author)?.author ||
            (notes || []).find((n) => n.from_teacher && n.author)?.author ||
            null
          }
          onSent={onReloadMessages}
          toast={toast}
        />
      )}
      <FamilyPicker
        open={famOpen}
        onClose={() => setFamOpen(false)}
        title="Выберите свою семью"
        onPick={(f) => setFamily(f)}
      />

      {/* Отсутствия: семья отмечает, что ребёнка не будет — рядом с карточкой
          «От учителя». Другие родители чужих отсутствий не видят. */}
      {family && <AbsenceCard family={family} toast={toast} />}

      {/* Привязка семьи — только для комитета: у учителя «Главной» больше нет,
          да и своей семьи в списке класса у него не бывает */}
      {!family && committee && <BindFamilyCard setFamily={setFamily} toast={toast} />}
      {family && <FamilyWidget family={family} polls={polls} bdays={bdays} onTab={onTab} liveGroups={liveGroups} />}
      {family && <NotesWidget family={family} notes={notes} onReload={onReloadNotes} toast={toast} />}
      {committee && <CommitteeRemind authorName={authorName} toast={toast} />}

      <div className="dash-cols">
        <div className="dash-col-main" id="home-schedule">
          <ScheduleWidget liveSchedule={liveSchedule} overrides={overrides} onTab={onTab} />
        </div>
        <div className="dash-col-side">
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

      <PushSettings committee={committee} role={role} familyN={family?.n} toast={toast} />
    </section>
  );
}
