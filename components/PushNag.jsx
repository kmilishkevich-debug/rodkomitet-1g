"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import { pushStatus, enablePush } from "@/lib/push";

/* Модалка «Включите уведомления» — показывается после входа всем,
   у кого пуши ещё не включены, при каждом заходе, пока не включат
   (запрос разрешения браузер показывает только по нажатию кнопки).
   Закрыл — до конца сессии не мешаем. Если разрешение уже запрещено
   в браузере — показываем короткую инструкцию, как разрешить.
   iPhone без установки на «Домой» не трогаем: там пуши невозможны,
   и установку уже просит модалка PwaSetup. Стили переиспользуют
   классы pwa-install-* из globals.css. */

const SESSION_KEY = "rk1g-push-nag-hidden";
const INSTALL_OVERLAY = ".pwa-install-overlay";

function hiddenThisSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export default function PushNag({ role, familyN, toast }) {
  const [show, setShow] = useState(false); // false | "ask" | "denied"
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!role) return;
    if (hiddenThisSession()) return;
    if (/-demo\/?$/.test(window.location.pathname)) return;

    let alive = true;
    let tries = 0;
    // Ждём, пока закроется модалка установки приложения (если она есть),
    // чтобы два окна не легли друг на друга. Проверяем раз в секунду.
    const tick = async () => {
      if (!alive) return;
      tries += 1;
      if (tries > 30) return; // полминуты подождали — в этот заход не настаиваем
      if (document.querySelector(INSTALL_OVERLAY)) {
        t = setTimeout(tick, 1000);
        return;
      }
      const st = await pushStatus();
      if (!alive || hiddenThisSession()) return;
      if (st === "off") setShow("ask");
      else if (st === "denied") setShow("denied");
      // "on" / "ios-install" / "unsupported" — молчим
    };
    let t = setTimeout(tick, 2000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [role]);

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  };

  const turnOn = async () => {
    setBusy(true);
    const res = await enablePush(role, familyN);
    setBusy(false);
    if (res.ok) {
      toast?.("Уведомления включены — теперь ничего не пропустите");
      dismiss();
    } else if (res.reason === "denied") {
      setShow("denied"); // человек нажал «Блокировать» — объясняем, как вернуть
    } else {
      toast?.("Не получилось включить: " + (res.error || res.reason || "ошибка"));
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div
      className="pwa-install-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Включение уведомлений"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="pwa-install-card">
        <button className="pwa-install-close" onClick={dismiss} aria-label="Закрыть">
          <Ic id="i-x" />
        </button>

        <div className="pwa-install-art">
          <img src="/mascot/pose-notice.png" alt="" className="pwa-install-mascot" />
          <img src="/icon-192.png" alt="" className="pwa-install-badge" />
        </div>

        {show === "ask" ? (
          <>
            <h3 className="pwa-install-title">Включите уведомления</h3>
            <p className="pwa-install-sub">
              Объявления учителя, голосования и напоминания класса будут приходить
              сами — ничего не придётся проверять вручную.
            </p>
            <button className="btn pwa-install-btn" onClick={turnOn} disabled={busy}>
              <Ic id="i-bell" /> {busy ? "Включаю…" : "Включить уведомления"}
            </button>
            <button className="pwa-install-later" onClick={dismiss}>
              Не сейчас
            </button>
          </>
        ) : (
          <>
            <h3 className="pwa-install-title">Уведомления запрещены</h3>
            <p className="pwa-install-sub">
              Браузер блокирует уведомления для нашего приложения. Разрешите их в
              настройках: нажмите значок замка рядом с адресом сайта →
              «Уведомления» → «Разрешить», затем обновите страницу.
            </p>
            <button className="btn pwa-install-btn" onClick={dismiss}>
              Понятно
            </button>
          </>
        )}
      </div>
    </div>
  );
}
