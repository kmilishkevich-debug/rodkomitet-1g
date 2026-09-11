"use client";
import { useState, useEffect, useRef } from "react";
import { MascotMood } from "./Art";

/*
  Окно подтверждения выхода с эмоциональным маскотом.
  Наводишь на «Пока-пока» — маскот грустнеет, на «Я ещё побуду!» — улыбается.
  «Пока-пока»: секундка грусти со слёзкой и «До встречи!» → выход.
  «Я ещё побуду!»: радостный прыжок → окно мягко закрывается само.
*/
export default function LogoutModal({ open, onStay, onLeave }) {
  const [mood, setMood] = useState("wait"); // wait | sad | happy
  const [phase, setPhase] = useState("ask"); // ask | leaving | staying
  const timer = useRef(null);

  useEffect(() => {
    if (open) {
      setMood("wait");
      setPhase("ask");
    }
    return () => clearTimeout(timer.current);
  }, [open]);

  if (!open) return null;

  const asking = phase === "ask";
  const hover = (m) => () => asking && setMood(m);
  const unhover = () => asking && setMood("wait");

  const leave = () => {
    if (!asking) return;
    setPhase("leaving");
    setMood("sad");
    timer.current = setTimeout(onLeave, 1300);
  };

  const stay = () => {
    if (!asking) return;
    setPhase("staying");
    setMood("happy");
    timer.current = setTimeout(onStay, 800);
  };

  return (
    <div className="overlay" onClick={asking ? stay : undefined}>
      <div className="modal logout-modal" onClick={(e) => e.stopPropagation()}>
        <MascotMood mood={mood} />
        <h3>
          {phase === "leaving" ? "До встречи!" : phase === "staying" ? "Ура, вы остаётесь!" : "Уже уходите?"}
        </h3>
        <div className="muted">
          {phase === "leaving"
            ? "Возвращайтесь скорее…"
            : phase === "staying"
            ? "Правильное решение!"
            : "Мы будем скучать! Выйти из приложения?"}
        </div>
        {asking && (
          <div className="actions logout-actions">
            <button
              className="btn small white"
              onMouseEnter={hover("sad")}
              onMouseLeave={unhover}
              onFocus={hover("sad")}
              onBlur={unhover}
              onTouchStart={hover("sad")}
              onClick={leave}
            >
              Пока-пока
            </button>
            <button
              className="btn small"
              onMouseEnter={hover("happy")}
              onMouseLeave={unhover}
              onFocus={hover("happy")}
              onBlur={unhover}
              onTouchStart={hover("happy")}
              onClick={stay}
            >
              Я ещё побуду!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
