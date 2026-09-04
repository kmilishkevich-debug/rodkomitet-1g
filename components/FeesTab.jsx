"use client";
import { useState } from "react";
import { Ic } from "./Art";

export default function FeesTab({ committee, toast, onOpenUpload }) {
  const [payers1Open, setPayers1Open] = useState(false);
  const [payers2Open, setPayers2Open] = useState(false);
  const [kozlovConfirmed, setKozlovConfirmed] = useState(false);

  const confirmPayment = () => {
    setKozlovConfirmed(true);
    toast("Взнос подтверждён. Родителю отправлено уведомление, сумма зачтена в кассу.");
  };

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
            <h3>Фонд класса — сентябрь <span className="chip violet">регулярный · ежемесячно</span></h3>
            <div className="fee-meta">15,00 BYN с семьи · дедлайн 12.09 · напоминания: за 3 дня и в день дедлайна</div>
          </div>
          <span className="chip amber">идёт сбор</span>
        </div>
        <div className="progress"><i style={{ width: "70%" }}></i></div>
        <div className="muted" style={{ marginBottom: 12 }}>Сдали 19 из 27 · собрано 285,00 BYN</div>
        <div className="row">
          <button className="btn small teal" onClick={() => onOpenUpload("Фонд класса — сентябрь", "15,00 BYN")}>Я сдал(а) — загрузить чек</button>
          <button className="btn small white" onClick={() => setPayers1Open(!payers1Open)}>Кто сдал / кто нет</button>
        </div>
        {payers1Open && (
          <div id="payers1" style={{ marginTop: 14 }}>
            <table>
              <tbody>
                <tr><th>Семья</th><th>Статус</th><th>Чек</th>{committee && <th>Действие</th>}</tr>
                <tr>
                  <td>Смирнова Ольга (Максим С.)</td>
                  <td><span className="chip green">✓ подтверждено</span></td>
                  <td><div className="receipt-thumb" onClick={() => toast("Просмотр чека: Смирнова, 15,00 BYN, 01.09")}><Ic id="i-receipt" /></div></td>
                  {committee && <td>—</td>}
                </tr>
                <tr id="pendingRow">
                  <td>Козлов Дмитрий (Артём К.)</td>
                  <td>{kozlovConfirmed
                    ? <span className="chip green">✓ подтверждено</span>
                    : <span className="chip amber">⏳ ждёт подтверждения</span>}</td>
                  <td><div className="receipt-thumb" onClick={() => toast("Просмотр чека: Козлов, 15,00 BYN, 03.09")}><Ic id="i-receipt" /></div></td>
                  {committee && (
                    <td>{kozlovConfirmed ? "—" : <button className="btn small teal" onClick={confirmPayment}>Подтвердить</button>}</td>
                  )}
                </tr>
                <tr>
                  <td>Лебедева Анна (София Л.)</td>
                  <td><span className="chip red">не сдала</span></td>
                  <td>—</td>
                  {committee && (
                    <td><button className="btn small white" onClick={() => toast("Напоминание отправлено Лебедевой А. (Telegram + Email)")}>Напомнить</button></td>
                  )}
                </tr>
                <tr><td className="muted" colSpan={4}>… ещё 24 семьи (в полной версии — весь список)</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card fee-card">
        <div className="fee-head">
          <div>
            <h3>Экскурсия в музей истории <span className="chip blue">разовый</span></h3>
            <div className="fee-meta">25,00 BYN с семьи · дедлайн 20.09</div>
          </div>
          <span className="chip amber">идёт сбор</span>
        </div>
        <div className="progress"><i style={{ width: "48%" }}></i></div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Сдали 13 из 27 · ваш чек <b style={{ color: "var(--teal-deep)" }}>подтверждён ✓</b>
        </div>
        <button className="btn small white" onClick={() => setPayers2Open(!payers2Open)}>Кто сдал / кто нет</button>
        {payers2Open && (
          <div id="payers2" style={{ marginTop: 14 }}>
            <div className="muted">Список из 27 семей — как в сборе выше.</div>
          </div>
        )}
      </div>

      <div className="card flat fee-card" style={{ opacity: 0.72 }}>
        <div className="fee-head">
          <div>
            <h3>Подарки учителям к 1 сентября <span className="chip blue">разовый</span></h3>
            <div className="fee-meta">20,00 BYN · завершён 28.08</div>
          </div>
          <span className="chip green">завершён · 27/27</span>
        </div>
      </div>
    </section>
  );
}
