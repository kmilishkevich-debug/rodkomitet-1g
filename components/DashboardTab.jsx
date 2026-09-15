"use client";
import { Fragment, useEffect, useState } from "react";
import { fetchCashExtras } from "@/lib/supabase";
import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import { fmt, TOTAL_COLLECTED, TOTAL_SPENT, CASH_NOW, FEE_ONLY_DEDUCTIONS, FAMILIES_COUNT, EXPENSE_GROUPS, groupTotal } from "./data";
import { DAY_NAMES, BELLS_FALLBACK, LESSONS_FALLBACK, INFO_HOUR, scheduleFocus, subjectIcon, lessonDisplay } from "./scheduleData";
import { weekDates, activeOverridesFor, applyOverridesToDay, dayEndTime, fmtDateRu, minskDateISO } from "./scheduleOverrides";
import { BIRTHDAYS_FALLBACK, birthdayEvents, upcomingBirthdays, joinNames, fmtBd, bdName, inDaysWord } from "./birthdaysData";
import PushSettings from "./PushSettings";
import ClassMascot from "./ClassMascot";

const DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function todayLine() {
  const d = new Date();
  return `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function greetWord() {
  const h = new Date().getHours();
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

// Баннер «Расписание обновлено» — показывается неделю после обновления 14.09.2026
const NEW_SCHEDULE_BANNER_UNTIL = "2026-09-21";
function NewScheduleBanner({ onTab }) {
  if (minskDateISO() >= NEW_SCHEDULE_BANNER_UNTIL) return null;
  return (
    <div className="attn-card reveal d1" style={{ background: "var(--blue-soft, #eaf2fb)" }}>
      <div className="attn-ico blue"><NavIcon name="schedule" uid="d-sched-new" size={26} /></div>
      <div className="attn-body">
        <div className="attn-title">Расписание обновлено</div>
        <div className="attn-sub">
          Теперь по 5 занятий в день (в четверг — 4, конец в 11:35). Добавлены классный час,
          факультативы и поддерживающие занятия.
        </div>
      </div>
      <button className="pill-btn blue" onClick={() => onTab("schedule")}>Посмотреть</button>
    </div>
  );
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
  const title =
    focus.label === "сегодня"
      ? "Уроки сегодня"
      : `Уроки ${focus.label} · ${DAY_NAMES[focus.day].toLowerCase()}`;
  return (
    <>
      <div className={"sec-head dh dh-" + focus.day + " reveal d3"}>
        <span className="sec-dot gold"><NavIcon name="schedule" uid="d-sched" size={20} /></span>
        <h2 className="sec-title">{title}</h2>
        <span className="sec-note">
          {lessons.length} урок{lessons.length === 5 ? "ов" : "а"} · каб. 166
          {activeOvs.length > 0 && <> · <b style={{ color: "#b07d0a" }}>изменено</b></>}
        </span>
      </div>
      <div className="card dash-sched reveal d3">
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
          <div className="dash-sched-note"><Ic id="i-backpack" /> Взять с собой: {notes.join(", ").toLowerCase()}</div>
        )}
        {activeOvs.length > 0 && (() => {
          const end = dayEndTime(lessons, bells);
          return end ? (
            <div className="dash-sched-note">Занятия закончатся в <b>{end}</b></div>
          ) : null;
        })()}
        <div className="dash-sched-foot">
          <span className="muted" style={{ fontSize: 12 }}>Временное расписание · первые 20 учебных дней</span>
          <button className="pill-btn blue" onClick={() => onTab("schedule")}>Вся неделя</button>
        </div>
      </div>
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

// Блок «Дни рождения»: напоминания + ближайшие именинники
function BirthdaysWidget({ committee, ev, list, onTab }) {
  const upcoming = upcomingBirthdays(list, new Date(), 3);
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
        <h2 className="sec-title">Дни рождения</h2>
        <span className="sec-note">поздравляем всем классом</span>
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
        {upcoming.map((k) => (
          <div className="bday-row" key={k.id}>
            <span className="bday-date">{fmtBd(k.born)}</span>
            <span className="bday-name"><Ic id="i-cake" /> {bdName(k)}</span>
            <span className="bday-turns">исполнится {k.turns}</span>
            <span className={"bday-when" + (k.days <= 5 ? " close" : "")}>
              {k.days === 0 ? "сегодня" : inDaysWord(k.days)}
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

export default function DashboardTab({ committee, role, toast, onTab, onOpenUpload, liveGroups, liveSchedule, liveBirthdays, overrides, mascotRef, greetToken }) {
  const greetName = committee ? ", Кристина" : "";
  // Пока в разделе «Требует внимания» одна карточка — тетради
  const attnCount = 1;
  const headline = attnCount === 0 ? "Все важные дела выполнены" : "Сегодня есть 1 важное дело";
  // Живые итоги из базы: потрачено и остаток кассы пересчитываются автоматически
  const spent = liveGroups ? liveGroups.reduce((s, g) => s + groupTotal(g), 0) : TOTAL_SPENT;
  // Поступления сверх старого сбора: платежи по новым сборам + разовые поступления
  const [extras, setExtras] = useState(null);
  useEffect(() => {
    fetchCashExtras().then((data) => {
      if (data) setExtras(data);
    });
  }, []);
  const extraIncome = extras ? extras.oneOff + extras.campaigns : 0;
  const cash = liveGroups
    ? Math.round((TOTAL_COLLECTED - spent - FEE_ONLY_DEDUCTIONS + extraIncome) * 100) / 100
    : Math.round((CASH_NOW + extraIncome) * 100) / 100;
  const groupsCount = (liveGroups || EXPENSE_GROUPS).length;
  const bdays = liveBirthdays || BIRTHDAYS_FALLBACK;
  const bdayEv = birthdayEvents(bdays, committee);
  // Изменение расписания на день из мини-виджета — баннер сверху
  const schedFocus = scheduleFocus();
  const schedBells = liveSchedule?.bells?.length ? liveSchedule.bells : BELLS_FALLBACK;
  const schedAll = liveSchedule?.lessons?.length ? liveSchedule.lessons : LESSONS_FALLBACK;
  const schedIso = weekDates()[schedFocus.day];
  const schedOvs = activeOverridesFor(overrides, schedIso);
  const schedEnd = schedOvs.length ? dayEndTime(applyOverridesToDay(schedAll, schedFocus.day, schedOvs).lessons, schedBells) : null;
  return (
    <section id="tab-dashboard">
      <div className="greet-date">{todayLine()}</div>

      <BdayBanner ev={bdayEv} />

      <NewScheduleBanner onTab={onTab} />

      <ScheduleChangeBanner activeOvs={schedOvs} focusIso={schedIso} focusLabel={schedFocus.label} endTime={schedEnd} toast={toast} onTab={onTab} />

      <div className="welcome reveal d1">
        <div className="welcome-copy">
          <h1 className="welcome-h1">
            {greetWord()}{greetName}!<br />
            <span className="blue">{headline}</span>
          </h1>
          <p className="welcome-sub">
            Сразу показываем только то, что требует вашего внимания. Остальная
            информация аккуратно собрана ниже.
          </p>
          <div className="welcome-chips">
            <button className="w-chip blue" onClick={() => onTab("schedule")}><NavIcon name="schedule" uid="d-schd" size={18} className="nvi-inline" /> Расписание на неделю</button>
            <button className="w-chip pink" onClick={() => onTab("expenses")}><NavIcon name="expenses" uid="d-exp" size={18} className="nvi-inline" /> Посмотреть расходы за сентябрь</button>
          </div>
        </div>
        <div className="welcome-visual">
          <span className="w-blob green" aria-hidden="true"></span>
          <ClassMascot ref={mascotRef} allDone={false} greetToken={greetToken} />
        </div>
      </div>

      <div className="grid cols3 stats-row reveal d2">
        <div className="dstat blue">
          <div className="dstat-top">
            <div className="lbl">Сейчас в кассе</div>
            <button className="dstat-btn" title="История операций" onClick={() => onTab("history")}><Ic id="i-arrow-up-right" /></button>
          </div>
          <div className="val">{fmt(cash)} BYN</div>
          <div className="note">собрано − расходы − бейджи ({fmt(FEE_ONLY_DEDUCTIONS)})</div>
        </div>
        <div className="dstat gold">
          <div className="dstat-top">
            <div className="lbl">Собрано за год</div>
            <button className="dstat-btn dark" title="Сборы" onClick={() => onTab("fees")}><Ic id="i-plus" /></button>
          </div>
          <div className="val">{fmt(TOTAL_COLLECTED)} BYN</div>
          <div className="note">взнос 2026–2027 · {FAMILIES_COUNT} семей</div>
        </div>
        <div className="dstat pink">
          <div className="dstat-top">
            <div className="lbl">Потрачено</div>
            <button className="dstat-btn dark" title="Расходы" onClick={() => onTab("expenses")}><Ic id="i-minus" /></button>
          </div>
          <div className="val">{fmt(spent)} BYN</div>
          <div className="note">{groupsCount} группы расходов</div>
        </div>
      </div>

      <ScheduleWidget liveSchedule={liveSchedule} overrides={overrides} onTab={onTab} />

      <BirthdaysWidget committee={committee} ev={bdayEv} list={bdays} onTab={onTab} />

      <div className="sec-head reveal d3">
        <span className="sec-dot gold"><Ic id="i-bell" /></span>
        <h2 className="sec-title">Требует вашего внимания</h2>
        <span className="sec-note">{attnCount === 1 ? "1 действие" : `${attnCount} действия`}</span>
      </div>
      <div className="attn-card reveal d3">
        <div className="attn-ico blue"><NavIcon name="schedule" uid="d-attn-sched" size={26} /></div>
        <div className="attn-body">
          <div className="attn-title">Рабочие тетради на класс</div>
          <div className="attn-sub">Закупка планируется · белорусский язык, человек и мир, труд, ИЗО, шкала самооценки, планшет для прописей</div>
        </div>
        <button className="pill-btn blue" onClick={() => onTab("expenses")}>Подробнее</button>
      </div>

      <div className="sec-head reveal d4">
        <span className="sec-dot gold"><NavIcon name="fees" uid="d-fees" size={20} /></span>
        <h2 className="sec-title">Активные сборы</h2>
        <span className="sec-note">Показываем сумму, срок и прогресс</span>
      </div>
      <div className="dfee-card reveal d4">
        <div className="dfee-head">
          <div>
            <div className="dfee-title">Взнос 2026–2027 <span className="tag-pill">годовой</span></div>
            <div className="dfee-meta">суммы по таблице класса · собран полностью</div>
          </div>
          <span className="going-pill">собран</span>
        </div>
        <div className="dfee-progress-labels">
          <span>Сдали {FAMILIES_COUNT} из {FAMILIES_COUNT} семей</span>
          <span>{fmt(TOTAL_COLLECTED)} BYN</span>
        </div>
        <div className="dprogress"><i style={{ width: "100%" }}></i></div>
      </div>
      <div className="dfee-card reveal d5">
        <div className="dfee-head">
          <div>
            <div className="dfee-title">Рабочие тетради <span className="tag-pill">планируется</span></div>
            <div className="dfee-meta">6 позиций · сумма уточняется</div>
          </div>
          <span className="going-pill">скоро</span>
        </div>
        <div className="dfee-progress-labels">
          <span>Белорусский язык · Человек и мир · Труд · ИЗО · Шкала самооценки · Планшет для прописей</span>
          <span>— BYN</span>
        </div>
        <div className="dprogress"><i style={{ width: "0%" }}></i></div>
      </div>

      <PushSettings committee={committee} role={role} toast={toast} />
    </section>
  );
}
