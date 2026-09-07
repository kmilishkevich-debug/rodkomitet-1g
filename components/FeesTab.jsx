"use client";
import { useState } from "react";
import { Ic } from "./Art";
import { FEES, FAMILIES_COUNT, TOTAL_COLLECTED, fmt } from "./data";

export default function FeesTab({ committee, toast, onOpenUpload }) {
  const [listOpen, setListOpen] = useState(false);

  const totalHoz = FEES.reduce((s, f) => s + f.hoz, 0);
  const totalBadge = FEES.reduce((s, f) => s + f.badge, 0);
  const totalRest = FEES.reduce((s, f) => s + f.rest, 0);

  return (
    <section id="tab-fees">
      <div className="section-cover" style={{ background: "var(--gold)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2><Ic id="i-coin" className="ic big" />Сборы и взносы</h2>
        {committee && (
          <button className="btn small" onClick={() => toast("В полной версии откроется форма создания сбора")}>
            <Ic id="i-plus" />Новый сбор
          </button>
        )}
      </div>

      <div className="card fee-card">
        <div className="fee-head">
          <div>
            <h3>Взнос 2026–2027 <span className="chip violet">годовой</span></h3>
            <div className="fee-meta">50,00 BYN с семьи · из взноса списаны хознужды (18,28) и бейджи (3,85 — у четверых)</div>
          </div>
          <span className="chip green">собран · {FAMILIES_COUNT}/{FAMILIES_COUNT}</span>
        </div>
        <div className="progress"><i style={{ width: "100%" }}></i></div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Сдали {FAMILIES_COUNT} из {FAMILIES_COUNT} · собрано {fmt(TOTAL_COLLECTED)} BYN · остаток на детях {fmt(totalRest)} BYN
        </div>
        <div className="row">
          <button className="btn small teal" onClick={() => onOpenUpload("Взнос 2026–2027", "50,00 BYN")}>Загрузить чек об оплате</button>
          <button className="btn small white" onClick={() => setListOpen(!listOpen)}>{listOpen ? "Скрыть список" : "Взносы и остатки по детям"}</button>
        </div>
        {listOpen && (
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table>
              <tbody>
                <tr><th>№</th><th>Ребёнок</th><th>Сдано</th><th>Хознужды</th><th>Бейдж</th><th>Остаток</th></tr>
                {FEES.map((f) => (
                  <tr key={f.n}>
                    <td>{f.n}</td>
                    <td>{f.child}</td>
                    <td><b>{fmt(f.paid)}</b></td>
                    <td>−{fmt(f.hoz)}</td>
                    <td>{f.badge ? `−${fmt(f.badge)}` : "—"}</td>
                    <td><b>{fmt(f.rest)}</b></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ textAlign: "right" }}><b>Итого:</b></td>
                  <td><b>{fmt(TOTAL_COLLECTED)}</b></td>
                  <td><b>−{fmt(totalHoz)}</b></td>
                  <td><b>−{fmt(totalBadge)}</b></td>
                  <td><b>{fmt(totalRest)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card flat fee-card" style={{ opacity: 0.72 }}>
        <div className="fee-head">
          <div>
            <h3>Рабочие тетради <span className="chip blue">планируется</span></h3>
            <div className="fee-meta">Белорусский язык · Человек и мир · Трудовое обучение · ИЗО — сумма уточняется</div>
          </div>
          <span className="chip amber">скоро</span>
        </div>
      </div>
    </section>
  );
}
