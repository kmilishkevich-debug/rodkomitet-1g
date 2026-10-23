"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import { pushStatus, enablePush } from "@/lib/push";

/* Постоянная плашка «Включите уведомления» на главной.
   В отличие от модалки PushNag (её можно закрыть до конца сессии),
   плашка висит на видном месте КАЖДЫЙ заход, пока уведомления
   не включены, — закрыть её нельзя. Три состояния:
     off         — кнопка «Включить» (вызывает системный запрос браузера)
     denied      — короткая инструкция, как разрешить в настройках сайта
     ios-install — подсказка про экран «Домой» (без него iPhone пуши не умеет)
   "on" и "unsupported" — плашки нет. */

export default function PushBanner({ role, familyN, toast, demoState }) {
  // demoState — только для demo-страниц: показать нужное состояние без браузера
  const [st, setSt] = useState(demoState || null); // null | on | off | denied | ios-install | unsupported
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demoState) return;
    if (!role) return;
    let alive = true;
    const check = async () => {
      const s = await pushStatus();
      if (alive) setSt(s);
    };
    check();
    // Перепроверяем при возврате на вкладку: человек мог разрешить
    // уведомления в настройках браузера и вернуться
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [role]);

  const turnOn = async () => {
    setBusy(true);
    const res = await enablePush(role, familyN);
    setBusy(false);
    if (res.ok) {
      setSt("on");
      toast?.("Уведомления включены — теперь ничего не пропустите");
    } else if (res.reason === "denied") {
      setSt("denied");
    } else {
      toast?.("Не получилось включить: " + (res.error || res.reason || "ошибка"));
    }
  };

  if (!st || st === "on" || st === "unsupported") return null;

  return (
    <div className="push-banner reveal d1" role="status">
      <span className="push-banner-ico" aria-hidden="true">
        <Ic id="i-bell" />
      </span>
      {st === "off" && (
        <>
          <span className="push-banner-text">
            <b>Уведомления выключены.</b> Включите их — и сообщения учителя,
            объявления и напоминания будут приходить сами.
          </span>
          <button className="push-banner-btn" onClick={turnOn} disabled={busy}>
            {busy ? "Включаю…" : "Включить"}
          </button>
        </>
      )}
      {st === "denied" && (
        <span className="push-banner-text">
          <b>Уведомления запрещены в браузере.</b> Нажмите значок замка рядом
          с адресом сайта → «Уведомления» → «Разрешить» и обновите страницу.
        </span>
      )}
      {st === "ios-install" && (
        <span className="push-banner-text">
          <b>На iPhone уведомления работают только из приложения.</b> Добавьте
          сайт на экран «Домой»: «Поделиться» → «На экран „Домой“», затем
          откройте его оттуда и включите уведомления.
        </span>
      )}
    </div>
  );
}
