"use client";
import { useState } from "react";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";

// Верхнее меню (веб-версия): развёрнутое, как раньше — деньги отдельными пунктами
const TOP_TABS = [
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "announcements", icon: "i-bell", label: "Объявления" },
  { id: "schedule", icon: "i-clock", label: "Расписание" },
  { id: "fees", icon: "i-coin", label: "Сборы" },
  { id: "expenses", icon: "i-receipt", label: "Расходы" },
  { id: "votes", icon: "i-vote", label: "Голосования" },
  { id: "class", icon: "i-users", label: "Класс" },
  { id: "history", icon: "i-book", label: "История" },
];

// Нижняя панель (мобильная): 4 основные иконки + кнопка-каталог «Ещё»
const BOTTOM_TABS = [
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "votes", icon: "i-vote", label: "Голоса" },
  { id: "schedule", icon: "i-clock", label: "Уроки" },
  { id: "class", icon: "i-users", label: "Класс" },
];

// Разделы, которые не попали в иконки нижней панели — живут в каталоге «Ещё»
const MORE_ITEMS = [
  { id: "announcements", label: "Объявления" },
  { id: "fees", label: "Сборы" },
  { id: "expenses", label: "Расходы" },
  { id: "history", label: "История" },
];

// Денежные подпункты: пункт верхнего меню подсвечен, когда открыта
// вкладка «Деньги» с соответствующей подвкладкой
const MONEY_SUBS = ["fees", "expenses", "history"];

// ===== Меню классного руководителя =====
// У учителя нет доступа к деньгам: сборы, расходы и история из меню убраны.
// Вместо них первым пунктом стоит его кабинет.
const TEACHER_TOP_TABS = [
  { id: "teacher", icon: "i-edit", label: "Кабинет" },
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "announcements", icon: "i-bell", label: "Объявления" },
  { id: "schedule", icon: "i-clock", label: "Расписание" },
  { id: "votes", icon: "i-vote", label: "Голосования" },
  { id: "class", icon: "i-users", label: "Класс" },
];

const TEACHER_BOTTOM_TABS = [
  { id: "teacher", icon: "i-edit", label: "Кабинет" },
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "schedule", icon: "i-clock", label: "Уроки" },
  { id: "class", icon: "i-users", label: "Класс" },
];

const TEACHER_MORE_ITEMS = [
  { id: "announcements", label: "Объявления" },
  { id: "votes", label: "Голосования" },
];

const isTeacher = (role) => role === "teacher";

// Однократное проигрывание анимации иконки при нажатии (демо-механика play)
function playOnce(e) {
  const b = e.currentTarget;
  // Откладываем на тик: при смене вкладки React перезаписывает className
  // и стирает класс, добавленный синхронно. После перерисовки класс живёт.
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

// Инициалы для кружка-аватара: «Головко В. П.» → «ГВ»
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "У";
  const a = parts[0][0] || "";
  const b = parts[1] ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

export default function Header({ committee, role, teacherName, tab, moneySub, onTab, onLogout, newsBadge = 0, pollsBadge = 0, notesBadge = 0 }) {
  const teacher = isTeacher(role);
  const tabs = teacher ? TEACHER_TOP_TABS : TOP_TABS;
  const isActive = (t) =>
    t.id === tab || (tab === "money" && MONEY_SUBS.includes(t.id) && moneySub === t.id);
  const badgeFor = (id) => (id === "announcements" ? newsBadge : id === "votes" ? pollsBadge : id === "dashboard" ? notesBadge : 0);

  const avatar = teacher ? initials(teacherName) : committee ? "КМ" : "Р";
  const nameText = teacher ? (teacherName || "Учитель") : committee ? "Кристина М." : "Родитель";
  const roleText = teacher ? "классный руководитель" : committee ? "член комитета" : "родитель";

  return (
    <header>
      <div className="header-inner">
        <div className="logo"><span className="logo-badge">1«Г»</span>Наш 1 «Г»</div>
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
      <nav className="topnav" id="mainNav">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            className={"nvi-host" + (isActive(t) ? " active" : "")}
            aria-current={isActive(t) ? "page" : undefined}
            onClick={(e) => { playOnce(e); onTab(t.id); }}
          >
            <NavIcon name={t.id} uid={"top-" + t.id} size={36} />{t.label}
            <NavBadge n={badgeFor(t.id)} />
          </button>
        ))}
      </nav>
    </header>
  );
}

// Иконка-гамбургер (3 полоски) для кнопки «Ещё» — своей в NavIcons нет
function BurgerIcon({ open }) {
  return (
    <svg className="nvi" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y={open ? 9 : 8} width="20" height="3.2" rx="1.6" fill="currentColor" />
      <rect x="6" y="14.4" width="20" height="3.2" rx="1.6" fill="currentColor" />
      <rect x="6" y={open ? 20 : 21} width="20" height="3.2" rx="1.6" fill="currentColor" />
    </svg>
  );
}

export function BottomNav({ tab, role, moneySub, onTab, newsBadge = 0, pollsBadge = 0, notesBadge = 0 }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const teacher = isTeacher(role);
  const tabs = teacher ? TEACHER_BOTTOM_TABS : BOTTOM_TABS;
  const more = teacher ? TEACHER_MORE_ITEMS : MORE_ITEMS;
  const moreActive = more.some((m) => m.id === tab) || (!teacher && tab === "money");
  const pick = (id) => { setMoreOpen(false); onTab(id); };
  return (
    <nav className="bottomnav" id="bottomNav">
      {tabs.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          className={"nvi-host" + (tab === t.id ? " active" : "")}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={(e) => { playOnce(e); setMoreOpen(false); onTab(t.id); }}
        >
          <NavIcon name={t.id} uid={"bot-" + t.id} size={36} />{t.label}
          {t.id === "votes" && pollsBadge > 0 && <span className="nav-badge">{pollsBadge > 9 ? "9+" : pollsBadge}</span>}
          {t.id === "dashboard" && notesBadge > 0 && <span className="nav-badge">{notesBadge > 9 ? "9+" : notesBadge}</span>}
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
          {newsBadge > 0 && <span className="nav-badge">{newsBadge > 9 ? "9+" : newsBadge}</span>}
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
                <NavIcon name={m.id} uid={"more-" + m.id} size={26} />{m.label}
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
