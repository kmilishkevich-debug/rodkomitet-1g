"use client";
import { useState } from "react";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";
import { FAMILIES_COUNT, fmt } from "./data";
import { isLive, savePoll, deletePoll, castVote } from "@/lib/supabase";
import FamilyPicker, { RichText, fmtNewsDate, familyName } from "./FamilyPicker";

const TYPE_NAMES = {
  yesno: "Да / Нет",
  single: "Один вариант",
  multi: "Несколько вариантов",
  money: "Сбор средств",
};

// Дедлайн прошёл? (включительно: голосуем до конца дня дедлайна)
function deadlinePassed(p) {
  if (!p.deadline) return false;
  return new Date(p.deadline + "T23:59:59") < new Date();
}

// Статус с учётом автозакрытия по сроку
export function pollState(p) {
  if (p.status === "archived") return "archived";
  if (p.status === "closed" || deadlinePassed(p)) return "closed";
  return "open";
}

function fmtDeadline(d) {
  if (!d) return null;
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

// ===== Редактор голосования =====
function PollEditor({ open, initial, author, onClose, onSaved, toast }) {
  const hasVotes = (initial?.votes || []).length > 0;
  const [question, setQuestion] = useState(initial?.question || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState(initial?.type || "yesno");
  const [optionsText, setOptionsText] = useState((initial?.options || []).map((o) => o.title).join("\n"));
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline || "");
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const needOptions = type === "single" || type === "multi";

  const save = async () => {
    if (!question.trim()) { toast("Напишите вопрос голосования"); return; }
    const opts = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (needOptions && !hasVotes && opts.length < 2) { toast("Нужно минимум два варианта ответа (каждый с новой строки)"); return; }
    if (type === "money" && (!amount || Number(amount) <= 0)) { toast("Укажите сумму сбора с семьи"); return; }
    if (!isLive) { toast("База не подключена — голосования пока нельзя сохранять"); return; }
    setSaving(true);
    try {
      const payload = {
        question: question.trim(),
        description: description.trim(),
        type,
        amount: type === "money" ? Number(amount) : null,
        deadline: deadline || null,
      };
      if (initial?.id) payload.id = initial.id;
      else { payload.author = author; payload.status = "open"; }
      // Варианты не трогаем, если уже есть голоса (защита честности итогов)
      await savePoll(payload, needOptions && !hasVotes ? opts : undefined);
      toast(initial?.id ? "Голосование обновлено" : "Голосование создано");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast("Не удалось сохранить: " + (e.message || "ошибка"));
    }
    setSaving(false);
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal news-editor exp-modal" role="dialog" aria-modal="true">
        <h3>{initial?.id ? "Изменить голосование" : "Новое голосование"}</h3>
        <label className="fld-lbl">Вопрос</label>
        <input className="fld" type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Например: Дарим учителю цветы на 8 Марта?" maxLength={160} />
        <label className="fld-lbl">Пояснение (не обязательно)</label>
        <textarea className="fld" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Подробности, ссылки — по желанию" />
        <label className="fld-lbl">Тип голосования</label>
        <select className="fld" value={type} onChange={(e) => setType(e.target.value)} disabled={hasVotes}>
          <option value="yesno">Да / Нет</option>
          <option value="single">Выбор одного варианта</option>
          <option value="multi">Выбор нескольких вариантов</option>
          <option value="money">Сбор средств (готовы ли сдать сумму)</option>
        </select>
        {needOptions && (
          <>
            <label className="fld-lbl">Варианты ответа — каждый с новой строки</label>
            <textarea className="fld" rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"Вариант 1\nВариант 2\nВариант 3"} disabled={hasVotes} />
            {hasVotes && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Варианты нельзя менять: уже есть голоса.</p>}
          </>
        )}
        {type === "money" && (
          <>
            <label className="fld-lbl">Сумма с семьи, BYN</label>
            <input className="fld" type="number" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Например: 150" />
          </>
        )}
        <label className="fld-lbl">Срок голосования (закроется автоматически в конце этого дня)</label>
        <input className="fld" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <div className="actions">
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button className="btn small gold" onClick={save} disabled={saving}>{saving ? "Сохраняю…" : initial?.id ? "Сохранить" : "Создать"}</button>
        </div>
      </div>
    </div>
  );
}

