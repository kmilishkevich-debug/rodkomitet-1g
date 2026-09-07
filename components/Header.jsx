import { Ic } from "./Art";

const TABS = [
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "fees", icon: "i-coin", label: "Сборы" },
  { id: "expenses", icon: "i-receipt", label: "Расходы" },
  { id: "shopping", icon: "i-cart", label: "Покупки" },
  { id: "votes", icon: "i-vote", label: "Голосования" },
  { id: "history", icon: "i-book", label: "История" },
];

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
          <button className="exit-btn" onClick={onLogout} title="Выйти">⏻</button>
        </div>
      </div>
      <nav className="topnav" id="mainNav">
        {TABS.map((t) => (
          <button key={t.id} data-tab={t.id} className={tab === t.id ? "active" : ""} onClick={() => onTab(t.id)}>
            <Ic id={t.icon} />{t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export function BottomNav({ tab, onTab }) {
  const items = TABS.map((t) => (t.id === "votes" ? { ...t, label: "Голоса" } : t));
  return (
    <nav className="bottomnav" id="bottomNav">
      {items.map((t) => (
        <button key={t.id} data-tab={t.id} className={tab === t.id ? "active" : ""} onClick={() => onTab(t.id)}>
          <Ic id={t.icon} className="ic mid" />{t.label}
        </button>
      ))}
    </nav>
  );
}
