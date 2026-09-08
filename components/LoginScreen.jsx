"use client";
import { useState } from "react";
import { supabase, isLive } from "@/lib/supabase";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);

  const pickDemo = (role) => {
    setPendingRole(role);
    setHint(null);
    if (isLive) return; // при подключённой базе кнопка родителя входит сразу
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
      setBusy(false);
      if (error) {
        setHint("Неверная почта или пароль. Попробуйте ещё раз.");
        return;
      }
      onLogin("committee");
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
      onLogin("parent"); // родители смотрят без пароля
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
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
            <button className="btn-login" onClick={tryLogin} disabled={busy}>
              {busy ? "Входим…" : "Войти →"}
            </button>
            {hint && <div className="login-hint-msg">{hint}</div>}
          </div>

          <div className="demo-label">{isLive ? "Я родитель — смотреть без пароля:" : "Или попробуйте демо-режим:"}</div>
          <div className="demo-row">
            <button
              className={"demo-btn parent" + (pendingRole === "parent" ? " selected" : "")}
              onClick={parentEnter}
            >
              <span className="demo-ic">✿</span>
              <span>{isLive ? "Войти как родитель" : "Ольга Смирнова"}<small>{isLive ? "просмотр: сборы, расходы, чеки" : "родитель"}</small></span>
            </button>
            {!isLive && (
              <button
                className={"demo-btn committee" + (pendingRole === "committee" ? " selected" : "")}
                onClick={() => pickDemo("committee")}
              >
                <span className="demo-ic">✦</span>
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
    </div>
  );
}