// Полоска результата: подпись, число, доля
function ResultBar({ label, count, total, highlight }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className={"vote-res" + (highlight ? " win" : "")}>
      <div className="vote-res-top">
        <span className="vote-res-lbl">{label}</span>
        <span className="vote-res-val">{count} · {pct}%</span>
      </div>
      <div className="dprogress"><i style={{ width: pct + "%" }}></i></div>
    </div>
  );
}

// ===== Карточка голосования =====
function PollCard({ p, committee, canEdit, family, author, toast, onEdit, onReload, onNeedFamily }) {
  const state = pollState(p);
  const votes = p.votes || [];
  const myVote = family ? votes.find((v) => v.family_n === family.n) : null;
  const showResults = committee || canEdit || !!myVote || state !== "open";
  const [sel, setSel] = useState([]); // выбранные option_id (single/multi)
  const [moneySum, setMoneySum] = useState(p.amount ?? "");
  const [whoOpen, setWhoOpen] = useState(false);

  const submitVote = async (fam, extra) => {
    try {
      await castVote({ poll_id: p.id, family_n: fam.n, child: fam.child, ...extra });
      onReload();
      toast("Голос принят! Спасибо, семья " + fam.child.split(" ")[0] + " 🙌");
    } catch (e) {
      console.error(e);
      toast(e.message === "Эта семья уже голосовала" ? "Эта семья уже голосовала" : "Не получилось проголосовать: " + (e.message || "ошибка"));
    }
  };

  const vote = (extra) => {
    if (family) submitVote(family, extra);
    else onNeedFamily((fam) => submitVote(fam, extra));
  };

  const closePoll = async () => {
    try {
      await savePoll({ id: p.id, status: "closed", closed_at: new Date().toISOString(), closed_by: author });
      onReload();
      toast("Голосование закрыто");
    } catch (e) { toast("Не получилось: " + (e.message || "ошибка")); }
  };

  const archivePoll = async (toStatus) => {
    try {
      await savePoll({ id: p.id, status: toStatus });
      onReload();
      toast(toStatus === "archived" ? "Голосование в архиве" : "Голосование возвращено");
    } catch (e) { toast("Не получилось: " + (e.message || "ошибка")); }
  };

  const removePoll = async () => {
    if (!window.confirm("Удалить голосование вместе с голосами? Отменить будет нельзя.")) return;
    try {
      await deletePoll(p.id);
      onReload();
      toast("Голосование удалено");
    } catch (e) { toast("Не получилось удалить: " + (e.message || "ошибка")); }
  };

  // Итоги по типам
  const yesCnt = votes.filter((v) => v.choice === "yes" || v.choice === "agree").length;
  const noCnt = votes.filter((v) => v.choice === "no").length;
  const optCount = (optId) => votes.filter((v) => Array.isArray(v.option_ids) && v.option_ids.includes(optId)).length;
  const moneyTotal = votes.reduce((s, v) => s + (v.choice === "agree" ? Number(v.amount || 0) : 0), 0);
  const maxOpt = Math.max(0, ...(p.options || []).map((o) => optCount(o.id)));
  const notVoted = [];
  for (let n = 1; n <= FAMILIES_COUNT; n++) if (!votes.some((v) => v.family_n === n)) notVoted.push(n);

  // Подпись голоса семьи для комитета
  const voteLabel = (v) => {
    if (p.type === "yesno") return v.choice === "yes" ? "Да" : "Нет";
    if (p.type === "money") return v.choice === "agree" ? `Сдаст ${fmt(Number(v.amount || 0))} BYN` : "Не сдаст";
    const names = (p.options || []).filter((o) => Array.isArray(v.option_ids) && v.option_ids.includes(o.id)).map((o) => o.title);
    return names.join(", ") || "—";
  };

  return (
    <article className={"card vote-card reveal d2" + (state === "open" ? "" : " closed")}>
      <div className="news-head">
        <div className="news-titles">
          <h3 className="news-title">{p.question}</h3>
          <div className="news-meta">
            <span className={"vote-state " + state}>
              {state === "open" ? "Идёт голосование" : state === "closed" ? "Завершено" : "Архив"}
            </span>
            {" · "}{TYPE_NAMES[p.type]}
            {p.deadline && state === "open" && <> · до {fmtDeadline(p.deadline)} включительно</>}
            {" · "}{fmtNewsDate(p.created_at)} · {p.author || "Комитет"}
          </div>
        </div>
        {canEdit && (
          <div className="news-tools">
            <button className="icon-btn" title="Изменить" onClick={() => onEdit(p)}><Ic id="i-edit" /></button>
            {state === "open" && <button className="icon-btn" title="Закрыть досрочно" onClick={closePoll}><Ic id="i-check" /></button>}
            {p.status !== "archived"
              ? <button className="icon-btn" title="В архив" onClick={() => archivePoll("archived")}><Ic id="i-eye" /></button>
              : <button className="icon-btn" title="Вернуть из архива" onClick={() => archivePoll("closed")}><Ic id="i-arrow-right" /></button>}
            <button className="icon-btn" title="Удалить" onClick={removePoll}><Ic id="i-x" /></button>
          </div>
        )}
      </div>

      {p.description && <div className="news-body"><RichText text={p.description} /></div>}
      {p.type === "money" && p.amount != null && (
        <div className="vote-money-line">Предлагаемая сумма: <b>{fmt(p.amount)} BYN с семьи</b>{votes.length > 0 && <> · обещано уже <b>{fmt(moneyTotal)} BYN</b></>}</div>
      )}

      {/* Кнопки голосования — пока открыто и семья ещё не голосовала */}
      {state === "open" && !myVote && (
        <div className="vote-actions">
          {p.type === "yesno" && (
            <>
              <button className="btn small teal" onClick={() => vote({ choice: "yes", option_ids: null, amount: null })}>Да</button>
              <button className="btn small white" onClick={() => vote({ choice: "no", option_ids: null, amount: null })}>Нет</button>
            </>
          )}
          {(p.type === "single" || p.type === "multi") && (
            <div className="vote-opts">
              {(p.options || []).map((o) => (
                <label className="chk-row" key={o.id}>
                  <input
                    type={p.type === "single" ? "radio" : "checkbox"}
                    name={"poll-" + p.id}
                    checked={sel.includes(o.id)}
                    onChange={() => setSel(p.type === "single" ? [o.id] : sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])}
                  />
                  {o.title}
                </label>
              ))}
              <button
                className="btn small teal"
                onClick={() => (sel.length ? vote({ choice: null, option_ids: sel, amount: null }) : toast("Сначала выберите вариант"))}
              >
                Проголосовать
              </button>
            </div>
          )}
          {p.type === "money" && (
            <div className="vote-money">
              <span className="vote-money-lbl">Готовы сдать:</span>
              <input className="fld vote-money-inp" type="number" min="0" step="0.5" value={moneySum} onChange={(e) => setMoneySum(e.target.value)} />
              <span>BYN</span>
              <button className="btn small teal" onClick={() => (Number(moneySum) > 0 ? vote({ choice: "agree", option_ids: null, amount: Number(moneySum) }) : toast("Укажите сумму больше нуля"))}>Сдам</button>
              <button className="btn small white" onClick={() => vote({ choice: "no", option_ids: null, amount: null })}>Не сдам</button>
            </div>
          )}
        </div>
      )}

      {myVote && state === "open" && (
        <div className="vote-mine"><Ic id="i-check" /> Ваш голос учтён: <b>{voteLabel(myVote)}</b></div>
      )}

      {/* Итоги: комитету и учителю всегда, родителям — после своего голоса или закрытия */}
      {showResults ? (
        <div className="vote-results">
          {p.type === "yesno" && (
            <>
              <ResultBar label="Да" count={yesCnt} total={votes.length} highlight={yesCnt >= noCnt && votes.length > 0} />
              <ResultBar label="Нет" count={noCnt} total={votes.length} highlight={noCnt > yesCnt} />
            </>
          )}
          {(p.type === "single" || p.type === "multi") &&
            (p.options || []).map((o) => (
              <ResultBar key={o.id} label={o.title} count={optCount(o.id)} total={votes.length} highlight={votes.length > 0 && optCount(o.id) === maxOpt} />
            ))}
          {p.type === "money" && (
            <>
              <ResultBar label="Сдадут" count={yesCnt} total={votes.length} highlight={yesCnt >= noCnt && votes.length > 0} />
              <ResultBar label="Не сдадут" count={noCnt} total={votes.length} highlight={noCnt > yesCnt} />
            </>
          )}
          <div className="vote-turnout">Проголосовали {votes.length} из {FAMILIES_COUNT} семей</div>
        </div>
      ) : (
        state === "open" && (
          <div className="vote-turnout">
            Проголосовали {votes.length} из {FAMILIES_COUNT} семей · итоги откроются после вашего голоса
          </div>
        )
      )}

      {/* Комитету: кто как проголосовал и кто ещё нет */}
      {committee && (
        <>
          <button className="news-read-count" onClick={() => setWhoOpen(!whoOpen)} aria-expanded={whoOpen}>
            <Ic id="i-eye" /> Кто как проголосовал {whoOpen ? "▴" : "▾"}
          </button>
          {whoOpen && (
            <div className="vote-who">
              {votes.map((v) => (
                <div className="vote-who-row" key={v.id}>
                  <span className="vote-who-name">{v.child || familyName(v.family_n)}</span>
                  <span className="vote-who-val">{voteLabel(v)}</span>
                </div>
              ))}
              {votes.length === 0 && <span className="muted">Пока никто не голосовал</span>}
              {notVoted.length > 0 && (
                <div className="vote-who-missing">
                  <b>Не голосовали ({notVoted.length}):</b> {notVoted.map((n) => familyName(n).split(" ")[0]).join(", ")}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

// ===== Вкладка «Голосования» =====
export default function VotesTab({ committee, canEdit, author, toast, polls, onReload, family, setFamily }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [famOpen, setFamOpen] = useState(false);
  const [famAction, setFamAction] = useState(null);

  const all = polls || [];
  const open = all.filter((p) => pollState(p) === "open");
  const closed = all.filter((p) => pollState(p) === "closed");
  const archived = all.filter((p) => pollState(p) === "archived");

  const openEditor = (p) => {
    setEditing(p || null);
    setEditorOpen(true);
  };

  const needFamily = (action) => {
    setFamAction(() => action);
    setFamOpen(true);
  };

  const cardProps = { committee, canEdit, family, author, toast, onEdit: openEditor, onReload, onNeedFamily: needFamily };

  return (
    <section id="tab-votes">
      <div className="section-cover reveal" style={{ background: "var(--blue)" }}>
        <div className="cover-copy">
          <h1><NavIcon name="votes" uid="cv-votes" size={34} className="cover-navico" /> Голосования</h1>
          <p>Решаем вместе: одна семья — один голос. Итоги видны после вашего голоса.</p>
        </div>
        {canEdit && (
          <button className="btn small gold" onClick={() => openEditor(null)}>
            <Ic id="i-plus" /> Создать
          </button>
        )}
      </div>

      {!isLive && (
        <div className="card reveal d1" style={{ padding: 18 }}>
          <b>База пока не подключена.</b>
          <p className="muted" style={{ marginTop: 6 }}>Голосования появятся после настройки базы (файл news-votes-setup.sql в Supabase).</p>
        </div>
      )}

      {isLive && polls === null && (
        <div className="card reveal d1" style={{ padding: 18 }}>
          <b>Таблицы голосований ещё не созданы.</b>
          <p className="muted" style={{ marginTop: 6 }}>Запустите файл news-votes-setup.sql в Supabase (SQL Editor → Run) — и раздел заработает.</p>
        </div>
      )}

      {polls !== null && open.length === 0 && closed.length === 0 && (
        <div className="card news-empty reveal d1">
          <p><b>Пока нет активных голосований.</b></p>
          <p className="muted">Когда комитет создаст голосование — вы получите возможность отдать голос своей семьи прямо здесь.</p>
        </div>
      )}

      {open.map((p) => <PollCard key={p.id} p={p} {...cardProps} />)}

      {closed.length > 0 && (
        <>
          <h2 className="sec-title" style={{ margin: "18px 0 8px" }}>Завершённые</h2>
          {closed.map((p) => <PollCard key={p.id} p={p} {...cardProps} />)}
        </>
      )}

      {archived.length > 0 && canEdit && (
        <>
          <button className="pill-btn news-arch-toggle" onClick={() => setShowArchive(!showArchive)} aria-expanded={showArchive}>
            Архив ({archived.length}) {showArchive ? "▴" : "▾"}
          </button>
          {showArchive && archived.map((p) => <PollCard key={p.id} p={p} {...cardProps} />)}
        </>
      )}

      {editorOpen && (
        <PollEditor
          open={editorOpen} initial={editing} author={author} toast={toast}
          onClose={() => setEditorOpen(false)} onSaved={onReload}
        />
      )}

      <FamilyPicker
        open={famOpen}
        onClose={() => setFamOpen(false)}
        title="Голос от семьи: выберите своего ребёнка"
        onPick={(f) => {
          setFamily(f);
          if (famAction) famAction(f);
          setFamAction(null);
        }}
      />
    </section>
  );
}
