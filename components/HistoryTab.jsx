import { Ic } from "./Art";

const teal = { color: "var(--teal-deep)" };
const pink = { color: "var(--pink)" };

export default function HistoryTab({ toast }) {
  return (
    <section id="tab-history">
      <div className="section-cover" style={{ background: "var(--orange)", color: "#fff" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2><Ic id="i-book" className="ic big" />История операций</h2>
        <button className="btn small white" onClick={() => toast("В полной версии выгрузится Excel-отчёт за выбранный период")}>
          <Ic id="i-download" />Отчёт (Excel)
        </button>
      </div>
      <div className="card">
        <table>
          <tbody>
            <tr><th>Дата</th><th>Событие</th><th>Сумма</th></tr>
            <tr><td>04.09 10:04</td><td>Козлов Д. загрузил чек по сбору «Фонд класса — сентябрь» (ждёт подтверждения)</td><td style={teal}><b>+15,00</b></td></tr>
            <tr><td>03.09 19:22</td><td>Комитет подтвердил 4 взноса по сбору «Экскурсия в музей»</td><td style={teal}><b>+100,00</b></td></tr>
            <tr><td>02.09 14:37</td><td>Подтверждён взнос Смирновой О. — «Экскурсия в музей»</td><td style={teal}><b>+25,00</b></td></tr>
            <tr><td>01.09 12:10</td><td>Расход: букеты учителям (чек приложен) — Кристина М.</td><td style={pink}><b>−135,00</b></td></tr>
            <tr><td>30.08 16:45</td><td>Расход: рабочие тетради, 27 компл. (чек приложен) — Ирина П.</td><td style={pink}><b>−243,00</b></td></tr>
            <tr><td>28.08 09:30</td><td>Завершён сбор «Подарки учителям» — сдали 27/27</td><td style={teal}><b>+540,00</b></td></tr>
            <tr><td>25.08 20:15</td><td>Итог голосования: осенняя экскурсия — Музей истории (72%)</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        Полный журнал: каждый взнос, расход, подтверждение и голосование фиксируются автоматически и не редактируются задним числом.
      </div>
    </section>
  );
}
