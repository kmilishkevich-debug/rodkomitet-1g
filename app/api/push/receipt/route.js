// Пуш комитету о новом чеке от родителя по сбору.
// Без проверки входа: родители не аутентифицированы. Безопасно потому,
// что роут жёстко ограничен — получатели только комитет, заголовок
// фиксированный, текст обрезается, адрес — либо внутри приложения,
// либо прямая ссылка на файл в нашем хранилище чеков.
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
  const text = (body?.body || "").trim().slice(0, 160);
  if (!text) {
    return NextResponse.json({ ok: false, error: "Пустое сообщение" }, { status: 400 });
  }
  // Ссылка: или страница приложения, или файл из бакета receipts — ничего другого
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const raw = typeof body?.url === "string" ? body.url : "/";
  const allowedFile = base && raw.startsWith(base + "/storage/v1/object/public/receipts/");
  const url = raw.startsWith("/") || allowedFile ? raw : "/";
  const result = await sendPushToAll(
    { title: "Новый чек от родителя", body: text, url },
    "committee"
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
