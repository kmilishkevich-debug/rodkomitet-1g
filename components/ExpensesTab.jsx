import { Ic } from "./Art";

const ROWS = [
  { date: "01.09", what: "Букеты учителям (3 шт.)", sum: "135,00", who: "Кристина М.", receipt: "Просмотр чека: Цветочная лавка, 135,00 BYN" },
  { date: "30.08", what: "Рабочие тетради, 27 компл.", sum: "243,00", who: "Ирина П.", receipt: "Просмотр чека: ОЗ, 243,00 BYN" },
  { date: "28.08", what: "Питьевая вода в класс", sum: "36,50", who: "Кристина М.", receipt: "Просмотр чека: Е-доставка, 36,50 BYN" },
  { date: "25.08", what: "Канцелярия для класса", sum: "87,00", who: "Ирина П.", receipt: "Просмотр чека: Officeton, 87,00 BYN" },
  { date: "20.08", what: "Аптечка + мыло, салфетки", sum: "60,00", who: "Кристина М.", receipt: "Просмотр чека: Mila, 60,00 BYN" },
];

export default function ExpensesTab({ committee, toast }) {
  return (
    <section id="tab-expenses">
      <div className="section-cover" style={{ background: "var(--rose)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <Ic id="i-receipt" className="ic big" />Расходы{" "}
          <span style={{ fontFamily: "'Nunito'", fontSize: 13, fontWeight: 700 }}>— каждый с чеком</span>
        </h2>
        {committee && (
          <button className="btn small" onClick={() => toast("В полной версии — форма добавления расхода с обязательным чеком")}>
            <Ic id="i-plus" />Добавить расход
          </button>
        )}
      </div>
      <div className="card">
        <table>
          <tbody>
            <tr><th>Дата</th><th>Назначение</th><th>Сумма</th><th>Кто внёс</th><th>Чек</th></tr>
            {ROWS.map((r) => (
              <tr key={r.date + r.sum}>
                <td>{r.date}</td>
                <td>{r.what}</td>
                <td><b>{r.sum}</b></td>
                <td>{r.who}</td>
                <td><div className="receipt-thumb" onClick={() => toast(r.receipt)}><Ic id="i-receipt" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        Итого за период: <b>561,50 BYN</b> · все расходы видны каждому родителю
      </div>
    </section>
  );
}
