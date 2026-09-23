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

// Загрузка сборов: статьи (колонки) + суммы по детям.
// null = таблицы ещё не созданы/пустые — показываем встроенные данные из data.js
export async function fetchFees() {
  if (!supabase) return null;
  const [cRes, rRes, vRes] = await Promise.all([
    supabase.from("fee_columns").select("*").order("sort", { ascending: true }),
    supabase.from("fee_rows").select("*").order("n", { ascending: true }),
    supabase.from("fee_values").select("*"),
  ]);
  if (cRes.error || rRes.error || vRes.error) {
    console.error("Supabase (сборы):", cRes.error || rRes.error || vRes.error);
    return null;
  }
  if (!cRes.data.length || !rRes.data.length) return null;
  return {
    columns: cRes.data.map((c) => ({ id: c.id, title: c.title, kind: c.kind, sort: c.sort })),
    rows: rRes.data.map((r) => {
      const values = {};
      const meta = {};
      vRes.data.filter((v) => v.row_id === r.id).forEach((v) => {
        values[v.column_id] = Number(v.amount);
        if (v.method || v.note) meta[v.column_id] = { method: v.method || null, note: v.note || null };
      });
      return { id: r.id, n: r.n, child: r.child, values, meta };
    }),
  };
}

// ===== Сборы-кампании (сбор 150 руб и будущие) =====

// Все сборы с платежами. null = таблица fee_campaigns ещё не создана.
export async function fetchFeeCampaigns() {
  if (!supabase) return null;
  const [cRes, pRes] = await Promise.all([
    supabase.from("fee_campaigns").select("*").order("sort", { ascending: true }),
    supabase.from("campaign_payments").select("*").order("paid_at", { ascending: true }),
  ]);
  if (cRes.error || pRes.error) {
    console.error("Supabase (сборы-кампании):", cRes.error || pRes.error);
    return null;
  }
  if (!cRes.data.length) return null;
  return cRes.data.map((c) => ({
    ...c,
    amount: Number(c.amount),
    payments: pRes.data
      .filter((p) => p.campaign_id === c.id)
      .map((p) => ({ ...p, amount: Number(p.amount) })),
  }));
}

// Внесение платежа по сбору (только комитет)
export async function addCampaignPayment(payload) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("campaign_payments").insert(payload);
  if (error) throw error;
}

// Правка суммы в старой таблице взносов: сумма + способ + заметка
export async function saveFeeValue(rowId, columnId, amount, method, note) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase
    .from("fee_values")
    .upsert({ row_id: rowId, column_id: columnId, amount, method: method || null, note: note || null }, { onConflict: "row_id,column_id" });
  if (error) throw error;
}

// Разовые поступления (сдал другой ученик, пожертвование и т.п.)
export async function fetchOneOffIncomes() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("one_off_incomes").select("*").order("date", { ascending: false });
  if (error) {
    console.error("Supabase (разовые поступления):", error);
    return null;
  }
  return data.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function addOneOffIncome(payload) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("one_off_incomes").insert(payload);
  if (error) throw error;
}

// Журнал правок сумм (виден родителям — прозрачность)
export async function fetchFeeEditsLog() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("fee_edits_log").select("*").order("at", { ascending: false }).limit(200);
  if (error) {
    console.error("Supabase (журнал правок):", error);
    return null;
  }
  return data;
}

export async function addFeeEdit(entry) {
  if (!supabase) return;
  const { error } = await supabase.from("fee_edits_log").insert(entry);
  if (error) console.error("Supabase (журнал правок):", error);
}

// Суммы для кассы на главной: платежи по сборам + разовые поступления
export async function fetchCashExtras() {
  if (!supabase) return null;
  const [oRes, pRes] = await Promise.all([
    supabase.from("one_off_incomes").select("amount"),
    supabase.from("campaign_payments").select("amount"),
  ]);
  if (oRes.error || pRes.error) return null;
  const sum = (arr) => Math.round(arr.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;
  return { oneOff: sum(oRes.data), campaigns: sum(pRes.data) };
}

// Загрузка расписания: звонки + уроки (null = база недоступна, показываем запасные данные)
export async function fetchSchedule() {
  if (!supabase) return null;
  const [bRes, lRes] = await Promise.all([
    supabase.from("schedule_bells").select("*").order("pos", { ascending: true }),
    supabase.from("schedule_lessons").select("*").order("day", { ascending: true }).order("pos", { ascending: true }),
  ]);
  if (bRes.error || lRes.error) {
    console.error("Supabase (расписание):", bRes.error || lRes.error);
    return null;
  }
  if (!bRes.data.length && !lRes.data.length) return null; // таблицы ещё не созданы/пустые
  return { bells: bRes.data, lessons: lRes.data };
}

// ===== Изменения расписания (замены) =====
// Основное расписание хранится в schedule_lessons и не трогается —
// замены лежат отдельно в schedule_overrides и действуют только в свой период.

// Все замены (черновики + опубликованные + отменённые). null = таблица не создана.
export async function fetchScheduleOverrides() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("schedule_overrides")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Supabase (замены расписания):", error);
    return null;
  }
  return data;
}

