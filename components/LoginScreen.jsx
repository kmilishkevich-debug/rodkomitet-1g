"use client";
import { useState, useEffect } from "react";
import { supabase, isLive, fetchUserRole, verifyFamilyCode } from "@/lib/supabase";
import { FAMILIES } from "./data";
import { Ic } from "./Art";

// Модалка входа родителя: сначала выбираем ребёнка, потом вводим семейный код
function ParentCodeModal({ open, onClose, onSuccess }) {
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFilter("");
      setPicked(null);
      setCode("");
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const list = FAMILIES.filter((f) =>
    f.child.toLowerCase().includes(filter.trim().toLowerCase())
  );

  const check = async () => {
    if (!code.trim()) {
      setErr("Введите код из сообщения в Viber");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyFamilyCode(picked.n, code);
      if (res.ok) {
        onSuccess({ n: picked.n, child: picked.child });
      } else {
        setErr("Код не подходит. Проверьте, что вводите код именно вашей семьи — он в личном сообщении от комитета.");
        setBusy(false);
      }
    } catch (e) {
      console.error(e);
      setErr("Не получилось проверить код. Проверьте интернет и попробуйте ещё раз.");
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fam-modal" role="dialog" aria-modal="true">
        {!picked ? (
          <>
            <h3>Вход для родителей</h3>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
              Шаг 1 из 2: выберите своего ребёнка из списка класса.
            </p>
            <input
              className="fam-search"
              type="text"
              placeholder="Начните вводить фамилию…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            <div className="fam-list">
              {list.map((f) => (
                <button key={f.n} className="fam-row" onClick={() => { setPicked(f); setErr(null); }}>
                  <span className="fam-n">{f.n}</span>
                  <span className="fam-name">{f.child}</span>
                  {f.note && <span className="tag-pill">{f.note}</span>}
                </button>
              ))}
              {!list.length && (
                <div className="muted" style={{ padding: 12 }}>Никого не нашли — проверьте написание</div>
              )}
            </div>
            <div className="actions">
              <button className="btn small" onClick={onClose}>Отмена</button>
            </div>
          </>
        ) : (
          <>
            <h3>{picked.child}</h3>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
              Шаг 2 из 2: введите семейный код — он в личном сообщении от родительского комитета в Viber.
            </p>
            <input
              className="fam-search"
              type="text"
              placeholder="Например: ABC-234"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && check()}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
            />
            {err && <div className="login-hint-msg" style={{ marginTop: 8 }}>{err}</div>}
            <div className="actions">
              <button className="btn small" onClick={() => { setPicked(null); setCode(""); setErr(null); }}>
                ← Другой ребёнок
              </button>
              <button className="btn small primary" onClick={check} disabled={busy}>
                {busy ? "Проверяем…" : "Войти"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);

  const pickDemo = (role) => {
    setPendingRole(role);
    setHint(null);
    if (isLive) return; // при подключённой базе родитель входит по семейному коду
    if (role === "parent") {
      setEmail("olga.smirnova@example.com");
      setPassword("demo-parent");
    } else {
      setEmail("kristina.m@example.com");
      setPassword("demo-committee");
    }
  };

  const tryLogin = async () => {
    if (isLive) {
      // Настоящий вход комитета: почта + пароль (аккаунты заведены в базе)
      if (!email.trim() || !password) {
        setHint("Комитет входит по своей почте и паролю. Родителям пароль не нужен — кнопка ниже.");
        return;
      }
      setBusy(true);
      setHint(null);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setBusy(false);
        setHint("Неверная почта или пароль. Попробуйте ещё раз.");
        return;
      }
      // Смотрим роль: учитель получает доступ только к расписанию
      const roleData = await fetchUserRole();
      setBusy(false);
      onLogin(roleData?.role === "teacher" ? "teacher" : "committee");
      return;
    }
    if (pendingRole) {
      onLogin(pendingRole);
    } else {
      setHint("Это демо: выберите роль ниже, и поля заполнятся сами");
    }
  };

  const parentEnter = () => {
    if (isLive) {
      setParentOpen(true); // вход родителя — по семейному коду
    } else {
      pickDemo("parent");
    }
  };

  return (
    <div id="loginScreen">
      <div className="login-topbar">
        <div className="brand">
          <span className="brand-badge">1«Г»</span>
          Наш 1 «Г»
        </div>
        <div className="school-pill">• Школа №227</div>
      </div>

      <div className="login-card">
        <div className="login-form-side">
          <div className="kicker">Родительский комитет · 27 семей</div>
          <div className="login-h1">
            <span className="blob" aria-hidden="true"></span>
            <h1>Наш<span>1 «Г»</span></h1>
          </div>
          <p className="login-sub">Всё важное для класса в одном месте: сборы, расходы, покупки и голосования.</p>

          <div className="login-form">
            <label>Электронная почта</label>
            <input
              type="email"
              placeholder="mama@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label>Пароль</label>
            <div className="field">
              <input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)} title="Показать пароль">
                {showPass ? <Ic id="i-eye-off" /> : <Ic id="i-eye" />}
              </button>
            </div>
            <button className="btn-login" onClick={tryLogin} disabled={busy}>
              {busy ? "Входим…" : <>Войти <Ic id="i-arrow-right" /></>}
            </button>
            {hint && <div className="login-hint-msg">{hint}</div>}
          </div>

          <div className="demo-label">{isLive ? "Я родитель — вход по семейному коду:" : "Или попробуйте демо-режим:"}</div>
          <div className="demo-row">
            <button
              className={"demo-btn parent" + (pendingRole === "parent" ? " selected" : "")}
              onClick={parentEnter}
            >
              <span className="demo-ic"><Ic id="i-flower" /></span>
              <span>{isLive ? "Войти как родитель" : "Ольга Смирнова"}<small>{isLive ? "код семьи из сообщения в Viber" : "родитель"}</small></span>
            </button>
            {!isLive && (
              <button
                className={"demo-btn committee" + (pendingRole === "committee" ? " selected" : "")}
                onClick={() => pickDemo("committee")}
              >
                <span className="demo-ic"><Ic id="i-spark" /></span>
                <span>Кристина М.<small>род. комитет</small></span>
              </button>
            )}
          </div>
        </div>

        <div className="login-visual">
          <span className="visual-blob green" aria-hidden="true"></span>
          <span className="visual-blob yellow" aria-hidden="true"></span>
          <img src="/mascot.jpg" alt="Школа №227 и ученики 1 «Г»" />
          <span className="v-badge tag1g">1 «Г»</span>
          <span className="v-badge fam">27 семей</span>
          <span className="v-badge byn">BYN</span>
          <div className="v-note">Взносы, расходы и покупки — всегда под рукой.</div>
        </div>
      </div>

      <ParentCodeModal
        open={parentOpen}
        onClose={() => setParentOpen(false)}
        onSuccess={(fam) => {
          setParentOpen(false);
          onLogin("parent", fam);
        }}
      />
    </div>
  );
}
