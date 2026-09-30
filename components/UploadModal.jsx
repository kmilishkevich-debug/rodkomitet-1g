"use client";
import { useState, useEffect, useRef } from "react";
import { MascotPhone } from "./Art";
import { isLive, uploadReceipt } from "@/lib/supabase";
import { sendReceiptPush } from "@/lib/push";
import { useRefreshPause, confirmDiscard } from "@/lib/formGuard";

export default function UploadModal({ open, name, sum, family, onClose, toast }) {
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setConfirmed(false);
      setBusy(false);
    }
  }, [open, name, sum]);

  useRefreshPause(open);

  const close = () => {
    if (busy) return;
    if (!confirmDiscard(!!file || confirmed, "Закрыть загрузку чека? Прикреплённый файл не отправится.")) return;
    onClose();
  };

  if (!open) return null;

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = ""; // чтобы тот же файл можно было выбрать повторно
  };

  const submit = async () => {
    if (!file) { toast("Сначала прикрепите чек"); return; }
    if (!confirmed) { toast("Отметьте галочку-подтверждение"); return; }
    if (!isLive) {
      // Демо-режим без базы: никуда не отправляем и честно об этом говорим
      onClose();
      toast("Это демо: в рабочей версии чек сохранится и комитет получит уведомление.");
      return;
    }
    setBusy(true);
    try {
      const url = await uploadReceipt(file);
      const who = family?.child ? `Семья №${family.n} · ${family.child}` : "Родитель";
      // Уведомление комитету — по клику откроется сам чек
      await sendReceiptPush({ body: `${who}: чек по сбору «${name}»`, url });
      onClose();
      toast("Чек отправлен комитету. Статус: «ждёт подтверждения».");
    } catch (e) {
      console.error(e);
      toast("Не получилось отправить чек: " + (e?.message || "проверьте интернет и попробуйте ещё раз"));
      setBusy(false);
    }
  };

  return (
    <div className="overlay" id="uploadModal" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <MascotPhone className="modal-blob mascot-wrap" />
        <h3>Загрузка чека о переводе</h3>
        <div className="muted">Сбор: <b>{name}</b> · сумма <b>{sum}</b></div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={pickFile}
        />
        <div className={"upload-zone" + (file ? " done" : "")} id="uZone" onClick={() => inputRef.current?.click()}>
          {file ? `✓ ${file.name} прикреплён — нажмите, чтобы заменить` : "Нажмите, чтобы прикрепить фото или скриншот чека"}
        </div>
        <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--teal)" }}
          />
          <span>Подтверждаю, что перевёл(а) указанную сумму в кассу род. комитета</span>
        </label>
        <div className="actions">
          <button className="btn small white" onClick={close} disabled={busy}>Отмена</button>
          <button className="btn small teal" onClick={submit} disabled={busy}>
            {busy ? "Отправляем…" : "Отправить на подтверждение"}
          </button>
        </div>
      </div>
    </div>
  );
}
