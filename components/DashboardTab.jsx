"use client";
import { Ic } from "./Art";

const DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function todayLine() {
  const d = new Date();
  return `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function greetWord() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  return "Добрый вечер";
}

export default function DashboardTab({ committee, onTab, onOpenUpload }) {
  const name = committee ? "Кристина" : "Ольга";
  return (
    <section id="tab-dashboard">
      <div className="greet-date">{todayLine()}</div>

      <div className="welcome reveal d1">
        <div className="welcome-copy">
          <h1 className="welcome-h1">
            {greetWord()}, {name}!<br />
            <span className="blue">Сегодня есть 2 важных дела</span>
          </h1>
          <p className="welcome-sub">
            Сразу показываем только то, что требует вашего внимания. Остальная
            информация аккуратно собрана ниже.
          </p>
          <div className="welcome-chips">
            <button className="w-chip blue" onClick={() => onTab("votes")}>● Проголосовать за подарки</button>
            <button className="w-chip pink" onClick={() => onOpenUpload("Фонд класса — сентябрь", "15,00 BYN")}>● Отметить взнос 15 BYN</button>
          </div>
        </div>
        <div className="welcome-visual">
          <span className="w-blob green" aria-hidden="true"></span>
          <div className="w-mascot"><img src="/mascot.jpg" alt="Маскот класса 1 «Г»" /></div>
          <span className="w-sticker">Я собрал всё важное здесь 👋</span>
        </div>
      </div>

      <div className="grid cols3 stats-row reveal d2">
        <div className="dstat blue">
          <div className="dstat-top">
            <div className="lbl">Сейчас в кассе</div>
            <button className="dstat-btn" title="История операций" onClick={() => onTab("history")}>↗</button>
          </div>
          <div className="val">683,50 BYN</div>
          <div className="note">обновлено сегодня в 10:04</div>
        </div>
        <div className="dstat gold">
          <div className="dstat-top">
            <div className="lbl">Собрано за год</div>
            <button className="dstat-btn dark" title="Сборы" onClick={() => onTab("fees")}>+</button>
          </div>
          <div className="val">1245,00 BYN</div>
          <div className="note">по четырём сборам</div>
        </div>
        <div className="dstat pink">
          <div className="dstat-top">
            <div className="lbl">Потрачено</div>
            <button className="dstat-btn dark" title="Расходы" onClick={() => onTab("expenses")}>−</button>
          </div>
          <div className="val">561,50 BYN</div>
          <div className="note">12 операций · все с чеками</div>
        </div>
      </div>

      <div className="sec-head reveal d3">
        <span className="sec-dot gold">+</span>
        <h2 className="sec-title">Требует вашего внимания</h2>
        <span className="sec-note">2 действия</span>
      </div>
      <div className="attn-card reveal d3">
        <div className="attn-ico pink"><Ic id="i-vote" /></div>
        <div className="attn-body">
          <div className="attn-title">Подарки детям на Новый год</div>
          <div className="attn-sub">Голосование открыто до 10 сентября · ответили 18 из 27 семей</div>
        </div>
        <button className="pill-btn pink" onClick={() => onTab("votes")}>Проголосовать</button>
      </div>
      <div className="attn-card reveal d3">
        <div className="attn-ico blue"><Ic id="i-clock" /></div>
        <div className="attn-body">
          <div className="attn-title">Фонд класса за сентябрь · 15 BYN</div>
          <div className="attn-sub">Нужно сдать до 12 сентября · вы ещё не отметили оплату</div>
        </div>
        <button className="pill-btn blue" onClick={() => onOpenUpload("Фонд класса — сентябрь", "15,00 BYN")}>Я сдал(а) · чек</button>
      </div>

      <div className="sec-head reveal d4">
        <span className="sec-dot gold">₿</span>
        <h2 className="sec-title">Активные сборы</h2>
        <span className="sec-note">Показываем сумму, срок и прогресс</span>
      </div>
      <div className="dfee-card reveal d4">
        <div className="dfee-head">
          <div>
            <div className="dfee-title">Фонд класса · сентябрь <span className="tag-pill">регулярный</span></div>
            <div className="dfee-meta">15 BYN с семьи · до 12 сентября</div>
          </div>
          <span className="going-pill">идёт сбор</span>
        </div>
        <div className="dfee-progress-labels">
          <span>Сдали 19 из 27 семей</span>
          <span>285 из 405 BYN</span>
        </div>
        <div className="dprogress"><i style={{ width: "70%" }}></i></div>
      </div>
      <div className="dfee-card reveal d5">
        <div className="dfee-head">
          <div>
            <div className="dfee-title">Экскурсия в музей истории <span className="tag-pill">разовый</span></div>
            <div className="dfee-meta">25 BYN с семьи · до 20 сентября</div>
          </div>
          <span className="going-pill">идёт сбор</span>
        </div>
        <div className="dfee-progress-labels">
          <span>Сдали 13 из 27 семей</span>
          <span>325 из 675 BYN</span>
        </div>
        <div className="dprogress"><i style={{ width: "48%" }}></i></div>
      </div>
    </section>
  );
}
