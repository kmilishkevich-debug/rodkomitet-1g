"use client";
import { useEffect, useState } from "react";

/* Регистрация сервис-воркера + ненавязчивая плашка «Установите приложение».
   Android/Chrome: кнопка «Установить» (beforeinstallprompt).
   iPhone/Safari: короткая инструкция «Поделиться → На экран "Домой"». */

const DISMISS_KEY = "rk1g-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaSetup() {
  const [installEvt, setInstallEvt] = useState(null);
  const [show, setShow] = useState(false); // false | "android" | "ios"

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (isStandalone()) return; // уже установлено
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;

    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvt(e);
      setShow("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let t;
    if (isIOS()) {
      t = setTimeout(() => setShow("ios"), 2500);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try {
      await installEvt.userChoice;
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="pwa-banner" role="dialog" aria-label="Установка приложения">
      <img src="/icon-192.png" alt="" className="pwa-banner-icon" />
      <div className="pwa-banner-text">
        <b>Наш 1 «Г» — как приложение</b>
        {show === "android" ? (
          <span>Добавьте на главный экран, чтобы открывать в одно касание</span>
        ) : (
          <span>
            Нажмите «Поделиться» <span aria-hidden="true">⎋</span> и выберите
            «На экран “Домой”»
          </span>
        )}
      </div>
      {show === "android" && (
        <button className="pwa-banner-install" onClick={install}>
          Установить
        </button>
      )}
      <button className="pwa-banner-close" onClick={dismiss} aria-label="Закрыть">
        ✕
      </button>
    </div>
  );
}
