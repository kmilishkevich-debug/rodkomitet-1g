// Пуш учителю о новой отметке отсутствия ребёнка от родителей.
// Без проверки входа: родители не аутентифицированы. Безопасно потому,
// что роут жёстко ограничен — получатель только учитель, заголовок
// фиксированный, текст обрезается, адрес — только внутри приложения.
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
  // Ссылка — только страница внутри приложения
  const raw = typeof body?.url === "string" ? body.url : "/";
  const url = raw.startsWith("/") ? raw : "/";
  const result = await sendPushToAll(
    { title: "Отметка об отсутствии", body: text, url },
    "teacher"
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
