"use client";
// «Пушистый казначей» — интерактивный маскот сборов класса 1 «Г».
// Сцена собирается из ДВУХ слоёв: неподвижная банка «Общее дело 1Г»
// (/public/mascot/jar-low|mid|high|full.png) и живой монстрик
// (/public/mascot/pose-*.png), который анимируется CSS-ом: прыгает,
// покачивается, радуется. Вокруг — мягкие постоянные конфетти.
// Реакции (монетка, чек, залп конфетти) анимируются поверх сцены.
// При отсутствии картинок рисуется заглушка, логика работает и без графики.
//
// Разделение обязанностей:
//  • расчёт прогресса — computeProgress (чистая функция, деньги в копейках);
//  • состояние сцены — stageFor (4 состояния по порогам 25/70/100);
//  • реакции — очередь событий (взнос/расход) с дедупликацией по id и батчингом;
//  • данные — приходят снаружи (collected/goal), события — через шину window
//    (CustomEvent "tm-event") или напрямую через ref.

import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const MASCOT_GOAL = 5400; // цель банки: 200 BYN × 27 семей

// Шина событий: любой блок сайта может сообщить казначею о взносе или расходе
export function notifyTreasurer(detail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("tm-event", { detail }));
  } catch {}
}

// Дедупликация обработанных операций — на всю страницу (обе сцены не дублируют)
const seenIds = new Set();

// ===== Чистые расчёты (деньги — в копейках, без плавающей запятой) =====
const toCents = (n) => Math.round((Number(n) || 0) * 100);
export function computeProgress(collected, goal) {
  const c = toCents(collected);
  const g = Math.max(1, toCents(goal));
  const pct = Math.max(0, Math.min(100, (c / g) * 100));
  return { pct, full: c >= g };
}

// Состояние сцены по прогрессу (пороги из ТЗ)
export function stageFor(pct) {
  if (pct >= 100) return { key: "done", say: "Ура! Всё собрано — танцуем!" };
  if (pct >= 70) return { key: "near", say: "Ещё капельку — и банка полная!" };
  if (pct >= 25) return { key: "grow", say: "Монетка к монетке — копилка растёт!" };
  return { key: "start", say: "Стартуем! Банка ждёт первых монеток" };
}

// Наполнение банки по состоянию сцены
const JAR = { start: "low", grow: "mid", near: "high", done: "full" };

const fmtByn = (n) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Картинка с фолбэком: если файла нет, рисуем CSS-заглушку с подписью
function Pic({ src, className, fallback }) {
  const [broken, setBroken] = useState(false);
  if (broken)
    return <span className={className + " tm-ph"} aria-hidden="true">{fallback}</span>;
  return (
    <img
      className={className}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

// Мягкие постоянные конфетти вокруг маскота (CSS-цикл, чисто декоративные)
function SoftConfetti({ count = 10 }) {
  return (
    <span className="tm-confetti-soft" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <i key={i} style={{ "--i": i }} />
      ))}
    </span>
  );
}

// Позы маскота по фазам реакции и состояниям покоя
const POSE = {
  start: "idle", grow: "idle", near: "step", done: "top",
  notice: "notice", calc: "calc", drop: "drop", hop: "hop", receipt: "receipt",
};

// Цикл «жизни» в покое: маскот периодически меняет позы-кадры, как мультяшка.
// Для каждой стадии — своя последовательность (только живые позы, без «рабочих»).
const CYCLE = {
  start: ["idle", "step", "idle", "notice", "idle", "hop"],
  grow: ["idle", "step", "idle", "hop", "idle", "notice"],
  near: ["step", "idle", "hop", "step", "notice", "idle"],
  done: ["top", "hop", "top", "idle", "top", "step"],
};
const CYCLE_MS = 1900; // бодрый темп смены кадров

// Все картинки маскота — для предзагрузки (чтобы смена поз шла без мерцания)
const PRELOAD = [
  ...["idle", "step", "top", "notice", "calc", "drop", "hop", "receipt"].map((p) => "/mascot/pose-" + p + ".png"),
  ...["low", "mid", "high", "full"].map((j) => "/mascot/jar-" + j + ".png"),
  "/mascot/coin.png",
  "/mascot/receipt.png",
];

