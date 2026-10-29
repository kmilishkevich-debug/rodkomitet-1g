// Пуш семье о личном сообщении учителя (переписка с семьёй).
// Раньше шёл через /api/push/send с проверкой входа: если сессия учителя
// протухала, сообщение сохранялось, а пуш молча пропадал (29.10.2026).
// Здесь без проверки входа — по образцу family-chat: роут жёстко
// ограничен, заголовок фиксированный, текст обрезается, адрес только
// внутри приложения, получатель — только подписки указанной семьи.
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
  // Номера семьи: только целые числа, не больше четырёх (близнецы)
  const familyNs = (Array.isArray(body?.familyNs) ? body.familyNs : [])
    .filter((n) => Number.isInteger(n))
    .slice(0, 4);
  if (!familyNs.length) {
    return NextResponse.json({ ok: false, error: "Не указана семья" }, { status: 400 });
  }
  const url = typeof body?.url === "string" && body.url.startsWith("/") ? body.url : "/";
  const result = await sendPushToAll(
    { title: "Сообщение от учителя", body: text, url },
    "family",
    { familyNs }
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
