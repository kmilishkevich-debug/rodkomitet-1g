"use client";
// Анимированный маскот класса 1 «Г» (ТЗ §5–6).
// Растровые части (тело и рука со стаканом) лежат в /public как WebP,
// поверх — SVG-риг: маски, глаза со зрачками, рот.
// Маскот движется сам после загрузки: дыхание (CSS), моргание 4–8 с,
// перевод взгляда 8–14 с, наклон корпуса 15–25 с, подъём стакана 25–40 с.
// Крупные действия идут последовательно (busy-замок), интервалы случайные.
// Два жёлтых облачка видны ПОСТОЯННО: верхнее — короткая реакция, основное —
// реплика по реальным данным (cues); тексты сменяются каждые ~12–18 с без
// исчезновения облачек, hover/фокус приостанавливают смену.
// Реплика с действием — облачко-кнопка. prefers-reduced-motion отключает
// декоративное движение. При скрытой вкладке таймеры останавливаются.
// Если растровые части не загрузились — статичная резервная поза.
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

// Приветствие показываем один раз за открытие сайта (модульная переменная
// живёт, пока страница не перезагружена; после ручного входа page.jsx
// увеличивает greetToken — и приветствие срабатывает снова).
let greetedToken = 0;

const NEUTRAL_CUE = { top: "Я рядом!", text: "Я собрал всё важное здесь" };

