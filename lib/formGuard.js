"use client";
import { useEffect } from "react";

/**
 * Защита форм от потери набранного текста.
 *
 * 1) Пока открыта любая форма — приложение НЕ дёргает фоновое обновление данных
 *    (таймер раз в минуту и обновление при возврате в приложение). Иначе форма
 *    считала, что её открыли заново, и обнуляла поля прямо во время ввода.
 * 2) Черновики: всё, что набрано, складывается в localStorage и переживает
 *    перезагрузку PWA (например, после открытия камеры).
 * 3) Единое «Точно закрыть?» при закрытии формы с несохранёнными данными.
 */

// ── 1. Пауза фонового обновления, пока открыта форма ──────────────────────────
let openForms = 0;
const listeners = new Set();

function emit() {
  const busy = openForms > 0;
  listeners.forEach((fn) => {
    try {
      fn(busy);
    } catch {}
  });
}

export function isFormOpen() {
  return openForms > 0;
}

export function onFormsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function lockRefresh() {
  openForms += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openForms = Math.max(0, openForms - 1);
    emit();
  };
}

/** Вызывается в форме: пока open === true, фоновое обновление на паузе. */
export function useRefreshPause(open) {
  useEffect(() => {
    if (!open) return;
    return lockRefresh();
  }, [open]);
}

// ── 2. Черновики ──────────────────────────────────────────────────────────────
const PREFIX = "rk1g.draft.";

export function hasDraft(key) {
  try {
    return !!localStorage.getItem(PREFIX + key);
  } catch {
    return false;
  }
}

export function readDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {}
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

/**
 * Автосохранение черновика формы.
 * open — открыта ли форма, key — ключ черновика, data — объект с полями,
 * enabled — сохранять ли (обычно «форма изменена»).
 */
export function useDraftAutosave(open, key, data, enabled) {
  const json = JSON.stringify(data ?? null);
  useEffect(() => {
    if (!open || !key || !enabled) return;
    try {
      localStorage.setItem(PREFIX + key, json);
    } catch {}
  }, [open, key, json, enabled]);
}

// ── 3. Подтверждение закрытия ─────────────────────────────────────────────────
export function confirmDiscard(dirty, text) {
  if (!dirty) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(text || "Закрыть без сохранения? Всё, что вы набрали, пропадёт.");
}

/** Простое сравнение «форма изменена» для плоских объектов. */
export function isDirty(current, initial) {
  if (!initial) return false;
  return Object.keys(current).some(
    (k) => String(current[k] ?? "") !== String(initial[k] ?? "")
  );
}