const TreasurerMascot = forwardRef(function TreasurerMascot(
  { collected = 0, goal = MASCOT_GOAL, compact = false },
  ref
) {
  const { pct, full } = computeProgress(collected, goal);
  const stage = stageFor(pct);

  // reaction: null | {kind:"coin"|"receipt", phase, label, amount}
  const [reaction, setReaction] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [say, setSay] = useState(stage.say);
  const [idlePose, setIdlePose] = useState(POSE[stage.key]); // текущий кадр цикла покоя

  const queue = useRef([]); // очередь событий (батчинг)
  const busy = useRef(false);
  const jobs = useRef(new Set());
  const reduced = useRef(false);
  const wasFull = useRef(full); // залп конфетти — только при НОВОМ достижении цели
  const pctRef = useRef(pct);
  pctRef.current = pct;

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => { jobs.current.delete(id); fn(); }, ms);
    jobs.current.add(id);
    return id;
  }, []);
  const clearJobs = useCallback(() => {
    jobs.current.forEach(clearTimeout);
    jobs.current.clear();
  }, []);

  // Возврат в состояние покоя по актуальному прогрессу
  const settle = useCallback(() => {
    setReaction(null);
    setSay(stageFor(pctRef.current).say);
    busy.current = false;
    // eslint-disable-next-line no-use-before-define
    later(() => pump(), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [later]);

  // Проигрывание одного события из очереди
  const play = useCallback((ev) => {
    busy.current = true;
    if (ev.type === "contribution") {
      const label = "+" + fmtByn(ev.amount) + " BYN" + (ev.child ? " · " + ev.child : "");
      if (reduced.current) {
        // без анимации: короткая статичная плашка
        setReaction({ kind: "coin", phase: "hop", label, amount: ev.amount });
        setSay("Взнос учтён!");
        later(settle, 1400);
        return;
      }
      // полная цепочка: заметил монетку → калькулятор → в банку → подскок
      setReaction({ kind: "coin", phase: "notice", label, amount: ev.amount });
      setSay("О, взнос!");
      later(() => setReaction((r) => r && { ...r, phase: "calc" }), 450);
      later(() => { setReaction((r) => r && { ...r, phase: "drop" }); setSay("В банку!"); }, 1100);
      later(() => { setReaction((r) => r && { ...r, phase: "hop" }); setSay("Спасибо!"); }, 1900);
      later(settle, 2500);
    } else {
      const label = (ev.category ? ev.category + " · " : "") + "−" + fmtByn(ev.amount) + " BYN";
      if (reduced.current) {
        setReaction({ kind: "receipt", phase: "stamp", label, amount: ev.amount });
        setSay("Учтено!");
        later(settle, 1400);
        return;
      }
      // расход: чек из калькулятора → печать «Учтено!» → подпись → возврат
      setReaction({ kind: "receipt", phase: "out", label, amount: ev.amount });
      setSay("Считаю расход…");
      later(() => setReaction((r) => r && { ...r, phase: "stamp" }), 800);
      later(() => setSay("Учтено!"), 800);
      later(settle, 2600);
    }
  }, [later, settle]);

  // Насос очереди: батчинг — несколько взносов подряд сливаются в один показ
  const pump = useCallback(() => {
    if (busy.current || document.hidden) return;
    const q = queue.current;
    if (!q.length) return;
    const first = q.shift();
    if (first.type === "contribution") {
      while (q.length && q[0].type === "contribution") {
        const nxt = q.shift();
        first.amount = (toCents(first.amount) + toCents(nxt.amount)) / 100;
        first.child = null; // объединённый показ — без имени
      }
    }
    play(first);
  }, [play]);

  // Приём события: дедупликация по id операции
  const receive = useCallback((ev) => {
    if (!ev || !ev.type || !(toCents(ev.amount) > 0)) return;
    const key = ev.id != null ? ev.type + ":" + ev.id : null;
    if (key) {
      if (seenIds.has(key)) return;
      seenIds.add(key);
    }
    queue.current.push({ ...ev });
    pump();
  }, [pump]);

  useImperativeHandle(ref, () => ({
    contribution: (e) => receive({ ...e, type: "contribution" }),
    expense: (e) => receive({ ...e, type: "expense" }),
  }), [receive]);

  // Шина window + reduced-motion + пауза в фоновой вкладке
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => { reduced.current = mq.matches; };
    mq.addEventListener?.("change", onMq);
    const onBus = (e) => receive(e.detail);
    window.addEventListener("tm-event", onBus);
    const onVis = () => {
      if (document.hidden) { clearJobs(); busy.current = false; setReaction(null); setConfetti(false); }
      else { setSay(stageFor(pctRef.current).say); pump(); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener?.("change", onMq);
      window.removeEventListener("tm-event", onBus);
      document.removeEventListener("visibilitychange", onVis);
      clearJobs();
    };
  }, [receive, pump, clearJobs]);

  // Предзагрузка всех кадров маскота — смена поз идёт мгновенно, без мерцания
  useEffect(() => {
    PRELOAD.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Цикл «жизни»: раз в ~1.9 c маскот меняет позу-кадр (пауза в фоне и при reduced-motion)
  useEffect(() => {
    setIdlePose(POSE[stage.key]);
    const seq = CYCLE[stage.key] || CYCLE.start;
    let i = 0;
    const t = setInterval(() => {
      if (reduced.current || document.hidden) return;
      i = (i + 1) % seq.length;
      setIdlePose(seq[i]);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [stage.key]);

  // Смена состояния при изменении прогресса + залп конфетти при новом достижении цели
  useEffect(() => {
    if (!busy.current) setSay(stage.say);
    if (full && !wasFull.current) {
      wasFull.current = true;
      if (!reduced.current && !document.hidden) {
        setConfetti(true);
        later(() => setConfetti(false), 2000);
      }
    }
    if (!full) wasFull.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, full]);

  const pose = reaction
    ? POSE[reaction.kind === "coin" ? reaction.phase : "receipt"] || "idle"
    : idlePose;

  // ===== Компактная версия (блок расходов на главной) =====
  if (compact) {
    return (
      <div className="tm tm-compact" data-pose={pose} data-stage={stage.key}>
        <div className="tm-c-art" aria-hidden="true">
          <SoftConfetti count={6} />
          <span className="tm-monster">
            <Pic key={pose} src={"/mascot/pose-" + pose + ".png"} className="tm-monster-img" fallback="🧸" />
          </span>
          {reaction?.kind === "receipt" && (
            <span className={"tm-receipt " + reaction.phase} aria-hidden="true">
              <Pic src="/mascot/receipt.png" className="tm-receipt-img" fallback="🧾" />
              {reaction.phase === "stamp" && <span className="tm-stamp">Учтено!</span>}
            </span>
          )}
        </div>
        <div className="tm-c-text" role="status" aria-live="polite">
          {reaction ? (
            <>
              <b>{reaction.kind === "receipt" ? "Учтено!" : "Взнос!"}</b>
              <span>{reaction.label}</span>
            </>
          ) : (
            <span className="muted">Казначей следит за каждым чеком</span>
          )}
        </div>
      </div>
    );
  }

  // ===== Полная сцена (карточка «Общая касса класса») =====
  return (
    <div className="tm tm-scene" data-pose={pose} data-stage={stage.key}>
      <div className="tm-stagebox" aria-hidden="true">
        {/* Мягкие постоянные конфетти на фоне */}
        <SoftConfetti count={10} />
        {/* Слой 1: неподвижная банка «Общее дело 1Г» с наполнением по прогрессу */}
        <Pic src={"/mascot/jar-" + JAR[stage.key] + ".png"} className="tm-jar-img" fallback="🫙" />
        {/* Слой 2: живой монстрик — прыгает и покачивается CSS-ом */}
        <span className="tm-monster">
          <Pic key={pose} src={"/mascot/pose-" + pose + ".png"} className="tm-monster-img" fallback="🧸" />
        </span>
        {/* Монетка при взносе */}
        {reaction?.kind === "coin" && (
          <span className={"tm-coin " + reaction.phase}>
            <Pic src="/mascot/coin.png" className="tm-coin-img" fallback="🪙" />
          </span>
        )}
        {/* Чек при расходе */}
        {reaction?.kind === "receipt" && (
          <span className={"tm-receipt " + reaction.phase}>
            <Pic src="/mascot/receipt.png" className="tm-receipt-img" fallback="🧾" />
            {reaction.phase === "stamp" && <span className="tm-stamp">Учтено!</span>}
          </span>
        )}
        {/* Залп конфетти при новом достижении цели */}
        {confetti && (
          <span className="tm-confetti">
            {Array.from({ length: 18 }).map((_, i) => (
              <i key={i} style={{ "--i": i }} />
            ))}
          </span>
        )}
      </div>
      <div className="tm-caption">
        <div className="tm-say" role="status" aria-live="polite">
          {say}
          {reaction && <span className="tm-say-sub">{reaction.label}</span>}
        </div>
        <div className="tm-progress">
          <div className="tm-bar"><i style={{ width: Math.min(100, pct).toFixed(1) + "%" }} /></div>
          <span className="tm-nums">
            {fmtByn(collected)} из {fmtByn(goal)} BYN · {Math.floor(pct)}%
          </span>
        </div>
      </div>
    </div>
  );
});

export default TreasurerMascot;
