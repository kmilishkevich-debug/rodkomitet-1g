"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";

/* Регистрация сервис-воркера + модалка «Установите приложение».
   Показываем всем (в том числе на экране входа) при каждом заходе,
   пока приложение не установлено. Закрыл — до конца сессии не мешаем.
   Android/Chrome: кнопка «Установить» (beforeinstallprompt).
   iPhone/Safari: пошаговая инструкция «Поделиться → На экран "Домой"». */

const SESSION_KEY = "rk1g-install-hidden";
const SHOW_DELAY = 1200;

function isStandalone() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

function isIOS() {
  const ua = navigator.userAgent || "";
  const iDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ притворяется macOS, но остаётся тач-устройством
  const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return iDevice || iPadOS;
}

function hiddenThisSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export default function PwaSetup() {
  const [installEvt, setInstallEvt] = useState(null);
  const [show, setShow] = useState(false); // false | "android" | "ios"

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (isStandalone()) return; // уже установлено — не трогаем
    if (hiddenThisSession()) return; // закрыли в этот заход

    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvt(e);
      setShow("android");
    };
    const onInstalled = () => {
      setShow(false);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let t;
    if (isIOS()) {
      t = setTimeout(() => {
        if (!isStandalone() && !hiddenThisSession()) setShow("ios");
      }, SHOW_DELAY);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try {
      await installEvt.userChoice;
    } catch {}
    setInstallEvt(null);
    dismiss();
  };

  if (!show) return null;

  return (
    <div
      className="pwa-install-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Установка приложения"
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

        <h3 className="pwa-install-title">Поставьте на главный экран</h3>
        <p className="pwa-install-sub">
          Наш 1 «Г» будет открываться в одно касание — как обычное приложение, без браузера
          и поиска нужной вкладки.
        </p>

        {show === "android" ? (
          <>
            <button className="btn pwa-install-btn" onClick={install}>
              <Ic id="i-download" /> Установить
            </button>
            <button className="pwa-install-later" onClick={dismiss}>
              Не сейчас
            </button>
          </>
        ) : (
          <>
            <ol className="pwa-steps">
              <li className="pwa-step">
                <span className="pwa-step-num">1</span>
                <span className="pwa-step-text">
                  Нажмите <b>«Поделиться»</b> внизу экрана
                </span>
                <span className="pwa-step-ic" aria-hidden="true">
                  <Ic id="i-share-ios" />
                </span>
              </li>
              <li className="pwa-step">
                <span className="pwa-step-num">2</span>
                <span className="pwa-step-text">
                  Пролистайте и выберите <b>«На экран “Домой”»</b>
                </span>
                <span className="pwa-step-ic" aria-hidden="true">
                  <Ic id="i-plus" />
                </span>
              </li>
              <li className="pwa-step">
                <span className="pwa-step-num">3</span>
                <span className="pwa-step-text">
                  Нажмите <b>«Добавить»</b> — готово
                </span>
                <span className="pwa-step-ic" aria-hidden="true">
                  <Ic id="i-check" />
                </span>
              </li>
            </ol>
            <button className="btn pwa-install-btn" onClick={dismiss}>
              Понятно
            </button>
          </>
        )}
      </div>
    </div>
  );
}
