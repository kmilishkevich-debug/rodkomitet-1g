"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ===== Маскот кабинета учителя: SVG-риг поверх растровых частей =====
//
// Сделано тем же способом, что и маскот на главной странице для родителей
// (см. components/ClassMascot.jsx). Разница с прежней реализацией
// принципиальная и видна глазом:
//
// Раньше движение приносил ролик — WebM 565 × 550 и анимированный WebP
// 380 × 370. На экране маскот занимает до 320 CSS-пикселей, то есть до 640
// физических точек на ретине. Ролики приходилось растягивать почти вдвое,
// да ещё поверх лежало сжатие с потерями: стоило маскоту шевельнуться, как
// он заметно мылился. Отсюда и был вопрос «почему такое плохое качество».
//
// Теперь кадр не хранится покадрово вообще. В /public лежат две части
// исходной картинки, нарезанные из того же файла, что и статичный кадр:
//
//   tm-body.webp — тело с блокнотом и очками, лапа с карандашом вырезана,
//                  подмышка достроена зеркальным клоном меха;
//   tm-arm.webp  — только карандаш и пушистая лапа, которая его держит.
//
// Обе части — 680 × 663 с прозрачным запасом сверху и справа: лапа
// вращается, и её нельзя обрезать краем холста. Полезное содержимое
// стоит со смещением (0, 40), поэтому ступни прижаты к нижнему краю,
// а левый край совпадает с холстом — ровно то, чего ждёт CSS
// (.tc-mascot-img{left:0;bottom:0}).
//
// Движение собирается из этих частей прямо в браузере: тело дышит,
// корпус наклоняется, лапа выводит карандашом строчку, веки опускаются.
// Ничего не сжимается и не растягивается — резкость ровно такая же,
// как у статичного кадра.
//
// ===== Разрешение битмапов =====
// Части нарезаны из исходника 1218 × 1292 и лежат в файлах размером
// 1224 × 1193 — ровно в 1.8 раза крупнее системы координат рига. SVG всё
// равно рисует их в 680 × 663 единицах (viewBox не менялся), поэтому ни
// одна константа ниже, ни строчка CSS от этого не зависят. Зато на ретине
// под каждую единицу приходится почти четыре исходных пикселя, и картинка
// перестала мылиться. Масштаб при нарезке — 1.001, то есть исходник лёг
// практически пиксель в пиксель, ничего не додумано интерполяцией.
//
// Отдельно про цвет: прежние части были заметно темнее исходника
// (мех rgb(215,123,160) против rgb(246,121,172)) — это терялось на моей
// стороне при сборке, а не добавлялось фильтром в CSS. Сейчас цвет взят
// из исходника как есть, без коррекции.
//
// ===== Геометрия (все числа измерены по файлу, не на глаз) =====
// Холст            680 × 663
// Тело             x 2…643, y 41…662
// Лапа с карандашом x 482…643, y 166…399
// Точка опоры (ступни, центр пятна касания)   324, 662
// Плечо — ось вращения лапы                   526, 377
// Линзы очков, внутренний просвет: левая  cx 289, cy 206, rx 37, ry 31
//                                  правая cx 379, cy 205, rx 35, ry 32
// Линзы чуть разного размера — это перспектива исходного рендера,
// поэтому радиусы храним у каждого глаза свои, а не общей парой.
//
// Тело продолжается на ~19 единиц вглубь под лапу: этот запас всегда
// закрыт лапой, но именно он не даёт щели, когда лапа отъезжает на ±6°.
//
// Как устроены глаза. В растре линзы нарисованы «спящими»: оранжевое
// стекло и тёмная дуга закрытого века. А эталонный рендер маскота
// (Новая папка/mascot-teacher-alpha.webp) смотрит открытыми глазами:
// сверху линзы остаётся оранжевый полумесяц, ниже — белок и крупный
// зрачок с двумя бликами. Поэтому риг рисует открытый глаз вектором
// ПОВЕРХ растра: белок закрывает нарисованную дугу целиком, геометрия
// снята с эталона. Моргание — оранжевое веко (той же заливки, что
// стекло) съезжает сверху и на 150 мс закрывает просвет; в этот момент
// глаз выглядит ровно как исходный растровый — швов нет ни в одном
// кадре. Зрачки при этом изредка переводят взгляд (на блокнот, на
// карандаш) — сдвиг маленький, ±4 единицы, чтобы не косить.
//
// Диапазоны поворота лапы вокруг плеча (проверено расчётом по углам
// habитbox лапы x 482…643, y 166…399, r до ластика ≈ 241):
//   вниз (по часовой)  — не дальше +6°, дальше ластик выходит за
//                        правый край холста;
//   вверх (против)     — безопасно как минимум до −25°, крайняя точка
//                        уходит влево и вверх, оставаясь в холсте.
// Поэтому «приветствие» машет карандашом вверх: качание −16°…−2°.

