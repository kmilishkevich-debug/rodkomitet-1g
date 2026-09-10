"use client";
// Клиентская часть пуш-уведомлений: подписка браузера и её хранение в базе.
import { supabase, isLive } from "./supabase";
import { VAPID_PUBLIC_KEY } from "./pushConfig";

// Публичный VAPID-ключ приходит в формате base64url — переводим в байты для браузера
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Поддерживает ли этот браузер веб-пуши вообще
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iPhone/iPad: пуши работают только если сайт добавлен на экран «Домой»
export function isIOSNeedsInstall() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  return isIOS && !standalone;
}

// Текущий статус: "on" | "off" | "denied" | "unsupported" | "ios-install"
export async function pushStatus() {
  if (!pushSupported()) return isIOSNeedsInstall() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

// Сохраняем подписку в базе (по endpoint — один браузер = одна строка)
async function saveSubscription(sub, role) {
  if (!isLive) return { ok: false, error: "База не настроена" };
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      role: role === "committee" ? "committee" : "parent",
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Включить уведомления (вызывать по действию пользователя — вход или кнопка)
export async function enablePush(role) {
  if (!pushSupported()) {
    return { ok: false, reason: isIOSNeedsInstall() ? "ios-install" : "unsupported" };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const saved = await saveSubscription(sub, role);
    if (!saved.ok) return { ok: false, reason: "db", error: saved.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", error: e?.message };
  }
}

// Выключить уведомления: убрать подписку из браузера и из базы
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      if (isLive) await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}

// Тихая синхронизация при автовходе: если разрешение уже дано —
// обновляем подписку и роль в базе, ничего не спрашивая
export async function syncPushRole(role) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(sub, role);
  } catch {
    // тихий режим — ошибки не показываем
  }
}

// Ручная рассылка от комитета (через API-роут с проверкой входа)
export async function sendManualPush({ title, body, url = "/", audience = "all" }) {
  if (!isLive) return { ok: false, error: "База не настроена" };
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { ok: false, error: "Нужно войти как комитет" };
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, body, url, audience }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}
