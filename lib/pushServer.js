// Серверная часть пушей: работает только в API-роутах (Vercel).
// Приватный VAPID-ключ хранится в переменной окружения VAPID_PRIVATE_KEY на Vercel.
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "./pushConfig";

export function serverSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function pushReady() {
  return !!process.env.VAPID_PRIVATE_KEY;
}

function setupWebpush() {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

// Проверяем, что запрос пришёл от вошедшего члена комитета (JWT из Supabase)
export async function verifyCommittee(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const sb = serverSupabase();
  if (!sb) return false;
  const { data, error } = await sb.auth.getUser(token);
  return !error && !!data?.user;
}

// Рассылка: audience = "all" (все подписки) или "committee" (только комитет).
// Протухшие подписки (человек отписался/сменил браузер) удаляем из базы.
export async function sendPushToAll({ title, body, url = "/" }, audience = "all") {
  if (!pushReady()) return { ok: false, error: "VAPID_PRIVATE_KEY не задан на Vercel" };
  const sb = serverSupabase();
  if (!sb) return { ok: false, error: "База не настроена" };
  setupWebpush();

  let q = sb.from("push_subscriptions").select("*");
  if (audience === "committee") q = q.eq("role", "committee");
  const { data: subs, error } = await q;
  if (error) return { ok: false, error: error.message };
  if (!subs?.length) return { ok: true, sent: 0, gone: 0 };

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  const gone = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint);
      }
    })
  );
  if (gone.length) await sb.from("push_subscriptions").delete().in("endpoint", gone);
  return { ok: true, sent, gone: gone.length };
}
