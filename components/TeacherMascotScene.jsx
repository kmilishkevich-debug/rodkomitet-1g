"use client";
import { useEffect, useRef, useState } from "react";

// ===== Маскот кабинета с облаком =====
// Этап 1: статичная картинка с прозрачным фоном (фон снят с видео учителя).
// Этап 2: сюда же встанет видео WebM с альфа-каналом — разметка и размеры
// уже рассчитаны под него, поэтому экран не «прыгнет» при замене.
//
// Слои внутри сцены: тень (1) → маскот (2) → облако (3).
// Место под картинку зарезервировано через aspect-ratio, чтобы карточка
// не дёргалась, пока файл грузится.

export default function TeacherMascotScene({ phrase }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  // Облако появляется, когда карточка попала на экран, — и только один раз.
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
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={"tc-mascot" + (shown ? " is-in" : "")} ref={ref}>
      <div className="tc-mascot-shadow" aria-hidden="true" />
      <img
        className="tc-mascot-img"
        src="/teacher-mascot.webp"
        alt=""
        width="640"
        height="623"
        decoding="async"
      />
      {phrase && <div className="tc-cloud">{phrase}</div>}
    </div>
  );
}
