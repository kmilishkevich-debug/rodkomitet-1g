// Ручная рассылка пушей — только для вошедших членов комитета.
import { NextResponse } from "next/server";
import { verifyCommittee, sendPushToAll, pushReady } from "@/lib/pushServer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!pushReady()) {
    return NextResponse.json(
      { ok: false, error: "Пуши не настроены (нет ключа на сервере)" },
      { status: 500 }
    );
  }
  const allowed = await verifyCommittee(request);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Нужно войти как комитет" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Неверный запрос" }, { status: 400 });
  }
  const title = (body?.title || "").trim();
  const text = (body?.body || "").trim();
  if (!title || !text) {
    return NextResponse.json({ ok: false, error: "Нужны заголовок и текст" }, { status: 400 });
  }
  const audience = body?.audience === "committee" ? "committee" : "all";
  const url = typeof body?.url === "string" && body.url.startsWith("/") ? body.url : "/";
  const result = await sendPushToAll({ title, body: text, url }, audience);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
