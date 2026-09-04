import { Ic } from "./Art";

const TABS = [
  { id: "dashboard", icon: "i-home", label: "Главная" },
  { id: "fees", icon: "i-coin", label: "Сборы" },
  { id: "expenses", icon: "i-receipt", label: "Расходы" },
  { id: "shopping", icon: "i-cart", label: "Купить" },
  { id: "votes", icon: "i-vote", label: "Голосования" },
  { id: "history", icon: "i-book", label: "История" },
];

export default function Header({ committee, tab, onTab, notifOpen, notifSeen, onToggleNotif, onLogout }) {
  return (
    <header>
      <div className="header-inner">
        <div className="logo"><span className="logo-badge">1«Г»</span>Наш 1 «Г»</div>
        <div className="spacer"></div>
        <button className="bell" onClick={onToggleNotif}>
          <Ic id="i-bell" className="ic mid" />
          {!notifSeen && <span className="dot" id="notifCount">3</span>}
        </button>
        <div className="user-chip">
          <div className="avatar" id="userAvatar">{committee ? "КМ" : "ОС"}</div>
          <div className="name-block">
            <div id="userName">{committee ? "Кристина М." : "Ольга Смирнова"}</div>
            <div className="role-tag" id="userRole">{committee ? "⭐ Член комитета" : "Родитель"}</div>
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
      {notifOpen && (
        <div id="notifPanel">
          <div className="head">Уведомления</div>
          <div className="notif"><div className="ico"><Ic id="i-vote" /></div><div>Новое голосование: «Подарки на Новый год» — проголосуйте до 10.09<div className="when">сегодня, 09:12</div></div></div>
          <div className="notif"><div className="ico"><Ic id="i-clock" /></div><div>Напоминание: взнос «Фонд класса — сентябрь» (15 BYN) до 12.09<div className="when">вчера, 18:00</div></div></div>
          <div className="notif"><div className="ico"><Ic id="i-check" /></div><div>Ваш чек по сбору «Экскурсия в музей» подтверждён комитетом<div className="when">02.09, 14:37</div></div></div>
          <div className="notif-channels">Дублируются: Telegram ✓ · Email ✓ · Push ✓</div>
        </div>
      )}
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
