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
// Как устроено моргание. В линзе уже нарисовано приспущенное оранжевое
// веко — верхняя половина просвета. Риг добавляет поверх ещё одно веко
// той же заливки, обрезанное эллипсом линзы. В покое оно поднято выше
// линзы и не видно вовсе: работает оригинальный рисунок. На моргании
// веко съезжает вниз и закрывает просвет целиком. Поэтому шва между
// растром и вектором не возникает ни в одном кадре — совпадать цветам
// нужно только те 150 мс, пока глаз закрыт.
//
// Безопасный диапазон поворота лапы — ±6°: дальше ластик карандаша
// выходит за правый край холста (проверено расчётом по углам).

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

    return () => {
      jobs.current.forEach(clearTimeout);
      jobs.current.clear();
      busy.current = false;
    };
  }, [animated, later]);

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

                {EYES.map((e) => (
                  <g
                    key={e.id}
                    clipPath={`url(#tm-lens-${e.id})`}
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
                ))}

                <g
                  className={"tm-arm" + (writing ? " is-writing" : "")}
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
