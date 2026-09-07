import { Ic } from "./Art";
import { FAMILIES, STAFF, FAMILIES_COUNT } from "./data";

export default function ClassTab({ committee, toast }) {
  return (
    <section id="tab-class">
      <div className="section-cover" style={{ background: "var(--blue-soft)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <Ic id="i-users" className="ic big" />Наш класс{" "}
          <span style={{ fontFamily: "'Nunito'", fontSize: 13, fontWeight: 700 }}>— {FAMILIES_COUNT} семей</span>
        </h2>
      </div>

      <div className="grid cols2" style={{ marginBottom: 14 }}>
        {STAFF.map((s) => (
          <div className="card" key={s.name}>
            <div className="muted" style={{ marginBottom: 4 }}>{s.role}</div>
            <h3 style={{ margin: "0 0 6px" }}>{s.name}</h3>
            <div>📞 {s.phone}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <tbody>
            <tr><th>№</th><th>Ребёнок</th><th>Родители</th><th>Телефоны</th></tr>
            {FAMILIES.map((f) => (
              <tr key={f.n}>
                <td>{f.n}</td>
                <td>
                  <b>{f.child}</b>
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