const ClassMascot = forwardRef(function ClassMascot({ cues, greetToken = 0, allDone = false }, ref) {
  const [state, setState] = useState("idle");
  const [blink, setBlink] = useState(false);
  const [failed, setFailed] = useState(false);
  // Облачка
  const [topMsg, setTopMsg] = useState("");
  const [mainCue, setMainCue] = useState(null); // {text, action?}
  const [mainShown, setMainShown] = useState(false);
  // Микродвижения (JS-таймеры поверх CSS-дыхания)
  const [gaze, setGaze] = useState(null); // {x,y} сдвиг зрачков
  const [tilt, setTilt] = useState(0); // наклон корпуса, градусы
  const [cupUp, setCupUp] = useState(false); // поднять стакан

  const jobs = useRef(new Set());
  const reduced = useRef(false);
  const hoverRef = useRef(false); // hover/фокус: не менять реплику
  const busyRef = useRef(false); // крупное действие уже идёт
  const overrideRef = useRef(false); // greet/happy/sad перекрывают цикл
  const cueIdx = useRef(0);
  const cuesRef = useRef([NEUTRAL_CUE]);
  cuesRef.current = cues && cues.length ? cues : [NEUTRAL_CUE];

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      jobs.current.delete(id);
      fn();
    }, ms);
    jobs.current.add(id);
    return id;
  }, []);

  const clear = useCallback(() => {
    jobs.current.forEach(clearTimeout);
    jobs.current.clear();
    busyRef.current = false;
    setBlink(false);
    setGaze(null);
    setTilt(0);
    setCupUp(false);
  }, []);

  // --- Моргание: каждые 4–8 секунд ---
  const scheduleBlink = useCallback(() => {
    if (reduced.current) return;
    later(() => {
      setBlink(true);
      later(() => {
        setBlink(false);
        scheduleBlink();
      }, 160);
    }, 4000 + Math.random() * 4000);
  }, [later]);

  // --- Крупные действия: последовательно, с вариативными паузами ---
  // Каждый цикл сам себя перепланирует; если другое действие идёт — ждём.
  const scheduleAction = useCallback(
    (minMs, maxMs, run, durMs) => {
      const plan = (delay) =>
        later(() => {
          if (reduced.current) return;
          if (busyRef.current || overrideRef.current) {
            plan(1800 + Math.random() * 1600); // занят — попробуем чуть позже
            return;
          }
          busyRef.current = true;
          run(true);
          later(() => {
            run(false);
            later(() => {
              busyRef.current = false;
            }, 400);
            plan(minMs + Math.random() * (maxMs - minMs));
          }, durMs);
        }, delay);
      plan(minMs + Math.random() * (maxMs - minMs));
    },
    [later]
  );

  const startMicro = useCallback(() => {
    if (reduced.current) return;
    scheduleBlink();
    // Перевод взгляда: 8–14 с
    scheduleAction(8000, 14000, (on) => {
      setGaze(on ? { x: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 7), y: Math.random() * 6 } : null);
    }, 1500 + Math.random() * 800);
    // Наклон корпуса: 15–25 с
    scheduleAction(15000, 25000, (on) => {
      setTilt(on ? (Math.random() < 0.5 ? -1 : 1) * 1.6 : 0);
    }, 2300);
    // Поднять стакан: 25–40 с
    scheduleAction(25000, 40000, (on) => {
      setCupUp(on);
    }, 1900);
  }, [scheduleBlink, scheduleAction]);

  // --- Взгляд на родителя при появлении основной реплики ---
  const lookAtParent = useCallback(() => {
    if (reduced.current) return;
    setGaze({ x: 2, y: -4 });
    later(() => setGaze(null), 1700);
  }, [later]);

  // --- Цикл основного облачка: облачка видны всегда, тексты сменяются
  // каждые ~12–18 с (если реплик несколько), без исчезновения ---
  const cycle = useCallback(() => {
    if (overrideRef.current) return;
    const list = cuesRef.current;
    const cue = list[cueIdx.current % list.length];
    setTopMsg(cue.top || "Я рядом!");
    setMainCue(cue);
    setMainShown(true);
    lookAtParent();
    const next = () => {
      if (hoverRef.current) {
        later(next, 2000); // наведён курсор/фокус — не менять реплику
        return;
      }
      cueIdx.current += 1;
      cycle();
    };
    later(next, 12000 + Math.random() * 6000);
  }, [later, lookAtParent]);

  // --- Полный запуск (после загрузки или возвращения на вкладку) ---
  const startAll = useCallback(() => {
    clear();
    if (reduced.current) {
      // Без декоративного движения: показываем самую важную реплику статично
      const cue = cuesRef.current[0];
      setTopMsg(cue.top || "Я рядом!");
      setMainCue(cue);
      setMainShown(true);
      return;
    }
    startMicro();
    later(cycle, 600);
  }, [clear, startMicro, cycle, later]);
  const startAllRef = useRef(startAll);
  startAllRef.current = startAll;

  // --- Временные состояния (приветствие, радость, грусть) поверх цикла ---
  const transient = useCallback(
    (st, text, dur) => {
      clear();
      overrideRef.current = true;
      setState(st);
      setTopMsg(cuesRef.current[0]?.top || "Я рядом!");
      setMainCue({ text });
      setMainShown(false);
      later(() => setMainShown(true), st === "greeting" ? 1500 : 120);
      if (dur) {
        later(() => {
          overrideRef.current = false;
          setState("idle");
          setMainShown(false);
          startAllRef.current();
        }, dur);
      }
      if (!reduced.current) scheduleBlink();
    },
    [clear, later, scheduleBlink]
  );

  const greet = useCallback(() => transient("greeting", "Привет! Кофе готов, дела тоже", 4600), [transient]);
  const success = useCallback(() => transient("happy", "Готово, спасибо!", 3600), [transient]);
  const sad = useCallback(() => transient("sad", "Уже уходишь? Буду ждать тебя", 0), [transient]);
  const stay = useCallback(() => transient("happy", "Ура, ты остаёшься!", 3600), [transient]);
  const done = useCallback(() => transient("done", "На сегодня всё! Можно выдохнуть", 4200), [transient]);
  const idle = useCallback(() => {
    overrideRef.current = false;
    setState("idle");
    startAllRef.current();
  }, []);

  useImperativeHandle(ref, () => ({ greet, success, done, sad, stay, idle }), [greet, success, done, sad, stay, idle]);

  // Монтирование: reduced-motion и остановка при скрытой вкладке
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => {
      reduced.current = mq.matches;
      startAllRef.current();
    };
    mq.addEventListener?.("change", onMq);
    const onVisibility = () => {
      if (document.hidden) {
        clear(); // стоп всем таймерам — очередь не копится
      } else {
        overrideRef.current = false;
        setState("idle");
        startAllRef.current(); // свежий цикл, без «догоняющих» реплик
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mq.removeEventListener?.("change", onMq);
      document.removeEventListener("visibilitychange", onVisibility);
      jobs.current.forEach(clearTimeout);
      jobs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Приветствие — один раз на токен (открытие сайта или ручной вход)
  useEffect(() => {
    if (greetToken > greetedToken) {
      greetedToken = greetToken;
      const id = setTimeout(() => greet(), 300);
      return () => clearTimeout(id);
    }
    startAllRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetToken]);

  const gazeStyle = gaze
    ? { transform: `translate(${gaze.x}px, ${gaze.y}px)` }
    : undefined;

  const mainText = mainCue?.text || "";
  const MainTag = mainCue?.action ? "button" : "div";

  return (
    <div
      className="cm-wrap"
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    >
      {/* Верхнее облачко — короткая реакция, может оставаться видимым */}
      <div className={"cm-top-bubble" + (topMsg ? " show" : "")} aria-hidden="true">{topMsg}</div>

      {/* Основное облачко — реплика по данным; с действием — кнопка */}
      <MainTag
        {...(mainCue?.action
          ? { type: "button", onClick: mainCue.action, onFocus: () => { hoverRef.current = true; }, onBlur: () => { hoverRef.current = false; } }
          : { role: "status", "aria-live": "polite" })}
        className={"cm-bubble cm-main" + (mainShown ? " show" : "") + (mainCue?.action ? " cm-act" : "")}
      >
        {mainText}
      </MainTag>

      {failed ? (
        // Резервная статичная поза, если растровые части не загрузились
        <img className="cm-fallback" src="/mascot.jpg" alt="Маскот класса 1 «Г»" />
      ) : (
        <button
          type="button"
          className="cm-character"
          aria-label="Маскот класса. Нажмите, чтобы поздороваться."
          onClick={greet}
        >
          <svg viewBox="115 35 1070 1190" aria-hidden="true">
            <defs>
              <linearGradient id="cm-orange" x1="0" y1="0" x2=".8" y2="1">
                <stop stopColor="#ffb43c" />
                <stop offset=".7" stopColor="#ff941c" />
                <stop offset="1" stopColor="#e66b1b" />
              </linearGradient>
              <filter id="cm-edge-feather">
                <feGaussianBlur stdDeviation="7" />
              </filter>
              <filter id="cm-feather">
                <feGaussianBlur stdDeviation="2" />
              </filter>
              <mask id="cm-body-mask">
                <path
                  fill="white"
                  filter="url(#cm-edge-feather)"
                  d="M610 93 C479 87 414 154 363 279 C319 367 277 455 232 539 C189 590 175 658 198 718 C215 775 239 818 239 881 C222 964 241 1050 320 1110 C371 1140 433 1152 487 1136 L487 1162 Q531 1180 585 1167 L589 1140 L651 1140 L654 1167 Q705 1181 755 1164 L755 1139 C876 1146 968 1109 1007 1040 C1040 962 1001 841 993 754 C1083 720 1123 666 1127 601 C1134 548 1110 505 1072 481 L1083 379 Q1088 353 1058 349 L972 342 Q946 340 941 369 L926 467 C900 432 883 407 865 373 C822 284 802 171 722 122 Q670 92 610 93 Z"
                />
              </mask>
              <mask id="cm-arm-mask">
                <path
                  fill="white"
                  filter="url(#cm-feather)"
                  d="M 344 456 Q 407 452 489 467 L 499 517 L 479 658 Q 445 674 403 674 Q 388 711 369 761 Q 351 782 304 788 Q 225 794 189 726 Q 150 668 184 600 Q 207 539 281 522 L 332 522 Z"
                />
              </mask>
            </defs>
            <g className={"cm-rig" + (blink ? " cm-blink" : "")} data-state={state}>
              <g
                className="cm-tilt"
                style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "627px 1158px", transition: "transform 1.1s ease" }}
              >
                <image href="/mascot-body.webp" width="1254" height="1254" mask="url(#cm-body-mask)" onError={() => setFailed(true)} />
                <g className={"cm-cup-arm" + (cupUp ? " cm-cup-up" : "")}>
                  <image href="/mascot-arm.webp" width="1254" height="1254" mask="url(#cm-arm-mask)" onError={() => setFailed(true)} />
                </g>
                <g className="cm-eye-left">
                  <ellipse cx="589" cy="342" rx="38" ry="45" fill="url(#cm-orange)" />
                  <g className="cm-eye-open">
                    <path d="M554 340 Q589 320 624 340 Q621 371 589 371 Q559 370 554 340" fill="#fffdf6" />
                    <g className="cm-pupil" style={gazeStyle}>
                      <ellipse cx="591" cy="345" rx="15" ry="14" fill="#171618" />
                      <circle cx="596" cy="340" r="4" fill="white" />
                    </g>
                  </g>
                </g>
                <g className="cm-eye-right">
                  <ellipse cx="690" cy="342" rx="38" ry="45" fill="url(#cm-orange)" />
                  <g className="cm-eye-open">
                    <path d="M655 340 Q690 320 725 340 Q722 371 690 371 Q660 370 655 340" fill="#fffdf6" />
                    <g className="cm-pupil" style={gazeStyle}>
                      <ellipse cx="691" cy="345" rx="15" ry="14" fill="#171618" />
                      <circle cx="696" cy="340" r="4" fill="white" />
                    </g>
                  </g>
                </g>
                <path className="cm-mouth cm-smile" d="M620 408 Q641 425 662 408" />
                <path className="cm-mouth cm-frown" d="M620 421 Q641 405 662 421" />
              </g>
            </g>
          </svg>
        </button>
      )}
    </div>
  );
});

export default ClassMascot;
