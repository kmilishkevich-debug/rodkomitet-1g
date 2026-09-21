"use client";
import { useState, useEffect, useCallback } from "react";
import { FAMILIES } from "./data";

// ===== Общие помощники для объявлений и голосований =====

// Выбранная семья хранится на устройстве: { n, child }.
// Когда появятся индивидуальные пароли — привяжем автоматически.
export function loadFamily() {
  try {
    const raw = localStorage.getItem("rk1g-family");
    if (!raw) return null;
    const f = JSON.parse(raw);
    if (f && typeof f.n === "number" && f.child) return f;
  } catch {}
  return null;
}

export function saveFamily(f) {
  try {
    localStorage.setItem("rk1g-family", JSON.stringify(f));
  } catch {}
}

export function useFamily() {
  const [family, setFamilyState] = useState(null);
  useEffect(() => {
    setFamilyState(loadFamily());
  }, []);
  const setFamily = useCallback((f) => {
    setFamilyState(f);
    if (f) saveFamily(f);
  }, []);
  return [family, setFamily];
}

// «Просмотрено» для бейджей в меню (локально на устройстве)
export function loadSeen(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function saveSeen(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

// Короткое имя семьи по номеру: «Милишкевич Ева»
export function familyName(n) {
  const f = FAMILIES.find((x) => x.n === n);
  return f ? f.child : `Семья №${n}`;
}

// Текст с абзацами и кликабельными ссылками
export function RichText({ text }) {
  if (!text) return null;
  const paras = String(text).split(/\n+/).filter((p) => p.trim());
  return paras.map((p, i) => (
    <p className="news-p" key={i}>
      {p.split(/(https?:\/\/[^\s]+)/g).map((part, j) =>
        /^https?:\/\//.test(part) ? (
          <a href={part} key={j} target="_blank" rel="noopener noreferrer" className="news-link">
            {part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        ) : (
          part
        )
      )}
    </p>
  ));
}

// Дата по-русски: «21 сентября, 14:05»
export function fmtNewsDate(iso) {
  if (!iso) return "";
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}, ${hm}`;
}

// Модальное окно выбора своей семьи из списка класса
export default function FamilyPicker({ open, onClose, onPick, title }) {
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (open) setFilter("");
  }, [open]);
  if (!open) return null;
  const list = FAMILIES.filter((f) => f.child.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fam-modal" role="dialog" aria-modal="true">
        <h3>{title || "Кто вы? Выберите своего ребёнка"}</h3>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          Одна семья — один голос. Выбор запомнится на этом устройстве.
        </p>
        <input
          className="fam-search"
          type="text"
          placeholder="Начните вводить фамилию…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
        <div className="fam-list">
          {list.map((f) => (
            <button
              key={f.n}
              className="fam-row"
              onClick={() => {
                onPick({ n: f.n, child: f.child });
                onClose();
              }}
            >
              <span className="fam-n">{f.n}</span>
              <span className="fam-name">{f.child}</span>
              {f.note && <span className="tag-pill">{f.note}</span>}
            </button>
          ))}
          {!list.length && <div className="muted" style={{ padding: 12 }}>Никого не нашли — проверьте написание</div>}
        </div>
        <div className="actions">
          <button className="btn small" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
