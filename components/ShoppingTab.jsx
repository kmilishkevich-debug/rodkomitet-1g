import { Ic } from "./Art";

export default function ShoppingTab({ committee, toast }) {
  return (
    <section id="tab-shopping">
      <div className="section-cover reveal d1" style={{ background: "var(--teal)", color: "#fff" }}>
        <svg className="cover-deco"><use href="#i-spark" /></svg>
        <h2><Ic id="i-cart" className="ic big" />Что ещё нужно купить</h2>
        {committee && (
          <button className="btn small gold" onClick={() => toast("В полной версии — форма добавления позиции")}>
            <Ic id="i-plus" />Добавить
          </button>
        )}
      </div>
      <div className="card reveal d2">
        <table>
          <tbody>
            <tr><th>Позиция</th><th>Ориент. цена</th><th>Статус</th></tr>
            <tr><td>Шторы в кабинет</td><td>~180,00 BYN</td><td><span className="chip violet">на голосовании</span></td></tr>
            <tr><td>Настольные игры на переменки</td><td>~65,00 BYN</td><td><span className="chip blue">одобрено · ждёт покупки</span></td></tr>
            <tr><td>Новогодние подарки детям</td><td>~405,00 BYN</td><td><span className="chip amber">планируется</span></td></tr>
            <tr><td>Магнитные держатели на доску</td><td>~24,00 BYN</td><td><span className="chip amber">планируется</span></td></tr>
            <tr><td>Рабочие тетради</td><td>243,00 BYN</td><td><span className="chip green">✓ куплено 30.08</span></td></tr>
            <tr><td>Канцелярия для класса</td><td>87,00 BYN</td><td><span className="chip green">✓ куплено 25.08</span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        Статусы: планируется → на голосовании → одобрено → куплено. Купленное автоматически связывается с расходом и чеком.
      </div>
    </section>
  );
}
