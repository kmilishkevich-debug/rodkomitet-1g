import { Ic, SchoolBg, MascotBig } from "./Art";

export default function LoginScreen({ onLogin }) {
  return (
    <div id="loginScreen">
      {/* фоновые цветочки и искры */}
      <svg className="bg-deco spark" style={{ left: "8%", top: "12%", width: 46 }}><use href="#i-flower" /></svg>
      <svg className="bg-deco spark d2" style={{ right: "10%", top: "18%", width: 34 }}><use href="#i-spark" /></svg>
      <svg className="bg-deco spark d3" style={{ left: "14%", bottom: "14%", width: 30 }}><use href="#i-spark" /></svg>
      <svg className="bg-deco spark d2" style={{ right: "12%", bottom: "10%", width: 52 }}><use href="#i-flower" /></svg>

      <div className="login-card">
        <div className="login-top">
          <SchoolBg />
          <span className="sticker s1">1 «Г»</span>
          <span className="sticker s2">27 семей</span>
          <span className="sticker s3">BYN</span>
          <MascotBig />
          <h1>Касса класса</h1>
          <div className="sub">Родительский комитет · 1 «Г» · 27 семей</div>
        </div>
        <div className="login-form">
          <label>Электронная почта</label>
          <input type="email" placeholder="mama@example.com" />
          <label>Пароль</label>
          <input type="password" placeholder="••••••••" />
          <button className="btn teal full" onClick={() => onLogin("parent")}>Войти</button>
          <div className="demo-hint">
            <b>Демо-режим — попробуйте обе роли:</b>
            <button onClick={() => onLogin("parent")}><Ic id="i-flower" /> Ольга Смирнова — родитель</button>
            <button onClick={() => onLogin("committee")}><Ic id="i-spark" /> Кристина М. — член род. комитета</button>
          </div>
        </div>
      </div>
    </div>
  );
}
