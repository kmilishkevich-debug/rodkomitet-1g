"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Sprite } from "@/components/Art";
import LoginScreen from "@/components/LoginScreen";
import Header, { BottomNav } from "@/components/Header";
import DashboardTab from "@/components/DashboardTab";
import MoneyTab from "@/components/MoneyTab";
import VotesTab, { pollState } from "@/components/VotesTab";
import AnnouncementsTab from "@/components/AnnouncementsTab";
import ClassTab from "@/components/ClassTab";
import ScheduleTab from "@/components/ScheduleTab";
import UploadModal from "@/components/UploadModal";
import LogoutModal from "@/components/LogoutModal";
import { useFamily, loadSeen, saveSeen } from "@/components/FamilyPicker";
import { supabase, fetchExpenseGroups, fetchSchedule, fetchBirthdays, fetchScheduleOverrides, fetchUserRole, fetchAnnouncements, fetchNewsReads, fetchPolls } from "@/lib/supabase";
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

  // Тост: обычный текст или кликабельный (второй аргумент — действие по нажатию)
  const toast = useCallback((msg, action) => {
    setToastMsg({ text: msg, action: action || null });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), action ? 6000 : 3800);
  }, []);

  const committee = role === "committee";
  const teacher = role === "teacher";
  const canEditSchedule = committee || teacher; // учитель меняет только расписание

  // Кто вносит изменения расписания — для истории и подписи замен
  const author = authorName || (teacher ? "Учитель" : committee ? "Комитет" : "");

  // Кто сейчас за экраном и как перейти на вкладку — через ref, чтобы
  // колбэки обновления данных не пересоздавались на каждый рендер
  const authorRef = useRef("");
  authorRef.current = author;
  const showTabRef = useRef(() => {});

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

  // Замены расписания (изменения поверх основного; null = таблица ещё не создана).
  // Про новые опубликованные чужие замены показываем тост.
  const [liveOverrides, setLiveOverrides] = useState(null);
  const knownOvIds = useRef(null);
  const reloadOverrides = useCallback(async () => {
    const data = await fetchScheduleOverrides();
    if (!data) return;
    setLiveOverrides(data);
    const pubIds = new Set(data.filter((o) => o.status === "published").map((o) => o.id));
    if (knownOvIds.current) {
      const fresh = data.find(
        (o) => o.status === "published" && !knownOvIds.current.has(o.id) && (o.author || "") !== authorRef.current
      );
      if (fresh) {
        toast("В расписании появились изменения — нажмите, чтобы посмотреть", () => showTabRef.current("schedule"));
      }
    }
    knownOvIds.current = pubIds;
  }, [toast]);
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

  // ===== Объявления и голосования (Этап 2) =====
  // Семья на этом устройстве (для голосов и отметок «прочитано»)
  const [family, setFamily] = useFamily();

  // Объявления (null = таблицы ещё не созданы).
  // При каждом обновлении сравниваем со «знакомыми» — про новые чужие показываем тост.
  const [liveAnnouncements, setLiveAnnouncements] = useState(null);
  const knownAnnIds = useRef(null);
  const reloadAnnouncements = useCallback(async () => {
    const data = await fetchAnnouncements();
    setLiveAnnouncements(data);
    if (!data) return;
    const activeIds = new Set(data.filter((a) => a.status === "active").map((a) => a.id));
    if (knownAnnIds.current) {
      const fresh = data.find(
        (a) => a.status === "active" && !knownAnnIds.current.has(a.id) && (a.author || "") !== authorRef.current
      );
      if (fresh) {
        toast(`Новое объявление: «${fresh.title}» — нажмите, чтобы открыть`, () => {
          showTabRef.current("announcements");
          setTimeout(() => document.getElementById("ann-" + fresh.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
        });
      }
    }
    knownAnnIds.current = activeIds;
  }, [toast]);
  useEffect(() => {
    reloadAnnouncements();
  }, [reloadAnnouncements]);

  // Отметки «прочитано»
  const [liveReads, setLiveReads] = useState([]);
  const reloadReads = useCallback(async () => {
    const data = await fetchNewsReads();
    if (data) setLiveReads(data);
  }, []);
  useEffect(() => {
    reloadReads();
  }, [reloadReads]);

  // Голосования — тоже с тостом про новые чужие
  const [livePolls, setLivePolls] = useState(null);
  const knownPollIds = useRef(null);
  const reloadPolls = useCallback(async () => {
    const data = await fetchPolls();
    setLivePolls(data);
    if (!data) return;
    const ids = new Set(data.map((p) => p.id));
    if (knownPollIds.current) {
      const fresh = data.find(
        (p) => !knownPollIds.current.has(p.id) && pollState(p) === "open" && (p.author || "") !== authorRef.current
      );
      if (fresh) {
        toast(`Новое голосование: «${fresh.question}» — нажмите, чтобы ответить`, () => showTabRef.current("votes"));
      }
    }
    knownPollIds.current = ids;
  }, [toast]);
  useEffect(() => {
    reloadPolls();
  }, [reloadPolls]);

  // Бейджи в меню: сколько активных объявлений / открытых голосований ещё не видели на этом устройстве
  const [seenTick, setSeenTick] = useState(0); // перерисовка после отметки «видел»
  const newsBadge = (() => {
    if (!liveAnnouncements) return 0;
    const seen = loadSeen("rk1g-news-seen");
    return liveAnnouncements.filter((a) => a.status === "active" && !seen.has(a.id)).length;
  })();
  const pollsBadge = (() => {
    if (!livePolls) return 0;
    const seen = loadSeen("rk1g-polls-seen");
    return livePolls.filter((p) => pollState(p) === "open" && !seen.has(p.id)).length;
  })();

  // Открыл вкладку — всё в ней считается просмотренным (бейдж гаснет)
  useEffect(() => {
    if (tab === "announcements" && liveAnnouncements?.length) {
      const seen = loadSeen("rk1g-news-seen");
      liveAnnouncements.forEach((a) => seen.add(a.id));
      saveSeen("rk1g-news-seen", seen);
      setSeenTick((t) => t + 1);
    }
    if (tab === "votes" && livePolls?.length) {
      const seen = loadSeen("rk1g-polls-seen");
      livePolls.forEach((p) => seen.add(p.id));
      saveSeen("rk1g-polls-seen", seen);
      setSeenTick((t) => t + 1);
    }
  }, [tab, liveAnnouncements, livePolls]);
  void seenTick;

  // Живые дни рождения из базы (null = встроенный список из birthdaysData.js)
  const [liveBirthdays, setLiveBirthdays] = useState(null);
  const reloadBirthdays = useCallback(async () => {
    const data = await fetchBirthdays();
    if (data) setLiveBirthdays(data);
  }, []);
  useEffect(() => {
    reloadBirthdays();
  }, [reloadBirthdays]);

  // ===== Авто-обновление данных =====
  // Обновить всё сразу (объявления, прочитано, голосования, расходы, расписание, замены, дни рождения)
  const reloadAll = useCallback(() => {
    reloadAnnouncements();
    reloadReads();
    reloadPolls();
    reloadExpenses();
    reloadSchedule();
    reloadOverrides();
    reloadBirthdays();
  }, [reloadAnnouncements, reloadReads, reloadPolls, reloadExpenses, reloadSchedule, reloadOverrides, reloadBirthdays]);

  // При возврате в приложение (переключение окна/вкладки браузера) и раз в минуту — свежие данные
  useEffect(() => {
    if (!role) return;
    const onWake = () => {
      if (document.visibilityState === "visible") reloadAll();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reloadAll();
    }, 60000);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      clearInterval(timer);
    };
  }, [role, reloadAll]);

  // Мгновенные обновления (realtime): база сама сообщает об изменениях в таблицах.
  // Работает после запуска realtime-setup.sql в Supabase; без него данные всё равно
  // обновляются по таймеру и при возврате в приложение.
  useEffect(() => {
    if (!supabase || !role) return;
    const listen = (ch, table, handler) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table }, handler);
    let ch = supabase.channel("rk1g-live");
    ch = listen(ch, "announcements", reloadAnnouncements);
    ch = listen(ch, "news_reads", reloadReads);
    ch = listen(ch, "polls", reloadPolls);
    ch = listen(ch, "poll_options", reloadPolls);
    ch = listen(ch, "poll_votes", reloadPolls);
    ch = listen(ch, "schedule_overrides", reloadOverrides);
    ch = listen(ch, "schedule_lessons", reloadSchedule);
    ch = listen(ch, "schedule_bells", reloadSchedule);
    ch = listen(ch, "expense_groups", reloadExpenses);
    ch = listen(ch, "expenses", reloadExpenses);
    ch = listen(ch, "receipts", reloadExpenses);
    ch = listen(ch, "birthdays", reloadBirthdays);
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [role, reloadAnnouncements, reloadReads, reloadPolls, reloadOverrides, reloadSchedule, reloadExpenses, reloadBirthdays]);

  // Разбор адреса раздела: /?tab=... → вкладка (старые адреса денег ведут в «Деньги»)
  const applyRoute = useCallback((t) => {
    if (!t) return;
    if (t === "birthdays") t = "class"; // старые пуш-уведомления о днях рождения
    if (["fees", "expenses", "history", "shopping"].includes(t)) {
      setTab("money");
      setMoneySub(t === "shopping" ? "expenses" : t);
    } else if (["dashboard", "schedule", "announcements", "votes", "class", "money"].includes(t)) {
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

  const login = (r, fam) => {
    setRole(r);
    if (r === "parent" && fam) setFamily(fam); // семья привязана входом по коду
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
    setFamily(null); // отвязываем семью — при новом входе снова спросим код
    try {
      localStorage.removeItem("rk1g-role");
      localStorage.removeItem("rk1g-family");
    } catch {}
    if (supabase) supabase.auth.signOut();
  };

  const showTab = (t) => {
    applyRoute(t);
    pushTab(t);
    setNotifOpen(false);
    window.scrollTo({ top: 0 });
    // Переключение вкладки — заодно подтягиваем свежие данные этого раздела
    if (t === "announcements") {
      reloadAnnouncements();
      reloadReads();
    } else if (t === "votes") {
      reloadPolls();
    } else if (t === "schedule") {
      reloadSchedule();
      reloadOverrides();
    } else if (t === "money") {
      reloadExpenses();
    } else if (t === "dashboard") {
      reloadAll();
    }
  };
  showTabRef.current = showTab;

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
            newsBadge={newsBadge}
            pollsBadge={pollsBadge}
            notifOpen={notifOpen}
            notifSeen={notifSeen}
            onToggleNotif={toggleNotif}
            onLogout={() => {
              setLogoutOpen(true);
              mascotRef.current?.sad(); // маскот на главной грустнеет (если она открыта)
            }}
          />
          <main>
            {tab === "dashboard" && <DashboardTab committee={committee} role={role} toast={toast} onTab={showTab} onOpenUpload={openUpload} liveGroups={liveGroups} liveSchedule={liveSchedule} liveBirthdays={liveBirthdays} overrides={liveOverrides} mascotRef={mascotRef} greetToken={greetToken} authorName={authorName} announcements={liveAnnouncements} polls={livePolls} reads={liveReads} family={family} />}
            {tab === "schedule" && <ScheduleTab committee={committee} canEditSchedule={canEditSchedule} author={author} toast={toast} liveSchedule={liveSchedule} onReload={reloadSchedule} overrides={liveOverrides} onReloadOverrides={reloadOverrides} />}
            {tab === "announcements" && <AnnouncementsTab committee={committee} canEdit={committee || teacher} author={author} toast={toast} announcements={liveAnnouncements} reads={liveReads} onReload={reloadAnnouncements} onReloadReads={reloadReads} family={family} setFamily={setFamily} />}
            {tab === "votes" && <VotesTab committee={committee} canEdit={committee || teacher} author={author} toast={toast} polls={livePolls} onReload={reloadPolls} family={family} setFamily={setFamily} />}
            {tab === "class" && <ClassTab committee={committee} toast={toast} liveBirthdays={liveBirthdays} />}
            {tab === "money" && <MoneyTab sub={moneySub} onSub={showMoneySub} committee={committee} toast={toast} onOpenUpload={openUpload} liveGroups={liveGroups} onReload={reloadExpenses} author={author} />}
          </main>
          <BottomNav tab={tab} moneySub={moneySub} onTab={showTab} newsBadge={newsBadge} pollsBadge={pollsBadge} />
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
      {toastMsg && (
        <div
          className={"toast" + (toastMsg.action ? " toast-click" : "")}
          onClick={() => {
            if (toastMsg.action) {
              toastMsg.action();
              setToastMsg(null);
            }
          }}
        >
          {toastMsg.text}
        </div>
      )}
    </>
  );
}
