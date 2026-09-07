import { Ic } from "./Art";
import { EXPENSE_GROUPS, TOTAL_SPENT, fmt, groupTotal } from "./data";

export default function ExpensesTab({ committee, toast }) {
  return (
    <section id="tab-expenses">
      <div className="section-cover" style={{ background: "var(--rose)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <Ic id="i-receipt" className="ic big" />Расходы{" "}
          <span style={{ fontFamily: "'Nunito'", fontSize: 13, fontWeight: 700 }}>— как в таблице класса</span>
        </h2>
        {committee && (
          <button className="btn small" onClick={() => toast("В полной версии — форма добавления расхода с обязательным чеком")}>
            <Ic id="i-plus" />Добавить расход
          </button>
        )}
      </div>

      {EXPENSE_GROUPS.map((g) => (
        <div className="card" key={g.id} style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{g.title}</h3>
          <table>
            <tbody>
              <tr><th>Наименование</th><th>Цена</th><th>Кол-во</th><th>Сумма</th><th>Место закупки</th></tr>
              {g.items.map((i) => (
                <tr key={i.name} style={i.planned ? { opacity: 0.6 } : undefined}>
                  <td>{i.name}</td>
                  {i.planned ? (
                    <>
                      <td>—</td>
                      <td>—</td>
                      <td><span className="chip amber">планируется</span></td>
                      <td>—</td>
                    </>
                  ) : (
                    <>
                      <td>{i.free ? "—" : fmt(i.price)}</td>
                      <td>{i.qty}</td>
                      <td><b>{i.free ? <span className="chip green">бесплатно</span> : fmt(i.sum)}</b></td>
                      <td>{i.place}</td>
                    </>
                  )}
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ textAlign: "right" }}><b>Итого по группе:</b></td>
                <td><b>{groupTotal(g) > 0 ? `${fmt(groupTotal(g))} BYN` : "—"}</b></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <div className="muted" style={{ marginTop: 10 }}>
        Итого потрачено: <b>{fmt(TOTAL_SPENT)} BYN</b> · позиции «планируется» в итог не входят · все расходы видны каждому родителю
      </div>
    </section>
  );
}