// Создание/обновление замены (черновик или сразу публикация)
export async function saveScheduleOverride(payload) {
  if (!supabase) throw new Error("База не настроена");
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("schedule_overrides").update(rest).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("schedule_overrides").insert(payload).select().single();
  if (error) throw error;
  return data;
}

// Отмена опубликованной замены — расписание возвращается к прежнему виду
export async function cancelScheduleOverride(id, actor) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase
    .from("schedule_overrides")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: actor })
    .eq("id", id);
  if (error) throw error;
}

// Удаление черновика
export async function deleteScheduleDraft(id) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("schedule_overrides").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}

// Запись в историю изменений расписания (кто/когда/что сделал)
export async function addScheduleHistory(entry) {
  if (!supabase) return;
  const { error } = await supabase.from("schedule_history").insert(entry);
  if (error) console.error("Supabase (история расписания):", error);
}

// История изменений расписания
export async function fetchScheduleHistory() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("schedule_history").select("*").order("at", { ascending: false }).limit(100);
  if (error) {
    console.error("Supabase (история расписания):", error);
    return null;
  }
  return data;
}

// Роль вошедшего пользователя: 'teacher' | 'committee' | null (таблицы нет / роли нет)
export async function fetchUserRole() {
  if (!supabase) return null;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("user_roles").select("role, display_name").eq("user_id", uid).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Проверка семейного кода при входе родителя.
// Возвращает { ok, fallback }: ok — код подошёл; fallback = true значит,
// что таблица кодов ещё не создана в базе — пускаем без проверки,
// чтобы приложение не сломалось до запуска family-codes-setup.sql.
export async function verifyFamilyCode(familyN, code) {
  if (!supabase) return { ok: true, fallback: true };
  const { data, error } = await supabase.rpc("verify_family_code", {
    p_n: familyN,
    p_code: code,
  });
  if (error) {
    // Функции ещё нет в базе (SQL не запускали) — не блокируем вход
    if (error.code === "PGRST202" || error.code === "42883") {
      console.warn("verify_family_code ещё не создана — вход без проверки кода");
      return { ok: true, fallback: true };
    }
    throw error;
  }
  return { ok: data === true, fallback: false };
}

// Пометки по детям: кто ходит в ГПД + свободные заметки.
// null = таблица child_notes ещё не создана — показываем встроенный список из data.js
export async function fetchChildNotes() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("child_notes").select("*");
  if (error) {
    console.error("Supabase (пометки по детям):", error);
    return null;
  }
  if (!data.length) return null;
  const map = {};
  data.forEach((r) => { map[r.child] = { id: r.id, gpd: !!r.gpd, note: r.note || "" }; });
  return map;
}

// Сохранение пометки по ребёнку (только комитет — RLS пропускает вошедших)
export async function saveChildNote(child, gpd, note) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase
    .from("child_notes")
    .upsert({ child, gpd, note, updated_at: new Date().toISOString() }, { onConflict: "child" });
  if (error) throw error;
}

// Дни рождения детей (null = таблица не создана, показываем встроенный список)
export async function fetchBirthdays() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("birthdays")
    .select("*")
    .order("last_name", { ascending: true });
  if (error) {
    console.error("Supabase (дни рождения):", error);
    return null;
  }
  if (!data.length) return null;
  return data.map((r) => ({ id: r.id, first: r.first_name, last: r.last_name, born: r.born }));
}

// ===== Объявления и голосования (Этап 2) =====

// Все объявления (активные + архив). null = таблица ещё не создана.
export async function fetchAnnouncements() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Supabase (объявления):", error);
    return null;
  }
  return data;
}

// Создание/обновление объявления (только комитет и учитель)
export async function saveAnnouncement(payload) {
  if (!supabase) throw new Error("База не настроена");
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("announcements").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("announcements").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAnnouncement(id) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

// Отметки «прочитано» по всем объявлениям
export async function fetchNewsReads() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("news_reads").select("*");
  if (error) {
    console.error("Supabase (прочтения):", error);
    return null;
  }
  return data;
}

// Пометить объявление прочитанным семьёй (без пароля — доверяем выбору семьи)
export async function markRead(announcementId, familyN, child) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase
    .from("news_reads")
    .insert({ announcement_id: announcementId, family_n: familyN, child: child || "" });
  // 23505 = уже отмечено этой семьёй — не ошибка
  if (error && error.code !== "23505") throw error;
}

// Все голосования с вариантами и голосами. null = таблицы ещё не созданы.
export async function fetchPolls() {
  if (!supabase) return null;
  const [pRes, oRes, vRes] = await Promise.all([
    supabase.from("polls").select("*").order("created_at", { ascending: false }),
    supabase.from("poll_options").select("*").order("sort", { ascending: true }),
    supabase.from("poll_votes").select("*").order("voted_at", { ascending: true }),
  ]);
  if (pRes.error || oRes.error || vRes.error) {
    console.error("Supabase (голосования):", pRes.error || oRes.error || vRes.error);
    return null;
  }
  return pRes.data.map((p) => ({
    ...p,
    amount: p.amount == null ? null : Number(p.amount),
    options: oRes.data.filter((o) => o.poll_id === p.id),
    votes: vRes.data
      .filter((v) => v.poll_id === p.id)
      .map((v) => ({ ...v, amount: v.amount == null ? null : Number(v.amount) })),
  }));
}