const CANVAS = { w: 680, h: 663 };
const BODY = "/tm-body.webp";
const ARM = "/tm-arm.webp";
const STILL = "/teacher-mascot.webp"; // запасной вариант, если части не открылись

const FEET = "324px 662px"; // ось дыхания и наклона
const SHOULDER = "526px 377px"; // ось лапы

const EYES = [
  { id: "l", cx: 289, cy: 206, rx: 37, ry: 31 },
  { id: "r", cx: 379, cy: 205, rx: 35, ry: 32 },
];

// Веко: прямоугольник с далеко уходящим вверх верхом (его всё равно
// обрежет эллипс) и чуть провисающим нижним краем — так закрытый глаз
// не выглядит отрезанным по линейке.
function lidPath({ cx, cy, rx, ry }) {
  const l = cx - rx - 4;
  const r = cx + rx + 4;
  const top = cy - ry - 90;
  const b = cy + ry - 2;
  const sag = cy + ry + 7;
  return `M${l} ${top}H${r}V${b}Q${cx} ${sag} ${l} ${b}Z`;
}
function lashPath({ cx, cy, rx, ry }) {
  const l = cx - rx - 4;
  const r = cx + rx + 4;
  const b = cy + ry - 2;
  const sag = cy + ry + 7;
  return `M${r} ${b}Q${cx} ${sag} ${l} ${b}`;
}
const LID_LIFT = -82; // на сколько веко поднято выше линзы в покое

// Открытый глаз: пропорции сняты с эталонного рендера. Белок чуть
// меньше линзы и опущен на 7 единиц — сверху остаётся оранжевый
// полумесяц. Зрачок — 62 % малого радиуса линзы, стоит на 6 единиц
// ниже центра, блики: крупный сверху-слева и точечный снизу-справа.
function OpenEye({ eye, gaze }) {
  const pr = Math.min(eye.rx, eye.ry) * 0.62;
  return (
    <>
      <ellipse
        cx={eye.cx}
        cy={eye.cy + 7}
        rx={eye.rx - 1.5}
        ry={eye.ry - 3}
        fill="#FDFBF7"
      />
      <ellipse
        cx={eye.cx}
        cy={eye.cy + 7}
        rx={eye.rx - 1.5}
        ry={eye.ry - 3}
        fill="none"
        stroke="rgba(150,70,20,.18)"
        strokeWidth="2"
      />
      <g
        style={{
          transform: `translate(${eye.cx + gaze.x}px, ${eye.cy + 6 + gaze.y}px)`,
          transition: "transform .45s cubic-bezier(.3,.8,.3,1)",
        }}
      >
        <circle r={pr} fill="url(#tm-pupil-fill)" />
        <circle cx={-pr * 0.34} cy={-pr * 0.36} r={pr * 0.3} fill="#fff" opacity=".95" />
        <circle cx={pr * 0.38} cy={pr * 0.42} r={pr * 0.12} fill="#fff" opacity=".7" />
      </g>
    </>
  );
}

