// Пуш всем о новом событии с фото в фотоленте.
// Без проверки входа: родители не аутентифицированы. Безопасно потому,
// что роут жёстко ограничен — заголовок фиксированный, текст обрезается,
// адрес только внутри приложения.
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
  const text = (body?.body || "").trim().slice(0, 120);
  if (!text) {
    return NextResponse.json({ ok: false, error: "Пустое сообщение" }, { status: 400 });
  }
  const url = typeof body?.url === "string" && body.url.startsWith("/") ? body.url : "/";
  const result = await sendPushToAll(
    { title: "Новые фото", body: text, url },
    "all"
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
