"use client";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";

export default function VotesTab({ committee, toast }) {
  return (
    <section id="tab-votes">
      <div className="section-cover reveal d1" style={{ background: "var(--blue)", color: "#fff" }}>
        <svg className="cover-deco"><use href="#i-spark" /></svg>
        <h2><NavIcon name="votes" uid="h-votes" size={32} className="nvi-big" />Голосования</h2>
        {committee && (
          <button className="btn small gold" onClick={() => toast("Создание голосований появится в ближайшем обновлении: вопрос, варианты, срок — один голос от семьи")}>
            <Ic id="i-plus" />Создать
          </button>
        )}
      </div>
      <div className="card reveal d2" style={{ textAlign: "center", padding: "28px 20px" }}>
        <h3 style={{ marginTop: 0 }}>Пока нет активных голосований</h3>
        <p className="muted" style={{ margin: 0 }}>
          Когда комитет вынесет вопрос на голосование, он появится здесь. Правило простое: одна семья — один голос.
        </p>
      </div>
    </section>
  );
}
