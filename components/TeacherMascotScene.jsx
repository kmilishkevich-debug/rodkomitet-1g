"use client";
import { useEffect, useRef, useState } from "react";

// ===== Сцена маскота: три самостоятельных слоя =====
// .tc-stage — коробка сцены. Её размеры считаются от одной переменной
// --tc-mascot-h, поэтому сцена целиком масштабируется и при любой ширине
// окна остаётся видимой.
//
// Внутри — три отдельных элемента, каждый со своей геометрией:
//   1. .tc-mascot-shadow — мягкая тень под ступнями;
//   2. .tc-mascot-img    — сам персонаж с блокнотом и карандашом;
//   3. .tc-cloud         — облачко реплики, справа и выше головы.
//
// Место под выступающую часть сцены зарезервировано в потоке страницы:
// .tc-welcome получает верхний отступ, равный выносу. z-index здесь
// отвечает только за порядок слоёв внутри сцены, а не за то,
// чтобы «пролезть» поверх соседей.
//
// Этап 2: вместо <img> сюда встанет <video> тех же пропорций —
// разметка и размеры уже рассчитаны, экран не «прыгнет».

export default function TeacherMascotScene({ phrase }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  // Облачко появляется, когда сцена попала на экран, — и только один раз.
  // Если человек попросил систему «меньше движения», показываем сразу.
  useEffect(() => {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (calm) { setShown(true); return; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Текст облачка приходит строками — переносим ровно там, где просили.
  const lines = Array.isArray(phrase) ? phrase : phrase ? [phrase] : [];

  return (
    <div className="tc-scene">
      <div className={"tc-stage" + (shown ? " is-in" : "")} ref={ref}>
        <div className="tc-mascot-shadow" aria-hidden="true" />

        <img
          className="tc-mascot-img"
          src="/teacher-mascot.webp"
          alt=""
          width="640"
          height="623"
          decoding="async"
        />

        {!!lines.length && (
          <div className="tc-cloud" aria-hidden="true">
            <span className="tc-cloud-text">
              {lines.map((l, i) => <span key={i}>{l}</span>)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
