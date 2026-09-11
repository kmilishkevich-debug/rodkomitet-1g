"use client";
// Анимированный маскот класса 1 «Г» — адаптация автономного Web Component под React.
// Растровые части (тело и рука со стаканом) лежат в /public как WebP,
// поверх — SVG-риг: маски, глаза со зрачками, рот. Арт с белой подложкой
// смешивается со светлым фоном через mix-blend-mode: multiply.
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

const ClassMascot = forwardRef(function ClassMascot({ allDone = false, greetToken = 0 }, ref) {
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("Я собрал всё важное здесь");
  const [bubbleShown, setBubbleShown] = useState(false);
  const [blink, setBlink] = useState(false);

  const jobs = useRef(new Set());
  const reduced = useRef(false);
  const allDoneRef = useRef(allDone);
  allDoneRef.current = allDone;
  const stateRef = useRef(state);
  stateRef.current = state;

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
    setBlink(false);
  }, []);

  const scheduleBlink = useCallback(() => {
    if (reduced.current) return;
    later(() => {
      setBlink(true);
      later(() => {
        setBlink(false);
        scheduleBlink();
      }, 160);
    }, 4400 + Math.random() * 2300);
  }, [later]);

  const set = useCallback(
    (st, message) => {
      clear();
      setState(st);
      setMsg(message);
      setBubbleShown(false);
      later(() => setBubbleShown(true), st === "greeting" ? 1500 : 80);
      scheduleBlink();
    },
    [clear, later, scheduleBlink]
  );

  // Состояние покоя зависит от актуальных дел: всё сделано → done, иначе idle
  const rest = useCallback(() => {
    if (allDoneRef.current) set("done", "На сегодня всё! Можно выдохнуть");
    else set("idle", "Я собрал всё важное здесь");
  }, [set]);
  const restRef = useRef(rest);
  restRef.current = rest;

  const greet = useCallback(() => {
    set("greeting", "Привет! Кофе готов, дела тоже");
    later(() => restRef.current(), 4200);
  }, [set, later]);

  const success = useCallback(() => {
    set("happy", "Готово, спасибо!");
    later(() => restRef.current(), 3600);
  }, [set, later]);

  const sad = useCallback(() => {
    set("sad", "Уже уходишь? Буду ждать тебя");
  }, [set]);

  const stay = useCallback(() => {
    set("happy", "Ура, ты остаёшься!");
    later(() => restRef.current(), 3600);
  }, [set, later]);

  const done = useCallback(() => {
    set("done", "На сегодня всё! Можно выдохнуть");
  }, [set]);

  useImperativeHandle(ref, () => ({ greet, success, done, sad, stay, idle: rest }), [
    greet,
    success,
    done,
    sad,
    stay,
    rest,
  ]);

  // Монтирование: reduced-motion, пауза при скрытой вкладке, стартовое состояние
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => {
      reduced.current = mq.matches;
    };
    mq.addEventListener?.("change", onMq);
    const onVisibility = () => {
      if (document.hidden) clear();
      else restRef.current(); // восстановление по актуальным делам
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
    restRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetToken]);

  // Число дел изменилось, пока маскот в покое, — обновляем idle/done
  useEffect(() => {
    if (stateRef.current === "idle" || stateRef.current === "done") restRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  return (
    <div className="cm-wrap">
      <button
        type="button"
        className="cm-character"
        aria-label={msg + " Нажмите, чтобы поздороваться."}
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
            <image href="/mascot-body.webp" width="1254" height="1254" mask="url(#cm-body-mask)" />
            <g className="cm-cup-arm">
              <image href="/mascot-arm.webp" width="1254" height="1254" mask="url(#cm-arm-mask)" />
            </g>
            <g className="cm-eye-left">
              <ellipse cx="589" cy="342" rx="38" ry="45" fill="url(#cm-orange)" />
              <g className="cm-eye-open">
                <path d="M554 340 Q589 320 624 340 Q621 371 589 371 Q559 370 554 340" fill="#fffdf6" />
                <g className="cm-pupil">
                  <ellipse cx="591" cy="345" rx="15" ry="14" fill="#171618" />
                  <circle cx="596" cy="340" r="4" fill="white" />
                </g>
              </g>
            </g>
            <g className="cm-eye-right">
              <ellipse cx="690" cy="342" rx="38" ry="45" fill="url(#cm-orange)" />
              <g className="cm-eye-open">
                <path d="M655 340 Q690 320 725 340 Q722 371 690 371 Q660 370 655 340" fill="#fffdf6" />
                <g className="cm-pupil">
                  <ellipse cx="691" cy="345" rx="15" ry="14" fill="#171618" />
                  <circle cx="696" cy="340" r="4" fill="white" />
                </g>
              </g>
            </g>
            <path className="cm-mouth cm-smile" d="M620 408 Q641 425 662 408" />
            <path className="cm-mouth cm-frown" d="M620 421 Q641 405 662 421" />
          </g>
        </svg>
      </button>
      <div className={"cm-bubble" + (bubbleShown ? " show" : "")} role="status" aria-live="polite">
        {msg}
      </div>
    </div>
  );
});

export default ClassMascot;
