// Дни рождения детей 1 «Г» — данные и вся логика напоминаний.
// Запасной список используется, пока таблица birthdays в Supabase не создана.

export const BIRTHDAYS_FALLBACK = [
  { id: 1,  first: "Ольга",    last: "Белоус",      born: "2019-10-27" },
  { id: 2,  first: "Давид",    last: "Богдан",      born: "2019-12-06" },
  { id: 3,  first: "Ульяна",   last: "Богдан",      born: "2019-12-06" },
  { id: 4,  first: "Карина",   last: "Гладкая",     born: "2020-05-19" },
  { id: 5,  first: "Алёна",    last: "Горлинская",  born: "2019-12-10" },
  { id: 6,  first: "Роман",    last: "Гурецкий",    born: "2019-10-13" },
  { id: 7,  first: "Варвара",  last: "Дашкевич",    born: "2019-08-04" },
  { id: 8,  first: "Илья",     last: "Дехтяр",      born: "2019-12-13" },
  { id: 9,  first: "Милана",   last: "Домашевич",   born: "2019-10-19" },
  { id: 10, first: "Арина",    last: "Дорошенко",   born: "2019-10-22" },
  { id: 11, first: "Анна",     last: "Казнадей",    born: "2019-09-02" },
  { id: 12, first: "Тимур",    last: "Кашуба",      born: "2020-05-04" },
  { id: 13, first: "София",    last: "Кнотько",     born: "2019-12-12" },
  { id: 14, first: "Тимофей",  last: "Коваленков",  born: "2020-01-06" },
  { id: 15, first: "Егор",     last: "Лаппо",       born: "2020-01-29" },
  { id: 16, first: "Арина",    last: "Левко",       born: "2020-01-30" },
  { id: 17, first: "Кирилл",   last: "Литош",       born: "2019-07-12" },
  { id: 18, first: "Ева",      last: "Милишкевич",  born: "2019-10-27" },
  { id: 19, first: "Доминик",  last: "Савчук",      born: "2020-07-21" },
  { id: 20, first: "Павел",    last: "Стасько",     born: "2019-11-10" },
  { id: 21, first: "Мохаммед", last: "Сиссауи",     born: "2019-03-21" },
  { id: 22, first: "Артём",    last: "Сухабок",     born: "2020-01-02" },
  { id: 23, first: "Алиса",    last: "Талако",      born: "2020-05-29" },
  { id: 24, first: "Андрей",   last: "Тылецкий",    born: "2020-04-07" },
  { id: 25, first: "Артём",    last: "Шилкин",      born: "2019-11-18" },
  { id: 26, first: "Тимофей",  last: "Шило",        born: "2019-12-20" },
  { id: 27, first: "Агата",    last: "Шурова",      born: "2020-02-13" },
];

// День летних детей: разовый праздник для всех, кто родился летом
export const SUMMER_DAY = "2026-09-11";

export const BD_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const bdName = (k) => `${k.first} ${k.last}`;

// «27 октября» — без года
export function fmtBd(born) {
  const [, m, d] = born.split("-").map(Number);
  return `${d} ${BD_MONTHS[m - 1]}`;
}

const dayMs = 24 * 60 * 60 * 1000;
const mid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Ближайший ДР: дата, сколько дней осталось (0 = сегодня) и сколько исполняется
export function bdInfo(born, today = new Date()) {
  const t = mid(today);
  const [, m, d] = born.split("-").map(Number);
  let next = new Date(t.getFullYear(), m - 1, d);
  if (next < t) next = new Date(t.getFullYear() + 1, m - 1, d);
  const days = Math.round((next - t) / dayMs);
  const turns = next.getFullYear() - Number(born.slice(0, 4));
  return { next, days, turns };
}

// Ближайшие именинники (для блока на Главной)
export function upcomingBirthdays(list, today = new Date(), n = 3) {
  return list
    .map((k) => ({ ...k, ...bdInfo(k.born, today) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, n);
}

// Летние дети (июнь–август) — их поздравляем на Дне летних детей
export function summerKids(list) {
  return list.filter((k) => {
    const m = Number(k.born.split("-")[1]);
    return m >= 6 && m <= 8;
  });
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Перечисление имён: «Оля и Ева», «Давид, Ульяна и Кирилл»
export function joinNames(kids, full = true) {
  const names = kids.map((k) => (full ? bdName(k) : k.first));
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " и " + names[names.length - 1];
}

// Все события дня рождения для текущего пользователя.
// Возвращает: { today: [дети с ДР сегодня], tomorrow: [ДР завтра — всем родителям],
//   soon: [{days, kids}] — комитету за 1–5 дней, summerToday, summerTomorrow }
export function birthdayEvents(list, committee, today = new Date()) {
  const withInfo = list.map((k) => ({ ...k, ...bdInfo(k.born, today) }));
  const todays = withInfo.filter((k) => k.days === 0);
  const tomorrow = withInfo.filter((k) => k.days === 1);

  // Комитету: все ДР в окне 1–5 дней, сгруппированные по дате
  let soon = [];
  if (committee) {
    const byDays = {};
    withInfo.filter((k) => k.days >= 1 && k.days <= 5).forEach((k) => {
      (byDays[k.days] = byDays[k.days] || []).push(k);
    });
    soon = Object.keys(byDays)
      .map(Number)
      .sort((a, b) => a - b)
      .map((days) => ({ days, kids: byDays[days] }));
  }

  const t = iso(mid(today));
  const tm = iso(new Date(mid(today).getTime() + dayMs));
  return {
    today: todays,
    tomorrow,
    soon,
    summerToday: t === SUMMER_DAY ? summerKids(list) : null,
    summerTomorrow: tm === SUMMER_DAY ? summerKids(list) : null,
  };
}

// «через 3 дня», «завтра», «послезавтра»
export function inDaysWord(days) {
  if (days === 1) return "завтра";
  if (days === 2) return "послезавтра";
  const d10 = days % 10;
  const d100 = days % 100;
  const word =
    d10 === 1 && d100 !== 11 ? "день"
    : d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14) ? "дня"
    : "дней";
  return `через ${days} ${word}`;
}