// Создание/обновление голосования; options — массив строк (для single/multi)
export async function savePoll(payload, options) {
  if (!supabase) throw new Error("База не настроена");
  let poll;
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase.from("polls").update(rest).eq("id", id).select().single();
    if (error) throw error;
    poll = data;
  } else {
    const { data, error } = await supabase.from("polls").insert(payload).select().single();
    if (error) throw error;
    poll = data;
  }
  if (options) {
    // Пересоздаём варианты (правка блокируется в интерфейсе после первых голосов)
    const { error: dErr } = await supabase.from("poll_options").delete().eq("poll_id", poll.id);
    if (dErr) throw dErr;
    if (options.length) {
      const rows = options.map((title, i) => ({ poll_id: poll.id, title, sort: i }));
      const { error: iErr } = await supabase.from("poll_options").insert(rows);
      if (iErr) throw iErr;
    }
  }
  return poll;
}

export async function deletePoll(id) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("polls").delete().eq("id", id);
  if (error) throw error;
}

// Голос семьи: одна семья — один голос (повторный голос заменяет прежний)
export async function castVote(payload) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase
    .from("poll_votes")
    .upsert(payload, { onConflict: "poll_id,family_n" });
  if (error) {
    // Родители без пароля не могут обновлять — удаляем и вставляем заново нельзя,
    // поэтому при конфликте сообщаем, что семья уже голосовала
    if (error.code === "23505" || error.code === "42501") {
      throw new Error("Эта семья уже голосовала");
    }
    throw error;
  }
}

// Загрузка фото объявления в хранилище, возвращает публичную ссылку
export async function uploadNewsImage(file) {
  const blob = await compressReceipt(file);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("news").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("news").getPublicUrl(path).data.publicUrl;
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

// ===== Личные заметки и напоминания семей =====

// Все заметки семьи. Заодно тихо чистим выполненные старше 7 дней.
// null = таблица family_notes ещё не создана (SQL не запускали).
export async function fetchFamilyNotes(familyN) {
  if (!supabase || !familyN) return null;
  const { data, error } = await supabase
    .from("family_notes")
    .select("*")
    .eq("family_n", familyN)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Supabase (заметки семьи):", error);
    return null;
  }
  // Автоочистка: выполненные больше 7 дней назад удаляем
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stale = data.filter((n) => n.done && n.done_at && new Date(n.done_at).getTime() < weekAgo);
  if (stale.length) {
    supabase.from("family_notes").delete().in("id", stale.map((n) => n.id))
      .then(({ error: e }) => { if (e) console.error("Supabase (очистка заметок):", e); });
    return data.filter((n) => !stale.includes(n));
  }
  return data;
}

// Новая заметка или напоминание (свои — или от комитета конкретной семье)
export async function addFamilyNote(payload) {
  if (!supabase) throw new Error("База не настроена");
  const { data, error } = await supabase.from("family_notes").insert(payload).select().single();
  if (error) throw error;
  return data;
}

// Отметить выполненной / вернуть в работу
export async function toggleFamilyNote(id, done) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase
    .from("family_notes")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

// Удаление заметки
export async function deleteFamilyNote(id) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("family_notes").delete().eq("id", id);
  if (error) throw error;
}

// Заметки, отправленные учителем (для его кабинета — что уже разослано)
// null = колонки from_teacher ещё нет (teacher-setup.sql не запускали).
export async function fetchTeacherNotes() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("family_notes")
    .select("*")
    .eq("from_teacher", true)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("Supabase (заметки учителя):", error);
    return null;
  }
  return data;
}

// ===== Домашнее задание =====

// Задания начиная со вчера (вчера — чтобы вечером было видно «что задали»).
// null = таблицы homework ещё нет.
export async function fetchHomework() {
  if (!supabase) return null;
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("homework")
    .select("*")
    .gte("on_date", from)
    .order("on_date", { ascending: true });
  if (error) {
    console.error("Supabase (домашнее задание):", error);
    return null;
  }
  return data;
}

// Новое задание или правка существующего (по наличию id)
export async function saveHomework(payload) {
  if (!supabase) throw new Error("База не настроена");
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("homework")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("homework").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHomework(id) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("homework").delete().eq("id", id);
  if (error) throw error;
}

// ===== События класса =====

// События начиная с сегодня. null = таблицы class_events ещё нет.
export async function fetchClassEvents() {
  if (!supabase) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("class_events")
    .select("*")
    .gte("on_date", today)
    .order("on_date", { ascending: true });
  if (error) {
    console.error("Supabase (события класса):", error);
    return null;
  }
  return data;
}

export async function saveClassEvent(payload) {
  if (!supabase) throw new Error("База не настроена");
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("class_events")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("class_events").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClassEvent(id) {
  if (!supabase) throw new Error("База не настроена");
  const { error } = await supabase.from("class_events").delete().eq("id", id);
  if (error) throw error;
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
