"use client";
import { useState, useRef, useCallback } from "react";
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
import UploadModal from "@/components/UploadModal";

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

  const login = (r) => {
    setRole(r);
    setTab("dashboard");
    setNotifOpen(false);
    if (r === "committee") {
      toast("Вы вошли как член комитета: доступны подтверждение чеков, создание сборов, расходов и голосований");
    }
  };

  const logout = () => {
    setRole(null);
    setNotifOpen(false);
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
            {tab === "dashboard" && <DashboardTab committee={committee} onTab={showTab} onOpenUpload={openUpload} />}
            {tab === "fees" && <FeesTab committee={committee} toast={toast} onOpenUpload={openUpload} />}
            {tab === "expenses" && <ExpensesTab committee={committee} toast={toast} />}
            {tab === "shopping" && <ShoppingTab committee={committee} toast={toast} />}
            {tab === "votes" && <VotesTab committee={committee} toast={toast} />}
            {tab === "class" && <ClassTab committee={committee} toast={toast} />}
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
