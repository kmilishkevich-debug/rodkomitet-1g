import { Ic, MascotPeek } from "./Art";

export default function DashboardTab({ committee, onTab, onOpenUpload }) {
  return (
    <section id="tab-dashboard">
      <div className="greet-date">Пятница · 4 сентября</div>
      <div className="greet-wrap">
        <div className="greeting" id="greetingText">
          Здравствуйте, <span id="greetName">{committee ? "Кристина" : "Ольга"}</span>! Сегодня стоит{" "}
          <span className="hl b" onClick={() => onTab("votes")} style={{ cursor: "pointer" }}>проголосовать</span> за новогодние подарки и{" "}
          <span className="hl y" onClick={() => onTab("fees")} style={{ cursor: "pointer" }}>сдать 15 BYN</span> в фонд класса до{" "}
          <span className="hl p">12 сентября</span>.
        </div>
        <MascotPeek className="greet-blob mascot-wrap" />
      </div>

      <div className="grid cols3">
        <div className="card teal stat"><div className="lbl">В кассе сейчас</div><div className="val">683,50 BYN</div><div className="note">обновлено сегодня в 10:04</div></div>
        <div className="card gold stat"><div className="lbl">Собрано за год</div><div className="val">1 245,00</div><div className="note">по 4 сборам</div></div>
        <div className="card rose stat"><div className="lbl">Потрачено</div><div className="val">561,50</div><div className="note">12 операций · все с чеками</div></div>
      </div>

      <h2><Ic id="i-spark" />Требует внимания</h2>
      <div className="card fee-card">
        <div className="fee-head">
          <div>
            <h3><Ic id="i-vote" />Голосование «Подарки детям на Новый год»</h3>
            <div className="fee-meta">открыто до 10.09 · проголосовали 18 из 27</div>
          </div>
          <button className="btn small pink" onClick={() => onTab("votes")}>Проголосовать</button>
        </div>
      </div>
      <div className="card fee-card">
        <div className="fee-head">
          <div>
            <h3><Ic id="i-clock" />Взнос «Фонд класса — сентябрь» · 15,00 BYN</h3>
            <div className="fee-meta">сдать до 12.09 · вы ещё не отметили сдачу</div>
          </div>
          <button className="btn small teal" onClick={() => onOpenUpload("Фонд класса — сентябрь", "15,00 BYN")}>Я сдал(а) — чек</button>
        </div>
      </div>

      <h2><Ic id="i-coin" />Активные сборы</h2>
      <div className="card fee-card">
        <div className="fee-head">
          <div>
            <h3>Фонд класса — сентябрь <span className="chip violet">регулярный</span></h3>
            <div className="fee-meta">15,00 BYN с семьи · до 12.09</div>
          </div>
          <span className="chip amber">идёт сбор</span>
        </div>
        <div className="progress"><i style={{ width: "70%" }}></i></div>
        <div className="muted">Сдали 19 из 27 · собрано 285,00 из 405,00 BYN</div>
      </div>
      <div className="card fee-card">
        <div className="fee-head">
          <div>
            <h3>Экскурсия в музей истории <span className="chip blue">разовый</span></h3>
            <div className="fee-meta">25,00 BYN с семьи · до 20.09</div>
          </div>
          <span className="chip amber">идёт сбор</span>
        </div>
        <div className="progress"><i style={{ width: "48%" }}></i></div>
        <div className="muted">Сдали 13 из 27 · собрано 325,00 из 675,00 BYN</div>
      </div>
    </section>
  );
}
