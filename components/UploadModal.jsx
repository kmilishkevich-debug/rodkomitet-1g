"use client";
import { useState, useEffect } from "react";
import { MascotPhone } from "./Art";

export default function UploadModal({ open, name, sum, onClose, toast }) {
  const [attached, setAttached] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setAttached(false);
      setConfirmed(false);
    }
  }, [open, name, sum]);

  if (!open) return null;

  const submit = () => {
    if (!attached) { toast("Сначала прикрепите чек"); return; }
    if (!confirmed) { toast("Отметьте галочку-подтверждение"); return; }
    onClose();
    toast("Чек отправлен! Статус: «ждёт подтверждения комитетом». Комитету ушло уведомление.");
  };

  return (
    <div className="overlay" id="uploadModal">
      <div className="modal">
        <MascotPhone className="modal-blob mascot-wrap" />
        <h3>Загрузка чека о переводе</h3>
        <div className="muted">Сбор: <b>{name}</b> · сумма <b>{sum}</b></div>
        <div className={"upload-zone" + (attached ? " done" : "")} id="uZone" onClick={() => setAttached(true)}>
          {attached ? "✓ chek_perevod_04-09.jpg прикреплён" : "Нажмите, чтобы прикрепить фото или скриншот чека"}
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
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button className="btn small teal" onClick={submit}>Отправить на подтверждение</button>
        </div>
      </div>
    </div>
  );
}
