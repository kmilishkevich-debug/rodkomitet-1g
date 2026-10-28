// ===== Набор стикеров «Наш пушистик» (ТЗ 28.10.2026, п. 15) =====
// Шесть готовых PNG с розовым лохматым маскотом и синей сумкой «1Г».
// Файлы лежат в public/stickers/ и являются готовой графикой:
// подпись («Спасибо!» и т.п.) — часть изображения, в интерфейсе
// она повторно не набирается. В сообщении хранится только id
// (колонка sticker в family_messages), а не текст подписи.

export const STICKER_SET_NAME = "Наш пушистик";

export const STICKERS = [
  { id: "thanks",     file: "/stickers/thanks.png",     label: "Спасибо!" },
  { id: "understood", file: "/stickers/understood.png", label: "Всё понятно" },
  { id: "good-day",   file: "/stickers/good-day.png",   label: "Хорошего дня!" },
  { id: "see-you",    file: "/stickers/see-you.png",    label: "До завтра!" },
  { id: "hooray",     file: "/stickers/hooray.png",     label: "Ура!" },
  { id: "received",   file: "/stickers/received.png",   label: "Получила!" },
];

export function stickerById(id) {
  return STICKERS.find((s) => s.id === id) || null;
}

// Недавно использованные стикеры — в localStorage, последние сверху
const RECENT_KEY = "rk1g-recent-stickers";

export function recentStickers() {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return ids.map(stickerById).filter(Boolean);
  } catch { return []; }
}

export function rememberSticker(id) {
  try {
    const ids = [id, ...JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((x) => x !== id)];
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 12)));
  } catch {}
}
