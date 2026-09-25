"use client";

// ===== Пушистый помощник кабинета учителя =====
// Розовый маскот с блокнотом и карандашом. Построен так же, как маскот
// на главной странице родителей (components/ClassMascot.jsx): готовые
// растровые кадры + JS-таймеры, без тяжёлых видео и без SVG-рига.
//
// Кадры лежат в /public/rk-mascot и заранее нормализованы на общий
// квадратный холст 1024 × 1024 (рост персонажа 940, ступни на y = 1000,
// якорь низ-центр) — поэтому свапы поз не «прыгают» по земле:
//   rm-base.webp  — стоит, глаза открыты (основной кадр);
//   rm-blink.webp — маленькая накладка только с закрытыми глазами,
//                   растушёванная по краям: ложится поверх базового
//                   кадра, шов не виден (позиция задана в globals.css);
//   rm-write.webp — пишет в блокноте, смотрит вниз (полный кадр);
//   rm-happy.webp — зажмурился от радости (полный кадр, реакция на тап).
//
// Поведение (по брифу Кристины, темп «живой, заметный»):
//   — дыхание и лёгкое покачивание — непрерывно, чистый CSS (rm-breathe);
//   — моргание каждые 2,6–5,2 с, иногда двойное;
//   — каждые 6–11 с на пару секунд записывает что-то в блокнот
//     (кадр rm-write + мелкое ёрзанье rm-scribble);
//   — тап/клик — радуется: rm-happy, подпрыгивание, реплика в облачке.
//
// Уважает prefers-reduced-motion (статичная картинка) и останавливает
// все таймеры, когда вкладка скрыта.

import { useCallback, useEffect, useRef, useState } from "react";

const F = {
  base: "/rk-mascot/rm-base.webp",
  blink: "/rk-mascot/rm-blink.webp",
  write: "/rk-mascot/rm-write.webp",
  happy: "/rk-mascot/rm-happy.webp",
};

// Реплика в облачке. Строки заданы явно (по одной в <span>), потому что
// .tc-cloud-text не переносит текст сам — так строки не вылезают из облака.
const IDLE_PHRASE = ["Всё важное —", "запишу!"];
// Ответы на тап — по кругу, чтобы не повторяться два раза подряд.
const TAP_PHRASES = [
  ["Как я рада", "вас видеть!"],
  ["Отличный", "будет день!"],
  ["Ура!", "За работу!"],
];

