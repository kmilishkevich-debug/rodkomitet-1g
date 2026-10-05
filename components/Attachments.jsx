"use client";
import { useRef, useState } from "react";
import { uploadAttachment } from "@/lib/supabase";

// ===== Вложения к записям (объявления, домашние задания, события) =====
// AttachPicker — в формах учителя и комитета: выбрать до 5 файлов, убрать крестиком.
// AttachList — у родителей: фото превьюшками, документы списком со скачиванием.

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ

export function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

function isPhoto(f) {
  return (f?.type || "").startsWith("image/");
}

// Иконка по типу файла
function fileIcon(f) {
  const t = (f?.type || "").toLowerCase();
  const n = (f?.name || "").toLowerCase();
  if (t.includes("pdf") || n.endsWith(".pdf")) return "📄";
  if (t.includes("word") || /\.(docx?|rtf|odt)$/.test(n)) return "📝";
  if (t.includes("sheet") || t.includes("excel") || /\.(xlsx?|csv|ods)$/.test(n)) return "📊";
  if (t.includes("zip") || t.includes("rar") || /\.(zip|rar|7z)$/.test(n)) return "🗜️";
  if (t.startsWith("video/")) return "🎬";
  if (t.startsWith("audio/")) return "🎵";
  return "📎";
}

// ── Выбор файлов в форме ──────────────────────────────────────────────────────
export function AttachPicker({ files, onChange, toast }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const list = files || [];

  const pick = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = "";
    if (!chosen.length) return;

    const room = MAX_FILES - list.length;
    if (room <= 0) {
      toast?.(`Можно прикрепить не больше ${MAX_FILES} файлов`);
      return;
    }
    let take = chosen;
    if (chosen.length > room) {
      take = chosen.slice(0, room);
      toast?.(`Можно прикрепить не больше ${MAX_FILES} файлов`);
    }

    setBusy(true);
    const added = [];
    for (const f of take) {
      if (f.size > MAX_SIZE) {
        toast?.(`«${f.name}» больше 10 МБ — пропустили`);
        continue;
      }
      try {
        added.push(await uploadAttachment(f));
      } catch (err) {
        console.error(err);
        toast?.(`Не получилось загрузить «${f.name}»`);
      }
    }
    setBusy(false);
    if (added.length) onChange([...list, ...added]);
  };

  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div className="att-picker">
      {list.length > 0 && (
        <div className="att-rows">
          {list.map((f, i) => (
            <div className="att-row" key={f.url || i}>
              {isPhoto(f) ? (
                <img src={f.url} className="att-thumb" alt="" />
              ) : (
                <span className="att-ico">{fileIcon(f)}</span>
              )}
              <div className="att-info">
                <div className="att-name">{f.name}</div>
                <div className="att-size">{fmtSize(f.size)}</div>
              </div>
              <button
                type="button"
                className="note-del"
                onClick={() => remove(i)}
                aria-label="Убрать файл"
                title="Убрать"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={pick}
      />
      {list.length < MAX_FILES && (
        <button
          type="button"
          className="pill-btn att-add"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Загружаем…" : "📎 Прикрепить файлы"}
        </button>
      )}
      {list.length > 0 && (
        <div className="att-hint">{list.length} из {MAX_FILES} · до 10 МБ каждый</div>
      )}
    </div>
  );
}

// ── Показ вложений в записи ───────────────────────────────────────────────────
export function AttachList({ files }) {
  const list = files || [];
  if (!list.length) return null;
  const photos = list.filter(isPhoto);
  const docs = list.filter((f) => !isPhoto(f));
  return (
    <div className="att-list">
      {photos.length > 0 && (
        <div className="att-photos">
          {photos.map((f, i) => (
            <a href={f.url} target="_blank" rel="noreferrer" className="att-photo" key={f.url || i}>
              <img src={f.url} alt={f.name || "Фото"} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {docs.map((f, i) => (
        <a href={f.url} target="_blank" rel="noreferrer" className="att-doc" key={f.url || i} download={f.name}>
          <span className="att-ico">{fileIcon(f)}</span>
          <span className="att-name">{f.name}</span>
          <span className="att-size">{fmtSize(f.size)}</span>
        </a>
      ))}
    </div>
  );
}
