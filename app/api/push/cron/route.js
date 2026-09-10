// Ежевечерняя рассылка о днях рождения (Vercel Cron, 19:00 по Минску).
// Всем родителям — напоминание за 1 день, комитету — за 2–5 дней.
import { NextResponse } from "next/server";
import { serverSupabase, sendPushToAll, pushReady, verifyCommittee } from "@/lib/pushServer";
import {
  BIRTHDAYS_FALLBACK,
  birthdayEvents,
  joinNames,
  inDaysWord,
} from "@/components/birthdaysData";

export const dynamic = "force-dynamic";

// «Сегодня» по минскому времени (UTC+3 круглый год)
function minskToday() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function minskTodayISO() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function loadKids(sb) {
  const { data, error } = await sb.from("birthdays").select("*");
  if (error || !data?.length) return BIRTHDAYS_FALLBACK;
  return data.map((r) => ({ id: r.id, first: r.first_name, last: r.last_name, born: r.born }));
}

export async function GET(request) {
  if (!pushReady()) return NextResponse.json({ ok: false, error: "VAPID-ключ не задан" });
  const sb = serverSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "База не настроена" });

  // Запуск разрешён крону Vercel или вошедшему комитету (для ручной проверки)
  const ua = request.headers.get("user-agent") || "";
  const isCron = ua.includes("vercel-cron");
  if (!isCron && !(await verifyCommittee(request))) {
    return NextResponse.json({ ok: false, error: "Доступ только для крона или комитета" }, { status: 401 });
  }

  // Защита от повторной отправки в один день: «занимаем» дату в журнале
  const day = minskTodayISO();
  const { error: claimErr } = await sb.from("push_log").insert({ day });
  if (claimErr) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Сегодня уже отправляли" });
  }

  const kids = await loadKids(sb);
  const ev = birthdayEvents(kids, true, minskToday());
  const results = [];

  // Всем родителям: ДР завтра
  if (ev.tomorrow.length) {
    const kidsList = ev.tomorrow;
    const turns = kidsList[0].turns;
    const title = "🎂 Завтра день рождения!";
    const body =
      kidsList.length === 1
        ? `Завтра день рождения у ${joinNames(kidsList)} — исполнится ${turns}!`
        : `Завтра дни рождения: ${joinNames(kidsList)}. Не забудьте поздравить!`;
    results.push(await sendPushToAll({ title, body, url: "/?tab=birthdays" }, "all"));
  }

  // Всем родителям: завтра День летних детей
  if (ev.summerTomorrow?.length) {
    results.push(
      await sendPushToAll(
        {
          title: "☀️ Завтра — День летних детей!",
          body: `Поздравляем летних именинников: ${joinNames(ev.summerTomorrow, false)}.`,
          url: "/?tab=birthdays",
        },
        "all"
      )
    );
  }

  // Комитету: напоминания за 2–5 дней (за 1 день комитет получает общий пуш)
  const soonForCommittee = ev.soon.filter((g) => g.days >= 2);
  if (soonForCommittee.length) {
    const lines = soonForCommittee.map(
      (g) => `${joinNames(g.kids)} — ${inDaysWord(g.days)}`
    );
    results.push(
      await sendPushToAll(
        {
          title: "🎈 Скоро дни рождения (комитету)",
          body: lines.join("; "),
          url: "/?tab=birthdays",
        },
        "committee"
      )
    );
  }

  const sent = results.reduce((s, r) => s + (r.sent || 0), 0);
  await sb.from("push_log").update({ sent }).eq("day", day);
  return NextResponse.json({ ok: true, day, notifications: results.length, sent });
}
