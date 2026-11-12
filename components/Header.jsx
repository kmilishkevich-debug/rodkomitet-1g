"use client";
// Навигация приложения (редизайн 30.10.2026, ТЗ §7):
//  • ≥1024px — боковое меню слева (208px, на 1024–1279 — 176px) + верхняя
//    шапка контента с именем раздела и профилем;
//  • 768–1023px — шапка с кнопкой-бургером, меню выезжает слева;
//  • <768px — шапка + нижняя панель: Главная / Новости / Расписание / Чат / Ещё.
// Все прежние разделы доступны: деньги и календарь — в сайдбаре и в «Ещё».
import { useEffect, useRef, useState } from "react";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";

// Боковое меню родителя/комитета (ТЗ §7): все разделы по порядку
const SIDE_TABS = [
  { id: "dashboard", label: "Главная" },
  { id: "announcements", label: "Объявления" },
  { id: "schedule", label: "Расписание" },
  { id: "fees", label: "Сборы" },
  { id: "expenses", label: "Расходы" },
  { id: "votes", label: "Голосования" },
  { id: "class", label: "Класс" },
  { id: "photos", label: "Фото" },
  { id: "history", label: "История" },
  { id: "calendar", label: "Календарь" },
];

// Нижняя панель (мобильная, ТЗ §7): Главная / Новости / Расписание / Чат / Ещё.
// «Чат» — не вкладка, а существующая переписка с учителем: кнопка открывает
// главную и поднимает окно чата (флаг rk1g-open читает DashboardTab).
const BOTTOM_TABS = [
  { id: "dashboard", label: "Главная" },
  { id: "announcements", label: "Новости" },
  { id: "schedule", label: "Уроки" },
  { id: "chat", label: "Чат" },
];

// Каталог «Ещё»: всё остальное, включая деньги, календарь и «Мою семью»
const MORE_ITEMS = [
  { id: "fees", label: "Сборы" },
  { id: "expenses", label: "Расходы" },
  { id: "votes", label: "Голосования" },
  { id: "class", label: "Класс" },
  { id: "photos", label: "Фото" },
  { id: "history", label: "История" },
  { id: "calendar", label: "Календарь" },
  { id: "family", label: "Моя семья" },
];

// Денежные подпункты: пункт меню подсвечен, когда открыта вкладка «Деньги»
const MONEY_SUBS = ["fees", "expenses", "history"];

// ===== Меню классного руководителя =====
// У учителя нет доступа к деньгам; его дом — Кабинет.
const TEACHER_SIDE_TABS = [
  { id: "teacher", label: "Кабинет" },
  { id: "messages", label: "Сообщения" },
  { id: "announcements", label: "Объявления" },
  { id: "schedule", label: "Расписание" },
  { id: "votes", label: "Голосования" },
  { id: "class", label: "Класс" },
  { id: "photos", label: "Фото" },
];

const TEACHER_BOTTOM_TABS = [
  { id: "teacher", label: "Кабинет" },
  { id: "messages", label: "Сообщения" },
  { id: "schedule", label: "Уроки" },
  { id: "class", label: "Класс" },
];

const TEACHER_MORE_ITEMS = [
  { id: "announcements", label: "Объявления" },
  { id: "votes", label: "Голосования" },
  { id: "photos", label: "Фото класса" },
];

const isTeacher = (role) => role === "teacher";

// Подпись раздела для верхней шапки контента (десктоп)
const TAB_TITLES = {
  dashboard: "Главная", announcements: "Объявления", schedule: "Расписание",
  votes: "Голосования", class: "Класс", photos: "Фото класса",
  money: "Деньги класса", calendar: "Календарь",
  teacher: "Кабинет учителя", messages: "Сообщения",
};

// Однократное проигрывание анимации иконки при нажатии (демо-механика play)
function playOnce(e) {
  const b = e.currentTarget;
  setTimeout(() => {
    b.classList.remove("nvi-play");
    void b.offsetWidth;
    b.classList.add("nvi-play");
    clearTimeout(b._nviTimer);
    b._nviTimer = setTimeout(() => b.classList.remove("nvi-play"), 700);
  }, 0);
}

// Числовой бейдж непрочитанного на кнопке меню
function NavBadge({ n }) {
  if (!n) return null;
  return <span className="nav-badge">{n > 9 ? "9+" : n}</span>;
}

