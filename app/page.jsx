"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Sprite } from "@/components/Art";
import LoginScreen from "@/components/LoginScreen";
import Header, { BottomNav } from "@/components/Header";
import DashboardTab from "@/components/DashboardTab";
import MoneyTab from "@/components/MoneyTab";
import VotesTab from "@/components/VotesTab";
import ClassTab from "@/components/ClassTab";
import ScheduleTab from "@/components/ScheduleTab";
import UploadModal from "@/components/UploadModal";
import LogoutModal from "@/components/LogoutModal";
import { supabase, fetchExpenseGroups, fetchSchedule, fetchBirthdays, fetchScheduleOverrides, fetchUserRole } from "@/lib/supabase";
import { enablePush, syncPushRole } from "@/lib/push";

export default function Page() {
  const [role, setRole] = useState(null); // null | 'parent' | 'committee' | 'teacher'
  const [authorName, setAuthorName] = useState(null); // имя для истории изменений расписания
  const [tab, setTab] = useState("dashboard");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const [upload, setUpload] = useState({ open: false, name: "—", sum: "—" });
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  // Маскот на главной: приветствие раз за визит/вход, реакции на дела и выход
  const mascotRef = useRef(null);
  const [greetToken, setGreetToken] = useState(0);
  // Подвкладка раздела «Деньги»: fees | expenses | history
  const [moneySub, setMoneySub] = useState("fees");

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3800);
  }, []);

  const committee = role === "committee";
  const teacher = role === "teacher";
  const canEditSchedule = committee || teacher; // учитель меняет только расписание

  // Кто вносит изменения расписания — для истории и подписи замен
  const author = authorName || (teacher ? "Учитель" : committee ? "Комитет" : "");

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

  // Замены расписания (изменения поверх основного; null = таблица ещё не создана)
  const [liveOverrides, setLiveOverrides] = useState(null);
  const reloadOverrides = useCallback(async () => {
    const data = await fetchScheduleOverrides();
    if (data) setLiveOverrides(data);
  }, []);
  useEffect(() => {
    reloadOverrides();
  }, [reloadOverrides]);

  // Имя вошедшего (для подписи изменений расписания)
  useEffect(() => {
    if (role === "committee" || role === "teacher") {
      fetchUserRole().then((data) => {
        if (data?.display_name) setAuthorName(data.display_name);
      });
    } else {
      setAuthorName(null);
    }
  }, [role]);

  // Живые дни рождения из базы (null = встроенный список из birthdaysData.js)
  const [liveBirthdays, setLiveBirthdays] = useState(null);
  useEffect(() => {
    fetchBirthdays().then((data) => {
      if (data) setLiveBirthdays(data);
    });
  }, []);

  // Разбор адреса раздела: /?tab=... → вкладка (старые адреса денег ведут в «Деньги»)
  const applyRoute = useCallback((t) => {
    if (!t) return;
    if (t === "birthdays") t = "class"; // старые пуш-уведомления о днях рождения
    if (["fees", "expenses", "history", "shopping"].includes(t)) {
      setTab("money");
      setMoneySub(t === "shopping" ? "expenses" : t);
    } else if (["dashboard", "schedule", "votes", "class", "money"].includes(t)) {
      setTab(t);
      if (t === "money") setMoneySub((s) => s || "fees");
    }
  }, []);

  // Записываем раздел в адресную строку — работают «назад» и прямые ссылки
  const pushTab = (t) => {
    try {
      window.history.pushState({ tab: t }, "", t === "dashboard" ? window.location.pathname : `?tab=${t}`);
    } catch {}
  };

  // Запоминаем вход + открываем нужную вкладку из адреса (/?tab=...)
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("rk1g-role");
    } catch {}
    if (saved === "parent" || saved === "committee" || saved === "teacher") {
      // Комитет и учитель с подключённой базой должны иметь живую сессию — иначе просим войти заново
      if ((saved === "committee" || saved === "teacher") && supabase) {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            setRole(saved);
            setGreetToken((t) => t + 1); // маскот поздоровается один раз
            syncPushRole(saved); // тихо обновляем подписку на пуши
          } else {
            try { localStorage.removeItem("rk1g-role"); } catch {}
          }
        });
      } else {
        setRole(saved);
        setGreetToken((t) => t + 1); // маскот поздоровается один раз
        syncPushRole(saved); // тихо обновляем подписку на пуши
      }
      applyRoute(new URLSearchParams(window.location.search).get("tab"));
    }
    // Кнопки «назад/вперёд» браузера переключают разделы
    const onPop = () => applyRoute(new URLSearchParams(window.location.search).get("tab") || "dashboard");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyRoute]);

  const login = (r) => {
    setRole(r);
    setGreetToken((t) => t + 1); // новое приветствие после ручного входа
    try {
      localStorage.setItem("rk1g-role", r);
    } catch {}
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab) {
      applyRoute(urlTab);
    } else {
      setTab("dashboard");
    }
    setNotifOpen(false);
    // Автоматически включаем пуш-уведомления при входе (клик по кнопке = разрешение браузера)
    enablePush(r);
    if (r === "committee") {
      toast("Вы вошли как член комитета: доступны подтверждение чеков, создание сборов, расходов и голосований");
    }
    if (r === "teacher") {
      toast("Вы вошли как учитель: можно вносить изменения в расписание");
    }
  };

  const logout = () => {
    setLogoutOpen(false);
    setRole(null);
    setNotifOpen(false);
    try {
      localStorage.removeItem("rk1g-role");
    } catch {}
    if (supabase) supabase.auth.signOut();
  };

  const showTab = (t) => {
    applyRoute(t);
    pushTab(t);
    setNotifOpen(false);
    window.scrollTo({ top: 0 });
  };

  const showMoneySub = (s) => {
    setMoneySub(s);
    pushTab(s);
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
            moneySub={moneySub}
            onTab={showTab}
            notifOpen={notifOpen}
            notifSeen={notifSeen}
            onToggleNotif={toggleNotif}
            onLogout={() => {
              setLogoutOpen(true);
              mascotRef.current?.sad(); // маскот на главной грустнеет (если она открыта)
            }}
          />
          <main>
            {tab === "dashboard" && <DashboardTab committee={committee} role={role} toast={toast} onTab={showTab} onOpenUpload={openUpload} liveGroups={liveGroups} liveSchedule={liveSchedule} liveBirthdays={liveBirthdays} overrides={liveOverrides} mascotRef={mascotRef} greetToken={greetToken} />}
            {tab === "schedule" && <ScheduleTab committee={committee} canEditSchedule={canEditSchedule} author={author} toast={toast} liveSchedule={liveSchedule} onReload={reloadSchedule} overrides={liveOverrides} onReloadOverrides={reloadOverrides} />}
            {tab === "votes" && <VotesTab committee={committee} toast={toast} />}
            {tab === "class" && <ClassTab committee={committee} toast={toast} liveBirthdays={liveBirthdays} />}
            {tab === "money" && <MoneyTab sub={moneySub} onSub={showMoneySub} committee={committee} toast={toast} onOpenUpload={openUpload} liveGroups={liveGroups} onReload={reloadExpenses} />}
          </main>
          <BottomNav tab={tab} moneySub={moneySub} onTab={showTab} />
        </div>
      )}
      <UploadModal open={upload.open} name={upload.name} sum={upload.sum} onClose={closeUpload} toast={toast} />
      <LogoutModal
        open={logoutOpen}
        onStay={() => {
          setLogoutOpen(false);
          mascotRef.current?.stay(); // «Я ещё побуду!» — маскот радуется
        }}
        onLeave={logout}
      />
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
