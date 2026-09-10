"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Sprite } from "@/components/Art";
import LoginScreen from "@/components/LoginScreen";
import Header, { BottomNav } from "@/components/Header";
import DashboardTab from "@/components/DashboardTab";
import FeesTab from "@/components/FeesTab";
import ExpensesTab from "@/components/ExpensesTab";
import ShoppingTab from "@/components/ShoppingTab";
import VotesTab from "@/components/VotesTab";
import HistoryTab from "@/components/HistoryTab";
import ClassTab from "@/components/ClassTab";
import ScheduleTab from "@/components/ScheduleTab";
import UploadModal from "@/components/UploadModal";
import { supabase, fetchExpenseGroups, fetchSchedule, fetchBirthdays } from "@/lib/supabase";

export default function Page() {
  const [role, setRole] = useState(null); // null | 'parent' | 'committee'
  const [tab, setTab] = useState("dashboard");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const [upload, setUpload] = useState({ open: false, name: "—", sum: "—" });
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3800);
  }, []);

  const committee = role === "committee";

  // Живые расходы из базы (null = база не подключена, работаем на демо-данных)
  const [liveGroups, setLiveGroups] = useState(null);
  const reloadExpenses = useCallback(async () => {
    const data = await fetchExpenseGroups();
    if (data) setLiveGroups(data);
  }, []);
  useEffect(() => {
    reloadExpenses();
  }, [reloadExpenses]);

  // Живое расписание из базы (null = показываем встроенное на 20 учебных дней)
  const [liveSchedule, setLiveSchedule] = useState(null);
  const reloadSchedule = useCallback(async () => {
    const data = await fetchSchedule();
    if (data) setLiveSchedule(data);
  }, []);
  useEffect(() => {
    reloadSchedule();
  }, [reloadSchedule]);

  // Живые дни рождения из базы (null = встроенный список из birthdaysData.js)
  const [liveBirthdays, setLiveBirthdays] = useState(null);
  useEffect(() => {
    fetchBirthdays().then((data) => {
      if (data) setLiveBirthdays(data);
    });
  }, []);

  // Запоминаем вход + открываем нужную вкладку из ярлыка PWA (/?tab=...)
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("rk1g-role");
    } catch {}
    if (saved === "parent" || saved === "committee") {
      // Комитет с подключённой базой должен иметь живую сессию — иначе просим войти заново
      if (saved === "committee" && supabase) {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) setRole("committee");
          else {
            try { localStorage.removeItem("rk1g-role"); } catch {}
          }
        });
      } else {
        setRole(saved);
      }
      const t = new URLSearchParams(window.location.search).get("tab");
      if (["dashboard", "schedule", "fees", "expenses", "shopping", "votes", "class", "history"].includes(t)) {
        setTab(t);
      }
    }
  }, []);

  const login = (r) => {
    setRole(r);
    try {
      localStorage.setItem("rk1g-role", r);
    } catch {}
    setTab("dashboard");
    setNotifOpen(false);
    if (r === "committee") {
      toast("Вы вошли как член комитета: доступны подтверждение чеков, создание сборов, расходов и голосований");
    }
  };

  const logout = () => {
    setRole(null);
    setNotifOpen(false);
    try {
      localStorage.removeItem("rk1g-role");
    } catch {}
    if (supabase) supabase.auth.signOut();
  };

  const showTab = (t) => {
    setTab(t);
    setNotifOpen(false);
    window.scrollTo({ top: 0 });
  };

  const toggleNotif = () => {
    setNotifOpen(!notifOpen);
    setNotifSeen(true);
  };

  const openUpload = (name, sum) => setUpload({ open: true, name, sum });
  const closeUpload = () => setUpload((u) => ({ ...u, open: false }));

  return (
    <>
      <Sprite />
      {!role ? (
        <LoginScreen onLogin={login} />
      ) : (
        <div id="app">
          <Header
            committee={committee}
            tab={tab}
            onTab={showTab}
            notifOpen={notifOpen}
            notifSeen={notifSeen}
            onToggleNotif={toggleNotif}
            onLogout={logout}
          />
          <main>
            {tab === "dashboard" && <DashboardTab committee={committee} onTab={showTab} onOpenUpload={openUpload} liveGroups={liveGroups} liveSchedule={liveSchedule} liveBirthdays={liveBirthdays} />}
            {tab === "schedule" && <ScheduleTab committee={committee} toast={toast} liveSchedule={liveSchedule} onReload={reloadSchedule} />}
            {tab === "fees" && <FeesTab committee={committee} toast={toast} onOpenUpload={openUpload} />}
            {tab === "expenses" && <ExpensesTab committee={committee} toast={toast} liveGroups={liveGroups} onReload={reloadExpenses} />}
            {tab === "shopping" && <ShoppingTab committee={committee} toast={toast} />}
            {tab === "votes" && <VotesTab committee={committee} toast={toast} />}
            {tab === "class" && <ClassTab committee={committee} toast={toast} liveBirthdays={liveBirthdays} />}
            {tab === "history" && <HistoryTab toast={toast} />}
          </main>
          <BottomNav tab={tab} onTab={showTab} />
        </div>
      )}
      <UploadModal open={upload.open} name={upload.name} sum={upload.sum} onClose={closeUpload} toast={toast} />
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
