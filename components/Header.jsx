import { Ic } from "./Art";
import NavIcon from "./NavIcons";

const TABS = [
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "schedule", icon: "i-clock", label: "Расписание" },
  { id: "fees", icon: "i-coin", label: "Сборы" },
  { id: "expenses", icon: "i-receipt", label: "Расходы" },
  { id: "shopping", icon: "i-cart", label: "Покупки" },
  { id: "votes", icon: "i-vote", label: "Голосования" },
  { id: "class", icon: "i-users", label: "Класс" },
  { id: "history", icon: "i-book", label: "История" },
];

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

export default function Header({ committee, tab, onTab, onLogout }) {
  return (
    <header>
      <div className="header-inner">
        <div className="logo"><span className="logo-badge">1«Г»</span>Наш 1 «Г»</div>
        <div className="spacer"></div>
        <div className="user-chip">
          <div className="avatar" id="userAvatar">{committee ? "КМ" : "ОС"}</div>
          <div className="name-block">
            <div id="userName">{committee ? "Кристина М." : "Ольга Смирнова"}</div>
            <div className="role-tag" id="userRole">{committee ? "член комитета" : "родитель"}</div>
          </div>
          <button className="exit-btn" onClick={onLogout} title="Выйти">
            <Ic id="i-door" /><span className="exit-label">Выход</span>
          </button>
        </div>
      </div>
      <nav className="topnav" id="mainNav">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            className={"nvi-host" + (tab === t.id ? " active" : "")}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={(e) => { playOnce(e); onTab(t.id); }}
          >
            <NavIcon name={t.id} uid={"top-" + t.id} size={36} />{t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export function BottomNav({ tab, onTab }) {
  const items = TABS.map((t) => {
    if (t.id === "votes") return { ...t, label: "Голоса" };
    if (t.id === "schedule") return { ...t, label: "Уроки" };
    return t;
  });
  return (
    <nav className="bottomnav" id="bottomNav">
      {items.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          className={"nvi-host" + (tab === t.id ? " active" : "")}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={(e) => { playOnce(e); onTab(t.id); }}
        >
          <NavIcon name={t.id} uid={"bot-" + t.id} size={36} />{t.label}
        </button>
      ))}
    </nav>
  );
}
