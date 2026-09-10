"use client";
// Секция «Уведомления» на Главной: статус подписки, вкл/выкл,
// инструкция для iPhone и ручная рассылка для комитета.
import { useEffect, useState } from "react";
import { Ic, CIc } from "./Art";
import { isLive } from "@/lib/supabase";
import {
  pushStatus,
  enablePush,
  disablePush,
  sendManualPush,
} from "@/lib/push";

// Пошаговая инструкция для iPhone: пуши работают только из значка на «Домой»
function IosSteps() {
  return (
    <div className="push-ios">
      <div className="push-ios-title">
        <Ic id="i-phone" /> На iPhone уведомления работают так:
      </div>
      <ol className="push-steps">
        <li>
          <span className="push-step-ico"><Ic id="i-share-ios" /></span>
          Откройте сайт в Safari и нажмите кнопку «Поделиться» внизу экрана
        </li>
        <li>
          <span className="push-step-ico"><Ic id="i-plus" /></span>
          Выберите «На экран “Домой”» и нажмите «Добавить»
        </li>
        <li>
          <span className="push-step-ico"><Ic id="i-bell" /></span>
          Откройте приложение со значка на «Домой» и разрешите уведомления
        </li>
      </ol>
    </div>
  );
}

// Форма ручной рассылки (только комитету)
function ManualPush({ toast }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !text.trim()) return toast("Заполните заголовок и текст");
    setSending(true);
    const res = await sendManualPush({ title: title.trim(), body: text.trim(), audience });
    setSending(false);
    if (!res.ok) return toast("Не получилось отправить: " + (res.error || "ошибка"));
    toast(`Пуш отправлен: доставляется на ${res.sent} устройств${res.gone ? ` (устаревших подписок убрано: ${res.gone})` : ""}`);
    setTitle("");
    setText("");
  };

  return (
    <div className="push-manual">
      <div className="push-manual-title"><Ic id="i-send" /> Отправить пуш (комитет)</div>
      <div className="exp-form">
        <label>Заголовок</label>
        <input placeholder="Например: Собрание в пятницу" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <label>Текст</label>
        <input placeholder="Например: Встречаемся в 18:00 в кабинете 166" value={text} onChange={(e) => setText(e.target.value)} maxLength={180} />
        <label>Кому</label>
        <div className="push-aud">
          <button className={"chip-btn" + (audience === "all" ? " active" : "")} onClick={() => setAudience("all")}>Всем родителям</button>
          <button className={"chip-btn" + (audience === "committee" ? " active" : "")} onClick={() => setAudience("committee")}>Только комитету</button>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        <button className="btn small teal" onClick={send} disabled={sending}>
          {sending ? "Отправляю…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}

export default function PushSettings({ committee, role, toast }) {
  const [status, setStatus] = useState(null); // null = ещё проверяем

  const refresh = () => pushStatus().then(setStatus);
  useEffect(() => {
    refresh();
  }, []);

  if (!isLive) return null;

  const turnOn = async () => {
    const res = await enablePush(role);
    if (res.ok) toast("Уведомления включены — теперь напомним о днях рождения и новостях класса");
    else if (res.reason === "denied") toast("Уведомления запрещены в браузере — разрешите их в настройках сайта");
    else if (res.reason === "ios-install") toast("Сначала добавьте сайт на экран «Домой» (шаги ниже)");
    else toast("Не получилось включить: " + (res.error || res.reason));
    refresh();
  };

  const turnOff = async () => {
    await disablePush();
    toast("Уведомления выключены на этом устройстве");
    refresh();
  };

  return (
    <>
      <div className="sec-head reveal d5">
        <span className="sec-dot blue"><Ic id="i-bell" /></span>
        <h2 className="sec-title">Уведомления</h2>
        <span className="sec-note">напоминания о ДР и новостях класса</span>
      </div>
      <div className="card push-card reveal d5">
        {status === "on" && (
          <div className="push-row">
            <CIc id="i-bell" tone="green" size="sm" />
            <div className="push-body">
              <div className="push-title">Уведомления включены</div>
              <div className="muted">Напомним о днях рождения и важных новостях класса</div>
            </div>
            <button className="btn small white" onClick={turnOff}>Выключить</button>
          </div>
        )}
        {status === "off" && (
          <div className="push-row">
            <CIc id="i-bell" tone="blue" size="sm" />
            <div className="push-body">
              <div className="push-title">Уведомления выключены</div>
              <div className="muted">Включите, чтобы не пропустить дни рождения и новости</div>
            </div>
            <button className="btn small teal" onClick={turnOn}>Включить</button>
          </div>
        )}
        {status === "denied" && (
          <div className="push-row">
            <CIc id="i-bell" tone="pink" size="sm" />
            <div className="push-body">
              <div className="push-title">Уведомления запрещены в браузере</div>
              <div className="muted">
                Разрешите их в настройках браузера для этого сайта (значок замка рядом с адресом → Уведомления → Разрешить), затем обновите страницу
              </div>
            </div>
          </div>
        )}
        {status === "ios-install" && <IosSteps />}
        {status === "unsupported" && (
          <div className="muted">Этот браузер не поддерживает уведомления</div>
        )}
        {committee && status === "on" && <ManualPush toast={toast} />}
      </div>
    </>
  );
}
