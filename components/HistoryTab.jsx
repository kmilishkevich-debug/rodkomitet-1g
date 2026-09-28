"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";
import { FAMILIES } from "./data";
import { fetchVisits, fetchFamiliesSeen } from "@/lib/supabase";

const teal = { color: "var(--teal-deep)" };
const pink = { color: "var(--pink)" };

// ===== Помощники дат =====
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Сегодня";
  if (sameDay(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
}

// Последний визит в сводке: «сегодня 19:42», «вчера 08:15», «26.09»
function lastVisitLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `сегодня ${fmtTime(iso)}`;
  if (sameDay(d, yesterday)) return `вчера ${fmtTime(iso)}`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

// Кто зашёл — строка ленты
function visitorName(v) {
  if (v.role === "teacher") return "Классный руководитель";
  if (v.role === "committee") return "Комитет";
  const child = v.label || FAMILIES.find((f) => f.n === v.family_n)?.child;
  return v.family_n ? `Семья №${v.family_n}${child ? ` · ${child}` : ""}` : child || "Семья";
}

// «вошли в 19:42, были до ~20:05» — вторая часть только если сидели дольше пары минут
function visitTime(v) {
  const start = new Date(v.started_at).getTime();
  const seen = new Date(v.last_seen).getTime();
  const base = `вошли в ${fmtTime(v.started_at)}`;
  if (seen - start >= 3 * 60 * 1000) return `${base}, были до ~${fmtTime(v.last_seen)}`;
  return base;
}

// ===== Блок посещений (видит только комитет) =====
function VisitsBlock() {
  const [visits, setVisits] = useState(null); // null = ещё грузим или базы нет
  const [seen, setSeen] = useState(null);
  const [allFamilies, setAllFamilies] = useState(false);

  useEffect(() => {
    fetchVisits().then(setVisits);
    fetchFamiliesSeen().then(setSeen);
  }, []);

  // База ещё не настроена (visits-setup.sql не запускали) — блок молча не показываем
  if (visits === null && seen === null) return null;

  const seenList = seen || [];
  const connected = seenList.length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeWeek = seenList.filter((s) => new Date(s.last_at).getTime() >= weekAgo).length;

  // Сводка по 27 семьям: сначала кто заходил (свежие сверху), потом кто ни разу
  const byN = new Map(seenList.map((s) => [s.family_n, s]));
  const famRows = FAMILIES.map((f) => ({ ...f, seen: byN.get(f.n) || null })).sort((a, b) => {
    if (a.seen && b.seen) return new Date(b.seen.last_at) - new Date(a.seen.last_at);
    if (a.seen) return -1;
    if (b.seen) return 1;
    return a.n - b.n;
  });
  const shownFam = allFamilies ? famRows : famRows.slice(0, 8);

  // Лента по дням
  const groups = [];
  for (const v of visits || []) {
    const label = dayLabel(v.started_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(v);
    else groups.push({ label, items: [v] });
  }

  return (
    <>
      <div className="grid cols2 reveal d2" style={{ marginBottom: 14 }}>
        <div className="card stat">
          <div className="lbl">Подключились к приложению</div>
          <div className="val" style={teal}>{connected} <span style={{ fontSize: 16, opacity: 0.6 }}>из {FAMILIES.length} семей</span></div>
          <div className="note muted">Заходили хотя бы один раз за всё время</div>
        </div>
        <div className="card stat">
          <div className="lbl">Активны за 7 дней</div>
          <div className="val" style={pink}>{activeWeek} <span style={{ fontSize: 16, opacity: 0.6 }}>{activeWeek === 1 ? "семья" : activeWeek >= 2 && activeWeek <= 4 ? "семьи" : "семей"}</span></div>
          <div className="note muted">Открывали приложение на этой неделе</div>
        </div>
      </div>

      <div className="card reveal d2" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}><Ic id="i-users" /> Семьи и последний визит</h3>
        <table>
          <tbody>
            <tr><th>№</th><th>Ребёнок</th><th>Последний визит</th><th>Заходов</th></tr>
            {shownFam.map((f) => (
              <tr key={f.n} style={f.seen ? undefined : { opacity: 0.45 }}>
                <td>{f.n}</td>
                <td>{f.child}</td>
                <td>{f.seen ? lastVisitLabel(f.seen.last_at) : "ещё не заходили"}</td>
                <td>{f.seen ? f.seen.visits_count : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {famRows.length > 8 && (
          <button className="btn small gold" style={{ marginTop: 10 }} onClick={() => setAllFamilies(!allFamilies)}>
            {allFamilies ? "Свернуть" : `Показать все ${famRows.length} семей`}
          </button>
        )}
      </div>

      <div className="card reveal d2" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}><Ic id="i-clock" /> Журнал заходов</h3>
        {!visits || visits.length === 0 ? (
          <div className="muted">Пока пусто — записи появятся после первых заходов.</div>
        ) : (
          groups.map((g) => (
            <div key={g.label} style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontWeight: 700, margin: "8px 0 4px" }}>{g.label}</div>
              {g.items.map((v) => (
                <div key={v.id} style={{ padding: "5px 0", borderBottom: "1px solid rgba(23,23,23,.06)", fontSize: 14 }}>
                  <b>{visitorName(v)}</b> — {visitTime(v)}
                </div>
              ))}
            </div>
          ))
        )}
        <div className="muted" style={{ marginTop: 8 }}>
          Журнал хранится 30 дней и виден только комитету. Счётчик подключений — за всё время.
        </div>
      </div>
    </>
  );
}

export default function HistoryTab({ toast, committee }) {
  return (
    <section id="tab-history">
      <div className="section-cover reveal d1" style={{ background: "var(--orange)", color: "#fff" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2><NavIcon name="history" uid="h-history" size={32} className="nvi-big" />История операций</h2>
        <button className="btn small white" onClick={() => toast("В полной версии выгрузится Excel-отчёт за выбранный период")}>
          <Ic id="i-download" />Отчёт (Excel)
        </button>
      </div>

      {committee && <VisitsBlock />}

      <div className="card reveal d2">
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