export default function TeacherMascotRig({ phrase }) {
  const stageRef = useRef(null);
  const jobs = useRef(new Set());
  const busy = useRef(false);

  const [shown, setShown] = useState(false); // появление сцены — один раз
  const [onScreen, setOnScreen] = useState(false);
  const [calm, setCalm] = useState(false); // «меньше движения» в системе
  const [paused, setPaused] = useState(false); // человек нажал «пауза»
  const [failed, setFailed] = useState(false); // части не открылись

  const [blink, setBlink] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [writing, setWriting] = useState(false);
  const [waving, setWaving] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  const animated = !calm && !paused && onScreen && !failed;

  // — системная настройка «меньше движения», слушаем и на лету
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const apply = () => setCalm(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // — сцена появляется, когда попала на экран; тот же наблюдатель
  //   гасит движение, пока маскота не видно, поэтому он не отключается
  //   после первого срабатывания
  useEffect(() => {
    const el = stageRef.current;
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
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (calm) setShown(true);
  }, [calm]);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      jobs.current.delete(id);
      fn();
    }, ms);
    jobs.current.add(id);
    return id;
  }, []);

  // — хореография. Все крупные действия идут по очереди: busy-замок
  //   не даёт наклону и письму наложиться друг на друга, интервалы
  //   случайные, поэтому петля не читается как петля.
  useEffect(() => {
    if (!animated) {
      jobs.current.forEach(clearTimeout);
      jobs.current.clear();
      busy.current = false;
      setBlink(false);
      setTilt(0);
      setWriting(false);
      setWaving(false);
      setGaze({ x: 0, y: 0 });
      return;
    }

    // моргание раз в 4–8 с, иногда двойное
    const scheduleBlink = () => {
      later(() => {
        setBlink(true);
        later(() => {
          setBlink(false);
          if (Math.random() < 0.22) {
            later(() => {
              setBlink(true);
              later(() => {
                setBlink(false);
                scheduleBlink();
              }, 140);
            }, 170);
          } else scheduleBlink();
        }, 150);
      }, 4000 + Math.random() * 4000);
    };

    // общий каркас крупного действия: занять замок, сыграть, отпустить
    const scheduleAction = (minMs, maxMs, run, durMs) => {
      const plan = (delay) =>
        later(() => {
          if (busy.current) {
            plan(1600 + Math.random() * 1600);
            return;
          }
          busy.current = true;
          run(true);
          later(() => {
            run(false);
            later(() => {
              busy.current = false;
            }, 400);
            plan(minMs + Math.random() * (maxMs - minMs));
          }, durMs);
        }, delay);
      plan(minMs + Math.random() * (maxMs - minMs));
    };

    scheduleBlink();
    // наклон корпуса — ±1.4°, держится пару секунд
    scheduleAction(
      15000,
      25000,
      (on) => setTilt(on ? (Math.random() < 0.5 ? -1.4 : 1.4) : 0),
      2400
    );
    // строчка карандашом — 1,9 с, столько же длятся ключевые кадры
    scheduleAction(9000, 16000, (on) => setWriting(on), 1900);
    // приветственное махание — реже остальных, чтобы оставалось событием
    scheduleAction(24000, 40000, (on) => setWaving(on), 1700);
    // взгляд — вне busy-замка: он не мешает крупным действиям, глаза
    // могут коситься и во время письма. Изредка смотрит на блокнот
    // (влево-вниз) или на карандаш (вправо-вверх), пару секунд —
    // и обратно в камеру.
    const scheduleGaze = () => {
      later(() => {
        setGaze(Math.random() < 0.5 ? { x: -4, y: 2 } : { x: 4, y: -2 });
        later(() => {
          setGaze({ x: 0, y: 0 });
          scheduleGaze();
        }, 1600 + Math.random() * 1200);
      }, 7000 + Math.random() * 8000);
    };
    scheduleGaze();

    return () => {
      jobs.current.forEach(clearTimeout);
      jobs.current.clear();
      busy.current = false;
    };
  }, [animated, later]);

  // — отклик на тап/клик по маскоту: помашет карандашом и дважды
  //   моргнёт. Busy-замок хореографии не трогаем нарочно: ответ на
  //   прикосновение должен приходить сразу, а не «когда освобожусь».
  const greet = useCallback(() => {
    if (!animated || waving) return;
    setWaving(true);
    setBlink(true);
    later(() => setBlink(false), 150);
    later(() => setBlink(true), 330);
    later(() => setBlink(false), 470);
    later(() => setWaving(false), 1700);
  }, [animated, waving, later]);

  const lines = Array.isArray(phrase) ? phrase : phrase ? [phrase] : [];
  const canPause = !calm && !failed;

  return (
    <div className="tc-scene">
      <div className={"tc-stage" + (shown ? " is-in" : "")} ref={stageRef}>
        <div className="tc-mascot-shadow" aria-hidden="true" />

        {failed ? (
          <img
            className="tc-mascot-img"
            src={STILL}
            alt=""
            width={650}
            height={623}
            decoding="async"
          />
        ) : (
          <svg
            className={"tc-mascot-img tm-svg" + (animated ? " is-live" : "")}
            viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
            width={CANVAS.w}
            height={CANVAS.h}
            role="img"
            aria-hidden="true"
            onClick={greet}
            style={animated ? { cursor: "pointer" } : undefined}
          >
            <defs>
              {/* Заливка века снята пипеткой с новой, неперетемнённой картинки:
                  вертикальный профиль внутри левой линзы (cx 289, cy 206),
                  шаг 4 единицы от y=181 до y=229 —
                    181 (242,116, 77)   201 (241,127, 60)   217 (249,127, 55)
                    185 (248,138, 85)   209 (228,105, 52)   221 (245,120, 53)
                    189 (250,148, 81)   213 (246,130, 53)   225 (236,107, 54)
                    193 (250,149, 78)                       229 (224, 89, 55)
                    197 (250,149, 72)
                  Прежние стопы (#E98F4A → #DE8039 → #C2662C) снимались со старых,
                  потемневших частей и теперь дали бы шов при каждом моргании. */}
              <linearGradient
                id="tm-lid-fill"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="164"
                x2="0"
                y2="246"
              >
                <stop offset="0" stopColor="#F79A4E" />
                <stop offset=".32" stopColor="#FA9451" />
                <stop offset=".50" stopColor="#F17F3C" />
                <stop offset=".65" stopColor="#F98235" />
                <stop offset=".82" stopColor="#E05937" />
                <stop offset="1" stopColor="#CF4C33" />
              </linearGradient>
              {/* Зрачок: не плоский чёрный круг, а сфера со смещённым к
                  верхнему блику светом — так он выглядит на эталонном
                  рендере (Новая папка/mascot-teacher-alpha.webp). */}
              <radialGradient id="tm-pupil-fill" cx=".38" cy=".32" r=".85">
                <stop offset="0" stopColor="#4A4A52" />
                <stop offset=".45" stopColor="#23232A" />
                <stop offset="1" stopColor="#0C0C12" />
              </radialGradient>
              {EYES.map((e) => (
                <clipPath key={e.id} id={`tm-lens-${e.id}`}>
                  <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} />
                </clipPath>
              ))}
            </defs>

            <g className="tm-rig" style={{ transformOrigin: FEET }}>
              <g
                className="tm-tilt"
                style={{
                  transform: `rotate(${tilt}deg)`,
                  transformOrigin: FEET,
                }}
              >
                <image
                  href={BODY}
                  x="0"
                  y="0"
                  width={CANVAS.w}
                  height={CANVAS.h}
                  onError={() => setFailed(true)}
                />

                {/* Обрезка и движение — на РАЗНЫХ узлах, и это принципиально.
                    В SVG трансформация элемента применяется и к его clip-path:
                    если повесить clipPath и translateY на один <g>, эллипс
                    линзы уезжает вместе с веком, веко остаётся «внутри» клипа
                    и в покое видно двумя оранжевыми кругами над очками —
                    ровно тот баг, что был на экране. Поэтому обрезает внешний
                    <g> (он неподвижен, эллипс стоит на линзе), а двигается
                    внутренний. */}
                {EYES.map((e) => (
                  <g key={e.id} clipPath={`url(#tm-lens-${e.id})`}>
                    <OpenEye eye={e} gaze={gaze} />
                    <g
                      style={{
                        transform: `translateY(${blink ? 0 : LID_LIFT}px)`,
                        transition: `transform ${blink ? 110 : 150}ms ease-out`,
                      }}
                    >
                      <path d={lidPath(e)} fill="url(#tm-lid-fill)" />
                      <path
                        d={lashPath(e)}
                        fill="none"
                        stroke="rgba(120,52,20,.38)"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                ))}

                <g
                  className={
                    "tm-arm" +
                    (writing ? " is-writing" : "") +
                    (waving ? " is-waving" : "")
                  }
                  style={{ transformOrigin: SHOULDER }}
                >
                  <image
                    href={ARM}
                    x="0"
                    y="0"
                    width={CANVAS.w}
                    height={CANVAS.h}
                    onError={() => setFailed(true)}
                  />
                </g>
              </g>
            </g>
          </svg>
        )}

        {!!lines.length && (
          <div className="tc-cloud" aria-hidden="true">
            <span className="tc-cloud-text">
              {lines.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </span>
          </div>
        )}

        {canPause && (
          <button
            type="button"
            className="tc-mascot-pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Возобновить анимацию" : "Приостановить анимацию"}
            title={paused ? "Возобновить анимацию" : "Приостановить анимацию"}
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
