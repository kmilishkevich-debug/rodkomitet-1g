// Пуш-напоминание о голосовании, которое ещё идёт. Шлёт комитет или
// учитель кнопкой «Напомнить» в карточке голосования.
// Без проверки входа: учитель и родители не аутентифицированы в Supabase.
// Безопасно потому, что роут жёстко ограничен — заголовок пуша
// фиксированный, текст обрезается, адрес только внутри приложения,
// получатели — родители.
import { NextResponse } from "next/server";
import { sendPushToAll, pushReady } from "@/lib/pushServer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!pushReady()) {
    return NextResponse.json(
      { ok: false, error: "Пуши не настроены (нет ключа на сервере)" },
      { status: 500 }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Неверный запрос" }, { status: 400 });
  }
  const text = (body?.body || "").trim().slice(0, 140);
  if (!text) {
    return NextResponse.json({ ok: false, error: "Пустое сообщение" }, { status: 400 });
  }
  const url = typeof body?.url === "string" && body.url.startsWith("/")
    ? body.url
    : "/?tab=votes";
  const result = await sendPushToAll(
    { title: "🗳 Голосование ещё идёт", body: text, url },
    "parents"
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
