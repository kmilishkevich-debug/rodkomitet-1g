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

// ===== Анимация =====
// Маскот двигается во всех браузерах. Формат один и тот же ролик в двух
// упаковках, и человеку достаётся ровно одна из них — не обе.
//
// teacher-mascot.webm — VP9 с настоящим альфа-каналом (alpha_mode=1),
// 565 × 550, 6,3 с, 25 кадров в секунду, 1,2 МБ. Это Chrome, Firefox, Edge,
// Яндекс.Браузер.
//
// teacher-mascot-anim.webp — анимированный WebP с альфой, 380 × 370, 3,1 с,
// те же 25 кадров в секунду, 1,3 МБ. Это Safari и вообще всё на движке
// WebKit, включая любые браузеры на iPhone и iPad.
//
// Почему не один ролик на всех: WebKit проигрывает VP9, но альфу в нём не
// показывает — на кремовом фоне вышел бы тёмный прямоугольник, ровно то,
// чего просили избежать. А WebP-анимация в весе сильно проигрывает видео:
// у маскота шевелится весь силуэт сразу, межкадровая разница почти равна
// целому кадру, и экономить там не на чем. Поэтому для WebKit ролик вдвое
// короче и чуть меньше по холсту — так он укладывается в тот же вес, что и
// WebM, и остаётся плавным.
//
// Оба ролика собраны «туда и обратно»: маскот поднимает блокнот, пишет
// карандашом, потом опускает. В исходнике на возврате был жёсткий склеенный
// стык — его убрали, проиграв середину в обратную сторону, поэтому петля
// бесшовная с обоих концов.
const CLIP = { webm: "/teacher-mascot.webm", webp: "/teacher-mascot-anim.webp" };

// Статичный кадр: постер для видео и единственная картинка, когда человек
// попросил «меньше движения» или нажал паузу. Пропорции 640/623 совпадают
// с холстом роликов 565/550 и 380/370 до третьего знака, поэтому при старте
// анимации ничего не прыгает.
const STILL = "/teacher-mascot.webp";
const RATIO = { w: 565, h: 550 };

export default function TeacherMascotScene({ phrase }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [shown, setShown] = useState(false);   // появление сцены — один раз
  const [onScreen, setOnScreen] = useState(false); // видна ли сейчас
  const [calm, setCalm] = useState(false);     // «меньше движения» в системе
  const [paused, setPaused] = useState(false); // человек нажал «пауза»
  const [mode, setMode] = useState("still");   // still | video | loop
  const [clipFailed, setClipFailed] = useState(false); // WebM не поехал

  // На сервере и в первую отрисовку — статичная картинка. Её видят поисковики
  // и браузер без JS, и на ней же нет расхождения разметки при гидратации.
  // Дальше выбираем упаковку ролика под конкретный движок.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    // canPlayType умеет ответить только про кодек и молчит про альфу, а вся
    // разница именно в ней. Поэтому WebKit опознаём по агенту: на iOS любой
    // браузер — это WebKit, на macOS — Safari без чужой подписи в строке.
    const webkit =
      /\b(iPad|iPhone|iPod)\b/.test(ua) ||
      (/Safari\//.test(ua) &&
        !/(Chrome|Chromium|CriOS|FxiOS|Edg|OPR|YaBrowser)\//.test(ua));
    if (webkit) {
      setMode(CLIP.webp ? "loop" : "still");
      return;
    }
    const probe = document.createElement("video");
    const ok = probe.canPlayType?.('video/webm; codecs="vp9"');
    const canVideo = ok === "probably" || ok === "maybe";
    setMode(canVideo && CLIP.webm ? "video" : CLIP.webp ? "loop" : "still");
  }, []);

  // Уважаем системную настройку и слушаем её изменения на лету.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const apply = () => setCalm(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Облачко появляется, когда сцена попала на экран, — и только один раз.
  // Тот же наблюдатель отвечает за то, чтобы ролик не крутился вхолостую
  // за пределами экрана, поэтому он не отключается после первого срабатывания.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        setOnScreen(visible);
        if (visible) setShown(true);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Если человек попросил «меньше движения» — показываем сразу, без ожидания.
  useEffect(() => {
    if (calm) setShown(true);
  }, [calm]);

  // Ролик играет, только когда сцена на экране и паузу не нажимали.
  // Если WebM не поехал — файла нет, кодек не взял, автозапуск заблокировали —
  // маскот не имеет права замереть на постере: он уходит на WebP-петлю,
  // ту же самую, что показывается в Safari.
  const animated = !calm && mode !== "still";
  const useVideo = animated && mode === "video" && !clipFailed;
  const useLoop =
    animated && (mode === "loop" || (mode === "video" && clipFailed));
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (onScreen && !paused) v.play?.().catch(() => setClipFailed(true));
    else v.pause?.();
  }, [useVideo, onScreen, paused]);

  // Сторож: если через 2,5 секунды на экране видео так и не начало играть —
  // считаем, что оно не поедет, и переключаемся на WebP. Сюда попадают тихие
  // отказы, о которых браузер не сообщает событием error: пустой ответ сервера,
  // запрет автозапуска, застрявшее декодирование.
  useEffect(() => {
    if (!useVideo || !onScreen || paused) return;
    const t = setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      if (v.readyState < 2 || v.paused || v.currentTime === 0) setClipFailed(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [useVideo, onScreen, paused]);

  // Текст облачка приходит строками — переносим ровно там, где просили.
  const lines = Array.isArray(phrase) ? phrase : phrase ? [phrase] : [];

  return (
    <div className="tc-scene">
      <div className={"tc-stage" + (shown ? " is-in" : "")} ref={ref}>
        <div className="tc-mascot-shadow" aria-hidden="true" />

        {useVideo ? (
          <video
            ref={videoRef}
            className="tc-mascot-img"
            width={RATIO.w}
            height={RATIO.h}
            poster={STILL}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
            onError={() => setClipFailed(true)}
            onStalled={() => setClipFailed(true)}
          >
            <source
              src={CLIP.webm}
              type="video/webm"
              onError={() => setClipFailed(true)}
            />
          </video>
        ) : (
          // Анимированный WebP крутится сам, остановить его можно только
          // подменой кадра — на паузе показываем ту же статичную картинку.
          <img
            className="tc-mascot-img"
            src={useLoop && !paused ? CLIP.webp : STILL}
            alt=""
            width={RATIO.w}
            height={RATIO.h}
            decoding="async"
            onError={(e) => {
              // Петли нет или она не открылась — показываем статичный кадр,
              // но не пустую рамку.
              if (e.currentTarget.src.indexOf(STILL) === -1)
                e.currentTarget.src = STILL;
            }}
          />
        )}

        {!!lines.length && (
          <div className="tc-cloud" aria-hidden="true">
            <span className="tc-cloud-text">
              {lines.map((l, i) => <span key={i}>{l}</span>)}
            </span>
          </div>
        )}

        {animated && (
          <button
            type="button"
            className="tc-mascot-pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Включить анимацию" : "Остановить анимацию"}
            title={paused ? "Включить анимацию" : "Остановить анимацию"}
          >
            {paused ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5h2.4v14H9zM12.6 5H15v14h-2.4z" fill="currentColor" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
