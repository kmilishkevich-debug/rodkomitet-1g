"use client";

// Вкладка «Календарь» (редизайн 30.10.2026, ТЗ §7 и §16).
// Собирает в одном месте то, что раньше жило тремя карточками на главной:
// календарь класса, ближайшие дни рождения и список праздников (с редактором
// для комитета/учителя — HolidaysWidget сохраняет форму добавления).
// Сами компоненты живут в DashboardTab.jsx и просто экспортируются оттуда,
// чтобы не дублировать код и не разъезжаться в поведении.

import NavIcon from "./NavIcons";
import { BIRTHDAYS_FALLBACK, birthdayEvents } from "./birthdaysData";
import { ClassCalendar, BirthdaysWidget, HolidaysWidget } from "./DashboardTab";

export default function CalendarTab({ committee, role, events, notes, bdays: liveBdays, family, authorName, toast, onTab }) {
  const bdays = liveBdays || BIRTHDAYS_FALLBACK;
  const bdayEv = birthdayEvents(bdays, committee);

  return (
    <section id="tab-calendar">
      <div className="section-cover reveal d1" style={{ background: "var(--blue-soft)" }}>
        <svg className="cover-deco"><use href="#i-spark" /></svg>
        <h2>
          <NavIcon name="calendar" uid="h-calendar" size={32} className="nvi-big" />Календарь{" "}
          <span style={{ fontSize: 13, fontWeight: 600 }}>— события, дни рождения и праздники класса</span>
        </h2>
      </div>

      {/* Полный календарь: события, праздники, дни рождения и напоминания семьи */}
      <ClassCalendar
        events={events}
        notes={notes}
        bdays={bdays}
        family={family}
        onTab={onTab}
        fullLink={false}
      />

      <BirthdaysWidget committee={committee} ev={bdayEv} list={bdays} onTab={onTab} />

      <HolidaysWidget
        committee={committee}
        role={role}
        events={events}
        authorName={authorName}
        toast={toast}
        onTab={onTab}
      />
    </section>
  );
}
