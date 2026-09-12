import { Ic, CIc } from "./Art";
import NavIcon from "./NavIcons";
import { FAMILIES, STAFF, FAMILIES_COUNT } from "./data";
import { BIRTHDAYS_FALLBACK, fmtBd, bdName, bdInfo, BD_MONTHS } from "./birthdaysData";

// Учебный год: с сентября по август — так календарь идёт «по порядку года класса»
const MONTH_ORDER = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7];
const MONTH_TITLES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function BirthdayCalendar({ list }) {
  const byMonth = {};
  list.forEach((k) => {
    const m = Number(k.born.split("-")[1]) - 1;
    (byMonth[m] = byMonth[m] || []).push(k);
  });
  Object.values(byMonth).forEach((arr) =>
    arr.sort((a, b) => Number(a.born.slice(8, 10)) - Number(b.born.slice(8, 10)))
  );
  return (
    <>
      <div className="sec-head reveal d3">
        <span className="sec-dot pink"><Ic id="i-cake" /></span>
        <h2 className="sec-title">Дни рождения класса</h2>
        <span className="sec-note">{list.length} именинник{list.length % 10 >= 5 || list.length % 10 === 0 ? "ов" : "а"} · комитет получает напоминание за 5 дней, родители — за 1 день</span>
      </div>
      <div className="bday-months reveal d3">
        {MONTH_ORDER.filter((m) => byMonth[m]).map((m) => (
          <div className="card bday-month" key={m}>
            <div className="bday-month-head">{MONTH_TITLES[m]}</div>
            {byMonth[m].map((k) => {
              const info = bdInfo(k.born);
              const isToday = info.days === 0;
              return (
                <div className={"bday-row" + (isToday ? " today" : "")} key={k.id}>
                  <span className="bday-date">{Number(k.born.slice(8, 10))} {BD_MONTHS[m]}</span>
                  <span className="bday-name">{bdName(k)}</span>
                  <span className="bday-turns">{isToday ? `исполняется ${info.turns}!` : `исполнится ${info.turns}`}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

export default function ClassTab({ committee, toast, liveBirthdays }) {
  const bdays = liveBirthdays || BIRTHDAYS_FALLBACK;
  // «Фамилия Имя» → дата рождения, чтобы показать дату прямо в таблице семей
  const bornByChild = Object.fromEntries(bdays.map((k) => [`${k.last} ${k.first}`, k.born]));
  return (
    <section id="tab-class">
      <div className="section-cover reveal d1" style={{ background: "var(--blue-soft)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <NavIcon name="class" uid="h-class" size={32} className="nvi-big" />Наш класс{" "}
          <span style={{ fontFamily: "'Comfortaa'", fontSize: 13, fontWeight: 700 }}>— {FAMILIES_COUNT} семей</span>
        </h2>
      </div>

      <div className="grid cols2 reveal d2" style={{ marginBottom: 14 }}>
        {STAFF.map((s) => (
          <div className="card" key={s.name}>
            <div className="muted" style={{ marginBottom: 4 }}>{s.role}</div>
            <h3 style={{ margin: "0 0 6px" }}>{s.name}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CIc id="i-phone" tone="blue" size="sm" /> {s.phone}</div>
          </div>
        ))}
      </div>

      <BirthdayCalendar list={bdays} />

      <div className="card reveal d3" style={{ overflowX: "auto" }}>
        <table>
          <tbody>
            <tr><th>№</th><th>Ребёнок</th><th>Родители</th><th>Телефоны</th></tr>
            {FAMILIES.map((f) => (
              <tr key={f.n}>
                <td>{f.n}</td>
                <td>
                  <b>{f.child}</b>
                  {bornByChild[f.child] && (
                    <div className="bday-chip"><Ic id="i-cake" /> {fmtBd(bornByChild[f.child])}</div>
                  )}
                  {f.note && <div><span className="chip violet">{f.note}</span></div>}
                </td>
                <td>
                  {f.parents.map((p) => <div key={p}>{p}</div>)}
                </td>
                <td>
                  {f.phones.map((ph) => <div key={ph} style={{ whiteSpace: "nowrap" }}>{ph}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        Данные — из общей таблицы класса. Если что-то поменялось, напишите родительскому комитету.
      </div>
    </section>
  );
}
