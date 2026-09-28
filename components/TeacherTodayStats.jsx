"use client";

// ===== Полоса «Сегодня в цифрах» кабинета учителя =====
// Добавлена при редизайне главной кабинета 28.09.2026 (ТЗ §12–17).
// Четыре интерактивные карточки под hero: уроки сегодня (с учётом замен),
// активные задания, ближайшие события и непрочитанные сообщения от
// родителей. Все цифры живые — считаются из тех же данных, что и
// рабочие карточки ниже; клик ведёт к соответствующему разделу.
// Иконки — существующие объёмные webp из /public/icons (решение
// Кристины: не рисовать контурные SVG, оставить фирменный 3D-набор).

import {
  minskDateISO, isoToDay, activeOverridesFor, applyOverridesToDay,
} from "./scheduleOverrides";
import { LESSONS_FALLBACK } from "./scheduleData";

// Стрелка-шеврон справа в карточке — единственный контурный элемент,
// рядом с цифрами объёмная иконка была бы шумной
function Chevron() {
  return (
    <svg className="tc-stat-chev" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// «задание/задания/заданий», «урок/урока/уроков» — по правилам русского
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function StatCard({ tone, icon, value, label, sub, loading, onClick }) {
  return (
    <button className={"tc-stat " + tone} onClick={onClick} disabled={loading}>
      <span className="tc-stat-ico"><img src={icon} alt="" /></span>
      {loading ? (
        <span className="tc-stat-body">
          <span className="tc-skel tc-skel-num"></span>
          <span className="tc-skel tc-skel-line"></span>
        </span>
      ) : (
        <span className="tc-stat-body">
          <span className="tc-stat-num">{value}</span>
          <span className="tc-stat-label">{label}</span>
          {sub && <span className="tc-stat-sub">{sub}</span>}
        </span>
      )}
      <Chevron />
    </button>
  );
}

export default function TeacherTodayStats({ schedule, overrides, homework, events, familyMessages, onPick }) {
  const todayIso = minskDateISO();
  const day = isoToDay(todayIso); // 1=Пн … 7=Вс

  // --- Уроки сегодня: та же математика, что на главной родителей
  // (DashboardTab) — база из live-расписания или запасного набора,
  // поверх — активные опубликованные замены на сегодняшнюю дату.
  let lessonsCount = null; // null → «выходной», число → уроки
  let lessonsSub = "по расписанию";
  const schedLoading = schedule === null || overrides === null;
  if (!schedLoading && day >= 1 && day <= 5) {
    const allLessons = schedule?.lessons?.length ? schedule.lessons : LESSONS_FALLBACK;
    const ovs = activeOverridesFor(overrides || [], todayIso);
    const { lessons, changed } = applyOverridesToDay(allLessons, day, ovs);
    lessonsCount = lessons.length;
    lessonsSub = changed ? "есть изменения" : "по расписанию";
  }

  // --- Задания: актуальные — на сегодня и будущие даты
  const hwLoading = homework === null;
  const hwCount = (homework || []).filter((h) => h.on_date >= todayIso).length;

  // --- События: предстоящие, начиная с сегодняшнего дня
  const evLoading = events === null;
  const evCount = (events || []).filter((e) => e.on_date >= todayIso).length;

  // --- Сообщения: непрочитанные учителем письма от родителей
  const msgLoading = familyMessages === null;
  const msgCount = (familyMessages || []).filter((m) => !m.from_teacher && !m.read_teacher).length;

  return (
    <div className="tc-stats reveal" style={{ animationDelay: ".05s" }}>
      <StatCard
        tone="tone-per"
        icon="/icons/icon-book.webp"
        loading={schedLoading}
        value={lessonsCount === null ? "—" : lessonsCount}
        label={lessonsCount === null ? "выходной" : plural(lessonsCount, "урок сегодня", "урока сегодня", "уроков сегодня")}
        sub={lessonsCount === null ? "уроков нет" : lessonsSub}
        onClick={() => onPick?.("schedule")}
      />
      <StatCard
        tone="tone-green"
        icon="/icons/icon-backpack.webp"
        loading={hwLoading}
        value={hwCount}
        label={plural(hwCount, "активное задание", "активных задания", "активных заданий")}
        sub="сегодня и дальше"
        onClick={() => onPick?.("homework")}
      />
      <StatCard
        tone="tone-pink"
        icon="/icons/icon-calendar.webp"
        loading={evLoading}
        value={evCount}
        label={plural(evCount, "ближайшее событие", "ближайших события", "ближайших событий")}
        sub="в календаре класса"
        onClick={() => onPick?.("events")}
      />
      <StatCard
        tone="tone-blue"
        icon="/icons/icon-envelope.webp"
        loading={msgLoading}
        value={msgCount}
        label={plural(msgCount, "новое сообщение", "новых сообщения", "новых сообщений")}
        sub="от родителей"
        onClick={() => onPick?.("messages")}
      />
    </div>
  );
}
