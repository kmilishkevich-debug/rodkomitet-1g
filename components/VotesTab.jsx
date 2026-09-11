"use client";
import { useState } from "react";
import { Ic } from "./Art";

function VoteOpt({ width, label, pct, voted, onVote }) {
  return (
    <div className={"vote-opt" + (voted ? " voted" : "")} onClick={onVote}>
      <div className="bar" style={{ width }}></div>
      <span>{label}</span>
      <span className="pct">{pct}</span>
    </div>
  );
}

export default function VotesTab({ committee, toast, vote1, vote2, onCast }) {
  const [comments, setComments] = useState([
    { avatarStyle: { background: "var(--blue)", color: "#fff" }, initials: "ИП", name: "Ирина П.", text: "Сладкие наборы в том году зашли отлично, предлагаю повторить 🙂" },
    { avatarStyle: { background: "var(--orange)" }, initials: "ДК", name: "Дмитрий К.", text: "За игрушку — конфет детям и так хватает)" },
  ]);
  const [draft, setDraft] = useState("");

  const cast = (which, idx) => () => {
    onCast(which, idx);
    toast("Ваш голос учтён ✓ (в полной версии проценты пересчитаются)");
  };

  const addComment = () => {
    if (!draft.trim()) return;
    setComments([
      ...comments,
      {
        avatarStyle: {},
        initials: committee ? "КМ" : "ОС",
        name: committee ? "Кристина М." : "Ольга С.",
        text: draft,
      },
    ]);
    setDraft("");
  };

  return (
    <section id="tab-votes">
      <div className="section-cover reveal d1" style={{ background: "var(--blue)", color: "#fff" }}>
        <svg className="cover-deco"><use href="#i-spark" /></svg>
        <h2><Ic id="i-vote" className="ic big" />Голосования</h2>
        {committee && (
          <button className="btn small gold" onClick={() => toast("В полной версии — создание голосования: вопрос, варианты, дедлайн, открытое/анонимное")}>
            <Ic id="i-plus" />Создать
          </button>
        )}
      </div>

      <div className="card fee-card reveal d2">
        <div className="fee-head">
          <div>
            <h3><Ic id="i-gift" />Подарки детям на Новый год</h3>
            <div className="fee-meta">до 10.09 · проголосовали 18 из 27</div>
          </div>
          <span className="chip blue">открытое</span>
        </div>
        <VoteOpt width="61%" pct="61%" label="Готовые сладкие наборы (~15 BYN/ребёнок)" voted={vote1 === 0} onVote={cast(1, 0)} />
        <VoteOpt width="28%" pct="28%" label="Игрушка + мини-набор конфет (~18 BYN)" voted={vote1 === 1} onVote={cast(1, 1)} />
        <VoteOpt width="11%" pct="11%" label="Книга по возрасту (~14 BYN)" voted={vote1 === 2} onVote={cast(1, 2)} />
        <div className="muted" style={{ marginTop: 10 }}>Открытое голосование: видно, кто как проголосовал.</div>
        <h2 style={{ fontSize: 15 }}>Обсуждение</h2>
        {comments.map((c, i) => (
          <div className="comment" key={i}>
            <div className="avatar" style={c.avatarStyle}>{c.initials}</div>
            <div className="body"><b>{c.name}:</b> {c.text}</div>
          </div>
        ))}
        <div className="comment-input">
          <input
            id="commentBox"
            placeholder="Написать комментарий…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
          />
          <button className="btn small teal" onClick={addComment}><Ic id="i-send" /></button>
        </div>
      </div>

      <div className="card fee-card reveal d3">
        <div className="fee-head">
          <div>
            <h3>Покупаем шторы в кабинет за ~180 BYN?</h3>
            <div className="fee-meta">до 15.09 · проголосовали 9 из 27</div>
          </div>
          <span className="chip violet">анонимное</span>
        </div>
        <VoteOpt width="67%" pct="67%" label="Да, покупаем" voted={vote2 === 0} onVote={cast(2, 0)} />
        <VoteOpt width="33%" pct="33%" label="Нет, обойдёмся" voted={vote2 === 1} onVote={cast(2, 1)} />
        <div className="muted" style={{ marginTop: 10 }}>Анонимное: видны только итоги, кто как голосовал — не видно никому.</div>
      </div>

      <div className="card flat fee-card reveal d4" style={{ opacity: 0.72 }}>
        <div className="fee-head">
          <div>
            <h3>Куда едем на осеннюю экскурсию?</h3>
            <div className="fee-meta">завершено 25.08 · 25 из 27</div>
          </div>
          <span className="chip green">итог: Музей истории (72%)</span>
        </div>
      </div>
    </section>
  );
}
