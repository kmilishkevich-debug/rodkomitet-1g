"use client";
import { Ic, CIc } from "./Art";
import { fmt, TOTAL_COLLECTED, TOTAL_SPENT, CASH_NOW, FAMILIES_COUNT, EXPENSE_GROUPS, groupTotal } from "./data";
import { DAY_NAMES, BELLS_FALLBACK, LESSONS_FALLBACK, scheduleFocus, subjectIcon } from "./scheduleData";

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

// Мини-расписание на главной: до 13:00 — уроки сегодня, после — на завтра
function ScheduleWidget({ liveSchedule, onTab }) {
  const focus = scheduleFocus();
  const bells = liveSchedule?.bells?.length ? liveSchedule.bells : BELLS_FALLBACK;
  const lessons = (liveSchedule?.lessons?.length ? liveSchedule.lessons : LESSONS_FALLBACK)
    .filter((l) => l.day === focus.day);
  const bellByPos = Object.fromEntries(bells.map((b) => [b.pos, b]));
  const notes = [...new Set(lessons.map((l) => l.note).filter(Boolean))];
  const title =
    focus.label === "сегодня"
      ? "Уроки сегодня"
      : `Уроки ${focus.label} · ${DAY_NAMES[focus.day].toLowerCase()}`;
  return (
    <>
      <div className={"sec-head dh dh-" + focus.day + " reveal d3"}>
        <span className="sec-dot gold"><Ic id="i-clock" /></span>
        <h2 className="sec-title">{title}</h2>
        <span className="sec-note">{lessons.length} урок{lessons.length === 5 ? "ов" : "а"} · каб. 166</span>
      </div>
      <div className="card dash-sched reveal d3">
        {lessons.map((l) => {
          const bell = bellByPos[l.pos];
          const si = subjectIcon(l.subject);
          return (
            <div className="dash-sched-row" key={l.id}>
              <span className="dash-sched-time">{bell ? `${bell.start_time}–${bell.end_time}` : `${l.pos}-й`}</span>
              <span className="dash-sched-subj"><CIc id={si.id} tone={si.tone} size="sm" /> {l.subject}</span>
            </div>
          );
        })}
        {notes.length > 0 && (
          <div className="dash-sched-note"><Ic id="i-backpack" /> Взять с собой: {notes.join(", ").toLowerCase()}</div>
        )}
        <div className="dash-sched-foot">
          <span className="muted" style={{ fontSize: 12 }}>Временное расписание · первые 20 учебных дней</span>
          <button className="pill-btn blue" onClick={() => onTab("schedule")}>Вся неделя</button>
        </div>
      </div>
    </>
  );
}

export default function DashboardTab({ committee, onTab, onOpenUpload, liveGroups, liveSchedule }) {
  const name = committee ? "Кристина" : "Ольга";
  // Живые итоги из базы: потрачено и остаток кассы пересчитываются автоматически
  const spent = liveGroups ? liveGroups.reduce((s, g) => s + groupTotal(g), 0) : TOTAL_SPENT;
  const cash = liveGroups ? TOTAL_COLLECTED - spent : CASH_NOW;
  const groupsCount = (liveGroups || EXPENSE_GROUPS).length;
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
            <button className="w-chip blue" onClick={() => onTab("votes")}><Ic id="i-vote" /> Проголосовать за подарки</button>
            <button className="w-chip pink" onClick={() => onTab("expenses")}><Ic id="i-receipt" /> Посмотреть расходы за сентябрь</button>
          </div>
        </div>
        <div className="welcome-visual">
          <span className="w-blob green" aria-hidden="true"></span>
          <div className="w-mascot"><img src="/mascot.jpg" alt="Маскот класса 1 «Г»" /></div>
          <span className="w-sticker">Я собрал всё важное здесь <Ic id="i-wave" /></span>
        </div>
      </div>

      <div className="grid cols3 stats-row reveal d2">
        <div className="dstat blue">
          <div className="dstat-top">
            <div className="lbl">Сейчас в кассе</div>
            <button className="dstat-btn" title="История операций" onClick={() => onTab("history")}><Ic id="i-arrow-up-right" /></button>
          </div>
          <div className="val">{fmt(cash)} BYN</div>
          <div className="note">{liveGroups ? "собрано минус все расходы" : "остаток по таблице класса"}</div>
        </div>
        <div className="dstat gold">
          <div className="dstat-top">
            <div className="lbl">Собрано за год</div>
            <button className="dstat-btn dark" title="Сборы" onClick={() => onTab("fees")}><Ic id="i-plus" /></button>
          </div>
          <div className="val">{fmt(TOTAL_COLLECTED)} BYN</div>
          <div className="note">взнос 2026–2027 · {FAMILIES_COUNT} семей</div>
        </div>
        <div className="dstat pink">
          <div className="dstat-top">
            <div className="lbl">Потрачено</div>
            <button className="dstat-btn dark" title="Расходы" onClick={() => onTab("expenses")}><Ic id="i-minus" /></button>
          </div>
          <div className="val">{fmt(spent)} BYN</div>
          <div className="note">{groupsCount} группы расходов</div>
        </div>
      </div>

      <ScheduleWidget liveSchedule={liveSchedule} onTab={onTab} />

      <div className="sec-head reveal d3">
        <span className="sec-dot gold"><Ic id="i-bell" /></span>
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
          <div className="attn-title">Рабочие тетради на класс</div>
          <div className="attn-sub">Закупка планируется · белорусский язык, человек и мир, трудовое обучение, ИЗО</div>
        </div>
        <button className="pill-btn blue" onClick={() => onTab("expenses")}>Подробнее</button>
      </div>

      <div className="sec-head reveal d4">
        <span className="sec-dot gold"><Ic id="i-coin" /></span>
        <h2 className="sec-title">Активные сборы</h2>
        <span className="sec-note">Показываем сумму, срок и прогресс</span>
      </div>
      <div className="dfee-card reveal d4">
        <div className="dfee-head">
          <div>
            <div className="dfee-title">Взнос 2026–2027 <span className="tag-pill">годовой</span></div>
            <div className="dfee-meta">50 BYN с семьи · собран полностью</div>
          </div>
          <span className="going-pill">собран</span>
        </div>
        <div className="dfee-progress-labels">
          <span>Сдали {FAMILIES_COUNT} из {FAMILIES_COUNT} семей</span>
          <span>{fmt(TOTAL_COLLECTED)} BYN</span>
        </div>
        <div className="dprogress"><i style={{ width: "100%" }}></i></div>
      </div>
      <div className="dfee-card reveal d5">
        <div className="dfee-head">
          <div>
            <div className="dfee-title">Рабочие тетради <span className="tag-pill">планируется</span></div>
            <div className="dfee-meta">4 позиции · сумма уточняется</div>
          </div>
          <span className="going-pill">скоро</span>
        </div>
        <div className="dfee-progress-labels">
          <span>Белорусский язык · Человек и мир · Труд · ИЗО</span>
          <span>— BYN</span>
        </div>
        <div className="dprogress"><i style={{ width: "0%" }}></i></div>
      </div>
    </section>
  );
}