export default function TeacherPlush() {
  const [shown, setShown] = useState(false);   // базовый кадр загружен
  const [failed, setFailed] = useState(false); // кадр не загрузился — без сцены
  const [pose, setPose] = useState("base");    // base | write | happy
  const [blink, setBlink] = useState(false);
  const [phrase, setPhrase] = useState(IDLE_PHRASE);

  const jobs = useRef(new Set());     // все живые таймеры
  const busy = useRef(false);         // идёт крупное действие (письмо/радость)
  const reduced = useRef(false);      // prefers-reduced-motion
  const tapIndex = useRef(0);         // какая реплика тапа следующая

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      jobs.current.delete(id);
      fn();
    }, ms);
    jobs.current.add(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    jobs.current.forEach(clearTimeout);
    jobs.current.clear();
  }, []);

  const rnd = (a, b) => a + Math.random() * (b - a);

  // — моргание: только в базовой позе, живой темп, иногда двойное —
  const blinkLoop = useCallback(function loop() {
    later(() => {
      setBlink(true);
      later(() => {
        setBlink(false);
        // двойное моргание примерно в каждом шестом случае
        if (Math.random() < 0.16) {
          later(() => {
            setBlink(true);
            later(() => setBlink(false), 130);
          }, 140);
        }
      }, 160);
      loop();
    }, rnd(2600, 5200));
  }, [later]);

  // — письмо в блокноте: свап кадра на 2–2,6 с —
  const writeLoop = useCallback(function loop() {
    later(() => {
      if (!busy.current) {
        busy.current = true;
        setBlink(false);
        setPose("write");
        later(() => {
          setPose("base");
          busy.current = false;
        }, rnd(2000, 2600));
      }
      loop();
    }, rnd(6000, 11000));
  }, [later]);

  const startLoops = useCallback(() => {
    if (reduced.current) return;
    blinkLoop();
    writeLoop();
  }, [blinkLoop, writeLoop]);

  // — реакция на тап: радость + подпрыгивание + реплика —
  const onTap = useCallback(() => {
    if (reduced.current || busy.current) return;
    busy.current = true;
    setBlink(false);
    setPose("happy");
    setPhrase(TAP_PHRASES[tapIndex.current % TAP_PHRASES.length]);
    tapIndex.current += 1;
    later(() => {
      setPose("base");
      busy.current = false;
      // реплика возвращается чуть позже, чем поза, — успевает дочитаться
      later(() => setPhrase(IDLE_PHRASE), 900);
    }, 2100);
  }, [later]);

  const onKey = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  }, [onTap]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;

    // предзагрузка всех кадров: свапы происходят мгновенно, без белых вспышек
    let alive = true;
    const imgs = Object.values(F).map((src) => {
      const im = new Image();
      im.src = src;
      return im;
    });
    imgs[0].onload = () => {
      if (!alive) return;
      setShown(true);
      startLoops();
    };
    imgs[0].onerror = () => alive && setFailed(true);
    // если base уже в кэше, onload мог не сработать
    if (imgs[0].complete && imgs[0].naturalWidth > 0) {
      setShown(true);
      startLoops();
    }

    // вкладка скрыта — таймеры полностью останавливаются
    const onVis = () => {
      if (document.hidden) {
        clearAll();
        busy.current = false;
        setBlink(false);
        setPose("base");
      } else {
        startLoops();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const onMq = () => {
      reduced.current = mq.matches;
      if (mq.matches) {
        clearAll();
        busy.current = false;
        setBlink(false);
        setPose("base");
      } else {
        startLoops();
      }
    };
    mq.addEventListener?.("change", onMq);

    return () => {
      alive = false;
      clearAll();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener?.("change", onMq);
    };
  }, [startLoops, clearAll]);

  if (failed) return null;

  return (
    <div className="tc-scene">
      <div className={"tc-stage" + (shown ? " is-in" : "")}>
        <div className="tc-mascot-shadow" aria-hidden="true" />

        <div
          className="rm-canvas"
          role="button"
          tabIndex={0}
          aria-label="Пушистый помощник класса — нажмите, и он обрадуется"
          onClick={onTap}
          onKeyDown={onKey}
        >
          <div className="rm-rig">
            <div
              className={
                "rm-pose" +
                (pose === "write" ? " is-writing" : "") +
                (pose === "happy" ? " is-happy" : "")
              }
            >
              {/* базовый кадр остаётся в потоке всегда — он держит размер */}
              <img
                className="rm-frame"
                src={F.base}
                alt=""
                draggable="false"
                style={{ opacity: pose === "base" ? 1 : 0 }}
              />
              <img
                className="rm-frame"
                src={F.write}
                alt=""
                draggable="false"
                style={{ opacity: pose === "write" ? 1 : 0 }}
              />
              <img
                className="rm-frame"
                src={F.happy}
                alt=""
                draggable="false"
                style={{ opacity: pose === "happy" ? 1 : 0 }}
              />
              {/* накладка закрытых глаз — только поверх базовой позы */}
              <img
                className="rm-blink"
                src={F.blink}
                alt=""
                draggable="false"
                style={{ opacity: blink && pose === "base" ? 1 : 0 }}
              />
            </div>
          </div>
        </div>

        <div className="tc-cloud" aria-hidden="true">
          <span className="tc-cloud-text">
            {phrase.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
