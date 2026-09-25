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
import TeacherTab from "@/components/TeacherTab";
import UploadModal from "@/components/UploadModal";
import LogoutModal from "@/components/LogoutModal";
import { useFamily, loadSeen, saveSeen } from "@/components/FamilyPicker";
import { supabase, fetchExpenseGroups, fetchSchedule, fetchBirthdays, fetchScheduleOverrides, fetchUserRole, fetchAnnouncements, fetchNewsReads, fetchPolls, fetchFamilyNotes, fetchHomework, fetchClassEvents, fetchTeacherNotes, fetchFamilyMessages } from "@/lib/supabase";
import { enablePush, syncPushRole } from "@/lib/push";
import { isFormOpen, onFormsChange } from "@/lib/formGuard";

export default function Page() {
  const [role, setRole] = useState(null); // null | 'parent' | 'committee' | 'teacher'
  const [authorName, setAuthorName] = useState(null); // имя для истории изменений расписания
  const [greetingName, setGreetingName] = useState(null); // как здороваемся в кабинете учителя
  const [fullName, setFullName] = useState(null); // полное имя — для инициалов в кружке шапки
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
  // Роль через ref — чтобы разбор адреса не пересоздавался и не перезапускал вход
  const roleRef = useRef(null);
  roleRef.current = role;

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

  // Экранная клавиатура: прячем нижнюю панель, пока она открыта
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const sync = () => {
      const hidden = window.innerHeight - vv.height > 140;
      document.body.classList.toggle("kb-open", hidden);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.body.classList.remove("kb-open");
    };
  }, []);

  // Имя вошедшего (для подписи изменений расписания)
  // и отдельно — тёплое имя для приветствия в кабинете («Виктория Петровна»)
  useEffect(() => {
    if (role === "committee" || role === "teacher") {
      fetchUserRole().then((data) => {
        if (data?.display_name) setAuthorName(data.display_name);
        if (data?.greeting_name) setGreetingName(data.greeting_name);
        setFullName(data?.full_name || data?.display_name || null);
      });
    } else {
      setAuthorName(null);
      setGreetingName(null);
      setFullName(null);
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

  // Классный руководитель не видит объявления и голосования комитета:
  // только помеченные галочкой «видно учителю» и свои собственные.
  // Фильтруем один раз здесь, чтобы лента, главная и счётчики совпадали.
  const visibleTo = (list) => {
    if (!list || !teacher) return list;
    return list.filter((r) => r.teacher_visible || (authorName && r.author === authorName));
  };
  const shownAnnouncements = visibleTo(liveAnnouncements);
  const shownPolls = visibleTo(livePolls);

  // Бейджи в меню: сколько активных объявлений / открытых голосований ещё не видели на этом устройстве
  const [seenTick, setSeenTick] = useState(0); // перерисовка после отметки «видел»
  const newsBadge = (() => {
    if (!shownAnnouncements) return 0;
    const seen = loadSeen("rk1g-news-seen");
    return shownAnnouncements.filter((a) => a.status === "active" && !seen.has(a.id)).length;
  })();
  const pollsBadge = (() => {
    if (!shownPolls) return 0;
    const seen = loadSeen("rk1g-polls-seen");
    return shownPolls.filter((p) => pollState(p) === "open" && !seen.has(p.id)).length;
  })();

  // Открыл вкладку — всё в ней считается просмотренным (бейдж гаснет)
  useEffect(() => {
    if (tab === "announcements" && shownAnnouncements?.length) {
      const seen = loadSeen("rk1g-news-seen");
      shownAnnouncements.forEach((a) => seen.add(a.id));
      saveSeen("rk1g-news-seen", seen);
      setSeenTick((t) => t + 1);
    }
    if (tab === "votes" && shownPolls?.length) {
      const seen = loadSeen("rk1g-polls-seen");
      shownPolls.forEach((p) => seen.add(p.id));
      saveSeen("rk1g-polls-seen", seen);
      setSeenTick((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, liveAnnouncements, livePolls]);
  void seenTick;

  // Личные заметки и напоминания семьи (null = таблица не создана / семья не выбрана).
  // Про новое напоминание от комитета показываем тост.
  const [liveNotes, setLiveNotes] = useState(null);
  const knownNoteIds = useRef(null);
  const familyNRef = useRef(null);
  familyNRef.current = family?.n || null;
  const reloadNotes = useCallback(async () => {
    if (!familyNRef.current) {
      setLiveNotes(null);
      knownNoteIds.current = null;
      return;
    }
    const data = await fetchFamilyNotes(familyNRef.current);
    if (!data) return;
    setLiveNotes(data);
    const ids = new Set(data.map((n) => n.id));
    if (knownNoteIds.current) {
      const fresh = data.find((n) => n.from_committee && !n.done && !knownNoteIds.current.has(n.id));
      if (fresh) {
        toast("Вам напоминание от комитета — нажмите, чтобы посмотреть", () => showTabRef.current("dashboard"));
      }
    }
    knownNoteIds.current = ids;
  }, [toast]);
  useEffect(() => {
    knownNoteIds.current = null; // сменилась семья — считаем список новым
    reloadNotes();
  }, [reloadNotes, family?.n]);

  // Бейдж «Главная»: невыполненные напоминания, чей срок сегодня или уже прошёл
  const notesBadge = (() => {
    if (!liveNotes) return 0;
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return liveNotes.filter((n) => !n.done && n.remind_date && n.remind_date <= iso).length;
  })();

  // Живые дни рождения из базы (null = встроенный список из birthdaysData.js)
  const [liveBirthdays, setLiveBirthdays] = useState(null);
  const reloadBirthdays = useCallback(async () => {
    const data = await fetchBirthdays();
    if (data) setLiveBirthdays(data);
  }, []);
  useEffect(() => {
    reloadBirthdays();
  }, [reloadBirthdays]);

  // ===== Кабинет классного руководителя =====
  // Домашнее задание (null = таблица ещё не создана, карточка «От учителя» просто не появится)
  const [liveHomework, setLiveHomework] = useState(null);
  const knownHwIds = useRef(null);
  const reloadHomework = useCallback(async () => {
    const data = await fetchHomework();
    if (!data) return;
    setLiveHomework(data);
    const ids = new Set(data.map((h) => h.id));
    if (knownHwIds.current) {
      const fresh = data.find((h) => !knownHwIds.current.has(h.id) && (h.author || "") !== authorRef.current);
      if (fresh) {
        toast("Учитель записал домашнее задание — нажмите, чтобы посмотреть", () => showTabRef.current("dashboard"));
      }
    }
    knownHwIds.current = ids;
  }, [toast]);
  useEffect(() => {
    reloadHomework();
  }, [reloadHomework]);

  // События класса (поездки, праздники, собрания)
  const [liveEvents, setLiveEvents] = useState(null);
  const knownEvIds = useRef(null);
  const reloadEvents = useCallback(async () => {
    const data = await fetchClassEvents();
    if (!data) return;
    setLiveEvents(data);
    const ids = new Set(data.map((e) => e.id));
    if (knownEvIds.current) {
      const fresh = data.find((e) => !knownEvIds.current.has(e.id) && (e.author || "") !== authorRef.current);
      if (fresh) {
        toast(`Новое событие класса: «${fresh.title}»`, () => showTabRef.current("dashboard"));
      }
    }
    knownEvIds.current = ids;
  }, [toast]);
  useEffect(() => {
    reloadEvents();
  }, [reloadEvents]);

  // Заметки, разосланные учителем семьям — нужны только в его кабинете
  const [teacherNotes, setTeacherNotes] = useState(null);
  const reloadTeacherNotes = useCallback(async () => {
    if (!teacher) return;
    const data = await fetchTeacherNotes();
    if (data) setTeacherNotes(data);
  }, [teacher]);
  useEffect(() => {
    reloadTeacherNotes();
  }, [reloadTeacherNotes]);

  // Переписка учителя с семьями. Грузим всем: учителю нужен список веток,
  // родителю — своя ветка на главной. Кто что видит, решает интерфейс.
  const [familyMessages, setFamilyMessages] = useState(null);
  const reloadFamilyMessages = useCallback(async () => {
    const data = await fetchFamilyMessages();
    if (data) setFamilyMessages(data);
  }, []);
  useEffect(() => {
    reloadFamilyMessages();
  }, [reloadFamilyMessages]);

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
    reloadNotes();
    reloadHomework();
    reloadEvents();
    reloadTeacherNotes();
    reloadFamilyMessages();
  }, [reloadAnnouncements, reloadReads, reloadPolls, reloadExpenses, reloadSchedule, reloadOverrides, reloadBirthdays, reloadNotes, reloadHomework, reloadEvents, reloadTeacherNotes, reloadFamilyMessages]);

  // При возврате в приложение (переключение окна/вкладки браузера) и раз в минуту — свежие данные.
  // Пока открыта любая форма — обновление на паузе (иначе оно стирает набранное),
  // а сразу после закрытия формы данные подтягиваются один раз.
  useEffect(() => {
    if (!role) return;
    let pending = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (isFormOpen()) { pending = true; return; }
      reloadAll();
    };
    const offForms = onFormsChange((busy) => {
      if (!busy && pending) {
        pending = false;
        refresh();
      }
    });
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      offForms();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
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
    ch = listen(ch, "family_notes", reloadNotes);
    ch = listen(ch, "family_notes", reloadTeacherNotes);
    ch = listen(ch, "homework", reloadHomework);
    ch = listen(ch, "class_events", reloadEvents);
    ch = listen(ch, "family_messages", reloadFamilyMessages);
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [role, reloadAnnouncements, reloadReads, reloadPolls, reloadOverrides, reloadSchedule, reloadExpenses, reloadBirthdays, reloadNotes, reloadHomework, reloadEvents, reloadTeacherNotes, reloadFamilyMessages]);

  // Разбор адреса раздела: /?tab=... → вкладка (старые адреса денег ведут в «Деньги»)
  const applyRoute = useCallback((t) => {
    if (!t) return;
    if (t === "birthdays") t = "class"; // старые пуш-уведомления о днях рождения
    // У учителя нет доступа к деньгам: любая денежная ссылка ведёт в его кабинет
    const noMoney = roleRef.current === "teacher";
    if (["fees", "expenses", "history", "shopping", "money"].includes(t)) {
      if (noMoney) { setTab("teacher"); return; }
      setTab("money");
      if (t === "money") setMoneySub((s) => s || "fees");
      else setMoneySub(t === "shopping" ? "expenses" : t);
    } else if (["dashboard", "schedule", "announcements", "votes", "class", "teacher"].includes(t)) {
      if (t === "teacher" && !noMoney) { setTab("dashboard"); return; }
      // У учителя нет «Главной» — старые ссылки и пуши молча ведут в кабинет
      if (t === "dashboard" && noMoney) { setTab("teacher"); return; }
      setTab(t);
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
      // роль в ref — сразу, иначе разбор адреса ниже ещё не знает про учителя
      roleRef.current = saved;
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab) applyRoute(urlTab);
      else if (saved === "teacher") setTab("teacher"); // учитель возвращается в свой кабинет
    }
    // Кнопки «назад/вперёд» браузера переключают разделы
    const onPop = () => applyRoute(new URLSearchParams(window.location.search).get("tab") || "dashboard");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyRoute]);

  const login = (r, fam) => {
    setRole(r);
    roleRef.current = r; // чтобы applyRoute ниже уже знал про учителя
    if (r === "parent" && fam) setFamily(fam); // семья привязана входом по коду
    setGreetToken((t) => t + 1); // новое приветствие после ручного входа
    try {
      localStorage.setItem("rk1g-role", r);
    } catch {}
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab) {
      applyRoute(urlTab);
    } else {
      setTab(r === "teacher" ? "teacher" : "dashboard"); // учитель сразу попадает в свой кабинет
    }
    setNotifOpen(false);
    // Автоматически включаем пуш-уведомления при входе (клик по кнопке = разрешение браузера)
    enablePush(r);
    if (r === "committee") {
      toast("Вы вошли как член комитета: доступны подтверждение чеков, создание сборов, расходов и голосований");
    }
    if (r === "teacher") {
      toast("Вы вошли как классный руководитель: можно записать домашнее задание, событие класса и заметку семье");
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
    // На мобильных прокручивается внутренний слой .app-scroll, на десктопе — окно
    document.querySelector(".app-scroll")?.scrollTo({ top: 0 });
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
    } else if (t === "teacher") {
      reloadHomework();
      reloadEvents();
      reloadTeacherNotes();
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
          <div className="app-scroll">
          <Header
            committee={committee}
            role={role}
            teacherName={authorName}
            userFullName={fullName}
            tab={tab}
            moneySub={moneySub}
            onTab={showTab}
            newsBadge={newsBadge}
            pollsBadge={pollsBadge}
            notesBadge={notesBadge}
            notifOpen={notifOpen}
            notifSeen={notifSeen}
            onToggleNotif={toggleNotif}
            onLogout={() => {
              setLogoutOpen(true);
              mascotRef.current?.sad(); // маскот на главной грустнеет (если она открыта)
            }}
          />
          <main>
            {tab === "dashboard" && <DashboardTab committee={committee} role={role} toast={toast} onTab={showTab} onOpenUpload={openUpload} liveGroups={liveGroups} liveSchedule={liveSchedule} liveBirthdays={liveBirthdays} overrides={liveOverrides} mascotRef={mascotRef} greetToken={greetToken} authorName={authorName} announcements={shownAnnouncements} polls={shownPolls} reads={liveReads} family={family} setFamily={setFamily} notes={liveNotes} onReloadNotes={reloadNotes} homework={liveHomework} events={liveEvents} />}
            {tab === "teacher" && (
              <TeacherTab
                authorName={authorName}
                greetingName={greetingName}
                toast={toast}
                onTab={showTab}
                homework={liveHomework}
                events={liveEvents}
                announcements={shownAnnouncements}
                familyMessages={familyMessages}
                onReload={() => { reloadHomework(); reloadEvents(); reloadTeacherNotes(); }}
                onReloadMessages={reloadFamilyMessages}
              />
            )}
            {tab === "schedule" && <ScheduleTab committee={committee} canEditSchedule={canEditSchedule} author={author} toast={toast} liveSchedule={liveSchedule} onReload={reloadSchedule} overrides={liveOverrides} onReloadOverrides={reloadOverrides} />}
            {tab === "announcements" && <AnnouncementsTab committee={committee} canEdit={committee || teacher} teacher={teacher} author={author} toast={toast} announcements={shownAnnouncements} reads={liveReads} onReload={reloadAnnouncements} onReloadReads={reloadReads} family={family} setFamily={setFamily} />}
            {tab === "votes" && <VotesTab committee={committee} canEdit={committee || teacher} teacher={teacher} author={author} toast={toast} polls={shownPolls} onReload={reloadPolls} family={family} setFamily={setFamily} />}
            {tab === "class" && <ClassTab committee={committee} toast={toast} liveBirthdays={liveBirthdays} />}
            {tab === "money" && <MoneyTab sub={moneySub} onSub={showMoneySub} committee={committee} toast={toast} onOpenUpload={openUpload} liveGroups={liveGroups} onReload={reloadExpenses} author={author} family={family} />}
          </main>
          </div>
          <BottomNav tab={tab} role={role} moneySub={moneySub} onTab={showTab} newsBadge={newsBadge} pollsBadge={pollsBadge} notesBadge={notesBadge} />
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