// Инициалы для кружка-аватара: «Головко В. П.» → «ГВ».
function initials(name, fallback = "У") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const a = parts[0][0] || "";
  const b = parts[1] ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

// Подпись рядом с аватаром: «Наталья Коваленкова» → «Наталья К.»
function shortName(name, fallback) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  if (!parts[1]) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

function BurgerIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y={open ? 9 : 7} width="20" height="3.2" rx="1.6" fill="currentColor" />
      <rect x="6" y="14.4" width="20" height="3.2" rx="1.6" fill="currentColor" />
      <rect x="6" y={open ? 20 : 22} width="20" height="3.2" rx="1.6" fill="currentColor" />
    </svg>
  );
}

export default function Header({ committee, role, teacherName, userFullName, tab, moneySub, onTab, onLogout, newsBadge = 0, pollsBadge = 0, notesBadge = 0, msgBadge = 0 }) {
  const teacher = isTeacher(role);
  const tabs = teacher ? TEACHER_SIDE_TABS : SIDE_TABS;
  // Планшет: меню выезжает слева по кнопке-бургеру
  const [drawer, setDrawer] = useState(false);
  const burgerRef = useRef(null);
  const isActive = (t) =>
    t.id === tab || (tab === "money" && MONEY_SUBS.includes(t.id) && moneySub === t.id);
  const badgeFor = (id) => (id === "announcements" ? newsBadge : id === "votes" ? pollsBadge : id === "messages" ? msgBadge : id === "dashboard" || id === "teacher" ? notesBadge : 0);

  // Esc закрывает выехавшее меню и возвращает фокус на бургер (ТЗ §18)
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDrawer(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const me = userFullName || teacherName || "";
  const avatar = teacher || committee ? initials(me, committee ? "К" : "У") : "Р";
  const nameText = teacher
    ? (teacherName || "Учитель")
    : committee ? shortName(me, "Комитет") : "Родитель";
  const roleText = teacher ? "классный руководитель" : committee ? "член комитета" : "родитель";
  const pageTitle = tab === "money"
    ? (moneySub === "expenses" ? "Расходы" : moneySub === "history" ? "История" : "Сборы")
    : TAB_TITLES[tab] || "Наш 1 «Г»";

  const pick = (id) => {
    setDrawer(false);
    onTab(id);
  };

  return (
    <>
      {/* Боковое меню: постоянное ≥1024px, на планшете — выдвижное */}
      {drawer && <div className="side-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={"sidenav" + (drawer ? " open" : "")} aria-label="Разделы сайта">
        <div className="side-brand">
          <span className="logo-badge">1«Г»</span>
          <span className="side-brand-text">
            <b>Наш 1 «Г»</b>
            <small>школа №227, Минск</small>
          </span>
        </div>
        <nav className="side-list">
          {tabs.map((t) => (
            <button
              key={t.id}
              data-tab={t.id}
              className={"side-item" + (isActive(t) ? " active" : "")}
              aria-current={isActive(t) ? "page" : undefined}
              onClick={() => pick(t.id)}
            >
              <NavIcon name={t.id} uid={"side-" + t.id} size={22} />
              <span className="side-label">{t.label}</span>
              <NavBadge n={badgeFor(t.id)} />
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="side-exit" onClick={() => { setDrawer(false); onLogout(); }}>
            <Ic id="i-door" />Выход
          </button>
        </div>
      </aside>

      {/* Верхняя шапка: контекст раздела + профиль */}
      <header className="appbar">
        <div className="header-inner">
          <button
            ref={burgerRef}
            className="burger"
            aria-label={drawer ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={drawer}
            onClick={() => setDrawer((v) => !v)}
          >
            <BurgerIcon open={drawer} />
          </button>
          <div className="logo appbar-logo"><span className="logo-badge">1«Г»</span>Наш 1 «Г»</div>
          <div className="appbar-title" aria-hidden="true">{pageTitle}</div>
          <div className="spacer"></div>
          <div className={"user-chip" + (teacher ? " is-teacher" : "")}>
            <div className="avatar" id="userAvatar">{avatar}</div>
            <div className="name-block">
              <div id="userName">{nameText}</div>
              <div className="role-tag" id="userRole">{roleText}</div>
            </div>
            <button className="exit-btn" onClick={onLogout} title="Выйти">
              <Ic id="i-door" /><span className="exit-label">Выход</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function BottomNav({ tab, role, moneySub, onTab, newsBadge = 0, pollsBadge = 0, notesBadge = 0, msgBadge = 0 }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const teacher = isTeacher(role);
  const tabs = teacher ? TEACHER_BOTTOM_TABS : BOTTOM_TABS;
  const more = teacher ? TEACHER_MORE_ITEMS : MORE_ITEMS;
  const moreActive = more.some((m) => m.id === tab) || (!teacher && (tab === "money" || tab === "calendar"));
  const pick = (id) => {
    setMoreOpen(false);
    if (id === "family") {
      // «Моя семья» — сводка семьи на главной (существующее окно «Мой ребёнок»)
      try { sessionStorage.setItem("rk1g-open", "family"); } catch {}
      onTab("dashboard");
      // Если главная уже открыта, перерендера может не быть — будим её событием
      try { window.dispatchEvent(new Event("rk1g-open")); } catch {}
      return;
    }
    onTab(id);
  };
  const openChat = () => {
    // «Чат» — существующая переписка с учителем поверх главной (ТЗ §7)
    setMoreOpen(false);
    try { sessionStorage.setItem("rk1g-open", "chat"); } catch {}
    onTab("dashboard");
    // Если главная уже открыта, перерендера может не быть — будим её событием
    try { window.dispatchEvent(new Event("rk1g-open")); } catch {}
  };
  return (
    <nav className="bottomnav" id="bottomNav">
      {tabs.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          className={"nvi-host" + (tab === t.id && t.id !== "chat" ? " active" : "")}
          aria-current={tab === t.id && t.id !== "chat" ? "page" : undefined}
          onClick={(e) => {
            playOnce(e);
            if (t.id === "chat") { openChat(); return; }
            setMoreOpen(false);
            onTab(t.id);
          }}
        >
          {t.id === "chat"
            ? <NavIcon name="messages" uid="bot-chat" size={36} />
            : <NavIcon name={t.id} uid={"bot-" + t.id} size={36} />}
          {t.label}
          {t.id === "chat" && msgBadge > 0 && <span className="nav-badge">{msgBadge > 9 ? "9+" : msgBadge}</span>}
          {(t.id === "dashboard" || t.id === "teacher") && notesBadge > 0 && <span className="nav-badge">{notesBadge > 9 ? "9+" : notesBadge}</span>}
          {t.id === "announcements" && newsBadge > 0 && <span className="nav-badge">{newsBadge > 9 ? "9+" : newsBadge}</span>}
          {t.id === "messages" && msgBadge > 0 && <span className="nav-badge">{msgBadge > 9 ? "9+" : msgBadge}</span>}
        </button>
      ))}
      <div className="bnav-more-wrap">
        {moreOpen && <div className="bnav-backdrop" onClick={() => setMoreOpen(false)}></div>}
        <button
          data-tab="more"
          className={"nvi-host" + (moreActive ? " active" : "")}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <BurgerIcon open={moreOpen} />Ещё
          {/* Бейдж того, что спрятано внутри «Ещё» */}
          {(teacher ? newsBadge + pollsBadge : pollsBadge) > 0 && (
            <span className="nav-badge">{(teacher ? newsBadge + pollsBadge : pollsBadge) > 9 ? "9+" : (teacher ? newsBadge + pollsBadge : pollsBadge)}</span>
          )}
        </button>
        {moreOpen && (
          <div className="bnav-more-menu" role="menu">
            {more.map((m) => (
              <button
                key={m.id}
                role="menuitem"
                className={(tab === "money" && moneySub === m.id) || tab === m.id ? "active" : ""}
                onClick={() => pick(m.id)}
              >
                <NavIcon name={m.id === "family" ? "class" : m.id} uid={"more-" + m.id} size={26} />{m.label}
                {m.id === "announcements" && newsBadge > 0 && <span className="nav-badge">{newsBadge > 9 ? "9+" : newsBadge}</span>}
                {m.id === "votes" && pollsBadge > 0 && <span className="nav-badge">{pollsBadge > 9 ? "9+" : pollsBadge}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
