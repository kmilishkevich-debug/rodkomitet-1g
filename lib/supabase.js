"use client";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

// null, если база ещё не настроена — тогда приложение показывает демо-данные из data.js
export const supabase = url && key ? createClient(url, key) : null;
export const isLive = !!supabase;

// Загрузка всех групп расходов с позициями (для «Расходов» и итогов на главной)
export async function fetchExpenseGroups() {
  if (!supabase) return null;
  const [gRes, iRes] = await Promise.all([
    supabase.from("expense_groups").select("*").order("sort", { ascending: true }),
    supabase.from("expenses").select("*").order("created_at", { ascending: true }),
  ]);
  if (gRes.error || iRes.error) {
    console.error("Supabase:", gRes.error || iRes.error);
    return null;
  }
  return gRes.data.map((g) => ({
    id: g.id,
    title: g.title,
    sort: g.sort,
    items: iRes.data
      .filter((i) => i.group_id === g.id)
      .map((i) => ({
        ...i,
        price: i.price == null ? 0 : Number(i.price),
        sum: i.sum == null ? 0 : Number(i.sum),
      })),
  }));
}

// Сжимаем фото чека до разумного размера (макс. 1600px), качество сохраняем
export function compressReceipt(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const fallback = () => resolve(file);
    img.onload = () => {
      const max = 1600;
      let { width: w, height: h } = img;
      if (w <= max && h <= max && file.size < 900 * 1024) return resolve(file);
      const k = Math.min(1, max / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * k);
      canvas.height = Math.round(h * k);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.87);
    };
    img.onerror = fallback;
    img.src = URL.createObjectURL(file);
  });
}

// Загрузка чека в хранилище, возвращает публичную ссылку
export async function uploadReceipt(file) {
  const blob = await compressReceipt(file);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
}
