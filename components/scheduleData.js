// Расписание уроков — запасные данные (если база недоступна) и общие помощники.
// Действует первые 20 учебных дней (адаптационный период 1 «Г»).

export const DAY_NAMES = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
export const DAY_SHORT = ["", "Пн", "Вт", "Ср", "Чт", "Пт"];

export const BELLS_FALLBACK = [
  { pos: 1, start_time: "8:00", end_time: "8:35" },
  { pos: 2, start_time: "9:00", end_time: "9:35" },
  { pos: 3, start_time: "10:00", end_time: "10:35" },
  { pos: 4, start_time: "11:00", end_time: "11:35" },
  { pos: 5, start_time: "12:00", end_time: "12:35" },
];

const T = "Головко В. П.";
const INTRO = "Введение в школьную жизнь";
const PE = "Физическая культура и здоровье";
const PE_NOTE = "Спортивная форма и обувь";

export const LESSONS_FALLBACK = [
  { id: "m1", day: 1, pos: 1, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "m2", day: 1, pos: 2, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "m3", day: 1, pos: 3, subject: PE, note: PE_NOTE, room: "166", teacher: null },
  { id: "m4", day: 1, pos: 4, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "t1", day: 2, pos: 1, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "t2", day: 2, pos: 2, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "t3", day: 2, pos: 3, subject: PE, note: PE_NOTE, room: "166", teacher: null },
  { id: "t4", day: 2, pos: 4, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "w1", day: 3, pos: 1, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "w2", day: 3, pos: 2, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "w3", day: 3, pos: 3, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "w4", day: 3, pos: 4, subject: "Музыка", note: null, room: "166", teacher: null },
  { id: "th1", day: 4, pos: 1, subject: "Информационный час", note: null, room: "166", teacher: T },
  { id: "th2", day: 4, pos: 2, subject: PE, note: PE_NOTE, room: "166", teacher: null },
  { id: "th3", day: 4, pos: 3, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "th4", day: 4, pos: 4, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "th5", day: 4, pos: 5, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "f1", day: 5, pos: 1, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "f2", day: 5, pos: 2, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "f3", day: 5, pos: 3, subject: INTRO, note: null, room: "166", teacher: T },
  { id: "f4", day: 5, pos: 4, subject: "Классный час", note: null, room: "166", teacher: T },
];

// Какой день показывать на главной: до 13:00 в будни — сегодня,
// после 13:00 — завтра; в выходные — понедельник.
export function scheduleFocus(now = new Date()) {
  const dow = now.getDay(); // 0 = Вс … 6 = Сб
  const h = now.getHours();
  if (dow >= 1 && dow <= 5 && h < 13) return { day: dow, label: "сегодня" };
  if (dow >= 1 && dow <= 4) return { day: dow + 1, label: "завтра" };
  if (dow === 0) return { day: 1, label: "завтра" };
  return { day: 1, label: "в понедельник" }; // Пт после 13:00 и Сб
}

// Эмодзи-значок для предмета (чтобы детям и родителям было веселее)
export function subjectEmoji(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("физич") || s.includes("физкульт")) return "⚽";
  if (s.includes("музык")) return "🎵";
  if (s.includes("информацион")) return "📰";
  if (s.includes("классный")) return "🌟";
  if (s.includes("изо") || s.includes("рисов")) return "🎨";
  if (s.includes("матем")) return "🔢";
  if (s.includes("белорус")) return "📗";
  if (s.includes("чтен") || s.includes("литерат")) return "📖";
  if (s.includes("труд")) return "✂️";
  if (s.includes("человек и мир")) return "🌍";
  return "📚";
}
