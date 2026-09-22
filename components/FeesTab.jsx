"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import {
  FEES, FEE_COLUMNS, GPD_CHILDREN, fmt, feeRest,
  GPD_FUND, GPD_FUND_FEE, GPD_FUND_CHARGE, gpdFundRest,
  GPD_FUND_COLLECTED, GPD_FUND_SPENT, GPD_FUND_REST,
} from "./data";
import {
  supabase, isLive, fetchFees, fetchChildNotes, saveFeeValue,
  fetchOneOffIncomes, addOneOffIncome, fetchFeeEditsLog, addFeeEdit,
} from "@/lib/supabase";
import TreasurerMascot, { MASCOT_GOAL, notifyTreasurer } from "./TreasurerMascot";

// Полная сумма взносов с семьи на 2026–2027 (50 + 150)
const FEE_TARGET = 200;

// Остаток по строке живых данных: взнос минус все списания
function liveRest(row, columns) {
  let rest = 0;
  columns.forEach((c) => {
    const v = row.values[c.id] || 0;
    rest += c.kind === "paid" ? v : -v;
  });
  return Math.round(rest * 100) / 100;
}

// Сколько всего сдала семья (сумма по колонкам-взносам)
function livePaid(row, columns) {
  let paid = 0;
  columns.forEach((c) => {
    if (c.kind === "paid") paid += row.values[c.id] || 0;
  });
  return Math.round(paid * 100) / 100;
}

const METHOD_LABEL = { cash: "наличные", transfer: "перевод" };
const round2 = (n) => Math.round(n * 100) / 100;
const dateRu = (d) => {
  try { return new Date(d).toLocaleDateString("ru-RU"); } catch { return String(d || ""); }
};

// Русские окончания: 1 запись, 2 записи, 5 записей
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

// Переключатель «наличные / перевод»
function MethodPick({ value, onChange }) {
  return (
    <div className="row" style={{ gap: 8, marginBottom: 10 }}>
      {["transfer", "cash"].map((m) => (
        <button
          key={m}
          type="button"
          className={"btn small " + (value === m ? "teal" : "white")}
          onClick={() => onChange(m)}
        >
          {m === "transfer" ? "Перевод" : "Наличные"}
        </button>
      ))}
    </div>
  );
}

// Окошко правки суммы в общей таблице взносов
function CellModal({ cell, onClose, onSave, saving }) {
  const [amount, setAmount] = useState(cell.amount ? String(cell.amount) : "");
  const [method, setMethod] = useState(cell.method || "transfer");
  const [note, setNote] = useState(cell.note || "");
  return (
    <div className="overlay">
      <div className="modal">
        <h3>{cell.column.title}</h3>
        <div className="muted">{cell.row.child} · взносы 2026–2027 (всего {FEE_TARGET} руб с семьи)</div>
        <label className="fee-lb">Сумма, BYN</label>
        <input
          className="fee-inp" type="number" step="0.01" inputMode="decimal"
          value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
        />
        {cell.column.kind === "paid" && (
          <>
            <label className="fee-lb">Как сдали</label>
            <MethodPick value={method} onChange={setMethod} />
          </>
        )}
        <label className="fee-lb">Заметка (необязательно)</label>
        <input className="fee-inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="например: сдали частями" />
        <div className="actions">
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => onSave(parseFloat(String(amount).replace(",", ".")) || 0, cell.column.kind === "paid" ? method : null, note.trim())}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// Окошко разового поступления (например, другой ученик сдал 25 руб на ГПД)
function OneOffModal({ childNames, onClose, onSave, saving }) {
  const [from, setFrom] = useState("");
  const [purpose, setPurpose] = useState("ГПД");
  const [custom, setCustom] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const purposes = ["ГПД", "Подарки", "Хознужды", "Другое"];
  return (
    <div className="overlay">
      <div className="modal exp-modal">
        <h3>Разовое поступление</h3>
        <div className="muted">Например: другой ученик сдал 25 руб на ГПД</div>
        <label className="fee-lb">От кого</label>
        <input
          className="fee-inp" list="oneoff-children" value={from}
          onChange={(e) => setFrom(e.target.value)} placeholder="выберите из класса или впишите" autoFocus
        />
        <datalist id="oneoff-children">
          {childNames.map((c) => <option key={c} value={c} />)}
        </datalist>
        <label className="fee-lb">На что</label>
        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {purposes.map((p) => (
            <button key={p} type="button" className={"btn small " + (purpose === p ? "teal" : "white")} onClick={() => setPurpose(p)}>{p}</button>
          ))}
        </div>
        {purpose === "Другое" && (
          <input className="fee-inp" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="на что именно" />
        )}
        <label className="fee-lb">Сумма, BYN</label>
        <input className="fee-inp" type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="fee-lb">Как сдали</label>
        <MethodPick value={method} onChange={setMethod} />
        <label className="fee-lb">Дата</label>
        <input className="fee-inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="fee-lb">Комментарий (необязательно)</label>
        <input className="fee-inp" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="actions">
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => {
              const a = parseFloat(String(amount).replace(",", "."));
              const p = purpose === "Другое" ? custom.trim() : purpose;
              onSave(from.trim(), p, a || 0, method, date, comment.trim());
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// Крупная сумма плитки кассы: число крупно, BYN меньше, табличные цифры
function Sum({ value, className = "" }) {
  return (
    <div className={"fin-sum " + className + (value < 0 ? " neg" : "")}>
      {fmt(value)} <span className="fin-cur">BYN</span>
    </div>
  );
}

export default function FeesTab({ committee, toast, onOpenUpload, author, onGoExpenses, family }) {
  const [listOpen, setListOpen] = useState(true); // ведомость по детям раскрыта по умолчанию
  const [gpdOpen, setGpdOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false); // «Как устроена общая касса»
  const [live, setLive] = useState(null); // { columns, rows } из базы
  const [editCol, setEditCol] = useState(null); // id колонки в режиме переименования
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState(null); // пометки ГПД/заметки из базы
  const [oneOffs, setOneOffs] = useState(null); // разовые поступления
  const [log, setLog] = useState(null); // журнал правок
  const [logOpen, setLogOpen] = useState(false);

  const [cellEdit, setCellEdit] = useState(null); // { row, column, amount, method, note }
  const [oneOffOpen, setOneOffOpen] = useState(false);

  const editor = author || "Комитет";

  const reload = async () => setLive(await fetchFees());
  const reloadOneOffs = async () => setOneOffs(await fetchOneOffIncomes());
  const reloadLog = async () => setLog(await fetchFeeEditsLog());
  useEffect(() => {
    reload();
    fetchChildNotes().then(setNotes);
    reloadOneOffs();
    reloadLog();
  }, []);

  // Ходит ли ребёнок в ГПД: живые пометки из базы или встроенный список
  const isGpd = (child) => (notes ? !!(notes[child] && notes[child].gpd) : GPD_CHILDREN.includes(child));

  // Единый вид данных: живые из базы или встроенные из data.js
  const columns = live
    ? live.columns
    : FEE_COLUMNS.map((c) => ({ id: c.key, title: c.title, kind: c.kind }));
  const rows = live
    ? live.rows.map((r) => {
        const paid = livePaid(r, live.columns);
        return { ...r, paid, rest: liveRest(r, live.columns), due: Math.max(0, round2(FEE_TARGET - paid)), over: Math.max(0, round2(paid - FEE_TARGET)) };
      })
    : FEES.map((f) => {
        const values = {};
        FEE_COLUMNS.forEach((c) => { values[c.key] = f[c.key] || 0; });
        const paid = round2(FEE_COLUMNS.filter((c) => c.kind === "paid").reduce((s, c) => s + (f[c.key] || 0), 0));
        return {
          id: f.n, n: f.n, child: f.child, values, meta: {}, paid,
          rest: feeRest(f), due: Math.max(0, round2(FEE_TARGET - paid)), over: Math.max(0, round2(paid - FEE_TARGET)),
        };
      });

  const totals = {};
  columns.forEach((c) => {
    totals[c.id] = round2(rows.reduce((s, r) => s + (r.values[c.id] || 0), 0));
  });
  const totalPaid = columns.filter((c) => c.kind === "paid").reduce((s, c) => s + totals[c.id], 0);
  const totalRest = round2(rows.reduce((s, r) => s + r.rest, 0));
  const totalDue = round2(rows.reduce((s, r) => s + r.due, 0));
  const doneCount = rows.filter((r) => r.due <= 0.005).length;

  // Своя семья — первой строкой и с подсветкой
  const myN = family ? family.n : null;
  const displayRows = myN
    ? [...rows.filter((r) => r.n === myN), ...rows.filter((r) => r.n !== myN)]
    : rows;

  // ===== Правка ячейки общей таблицы взносов =====
  const openCell = (row, column) => {
    if (!committee) return;
    if (!live) return toast("Правка сумм заработает после запуска файла fees2-setup.sql в Supabase");
    const meta = (row.meta && row.meta[column.id]) || {};
    setCellEdit({ row, column, amount: row.values[column.id] || 0, method: meta.method, note: meta.note });
  };

  const saveCell = async (amount, method, note) => {
    const { row, column } = cellEdit;
    const old = row.values[column.id] || 0;
    setSaving(true);
    try {
      await saveFeeValue(row.id, column.id, amount, method, note);
      if (round2(old) !== round2(amount)) {
        await addFeeEdit({
          target: "Взносы 2026–2027", child: row.child, field: column.title,
          old_amount: old, new_amount: amount, editor,
        });
        // Пушистый казначей реагирует на новый взнос (только на увеличение суммы)
        if (column.kind === "paid" && amount > old) {
          notifyTreasurer({
            type: "contribution",
            id: row.id + ":" + column.id + ":" + Date.now(),
            child: row.child,
            amount: round2(amount - old),
          });
        }
      }
      setCellEdit(null);
      toast("Сумма сохранена, изменение записано в журнал");
      reload(); reloadLog();
    } catch (e) {
      toast("Не получилось сохранить: " + e.message);
    }
    setSaving(false);
  };

  // ===== Разовое поступление =====
  const saveOneOff = async (from, purpose, amount, method, date, comment) => {
    if (!from) return toast("Укажите, от кого поступление");
    if (!purpose) return toast("Укажите, на что поступление");
    if (!amount) return toast("Укажите сумму");
    setSaving(true);
    try {
      await addOneOffIncome({ from_name: from, purpose, amount, method, comment: comment || null, date });
      await addFeeEdit({
        target: "Разовые поступления", child: from, field: purpose + " (" + METHOD_LABEL[method] + ")",
        old_amount: null, new_amount: amount, editor,
      });
      // Пушистый казначей радуется поступлению один раз (id защищает от повтора)
      notifyTreasurer({ type: "contribution", id: "oneoff:" + Date.now(), child: from, amount: round2(amount) });
      setOneOffOpen(false);
      toast("Разовое поступление добавлено — оно уже учтено в кассе");
      reloadOneOffs(); reloadLog();
    } catch (e) {
      toast("Не получилось сохранить: " + e.message);
    }
    setSaving(false);
  };

  const startEdit = (c) => {
    if (!live) return toast("Заголовки можно менять после настройки базы сборов (файл fees в Supabase)");
    setEditCol(c.id);
    setEditVal(c.title);
  };

  const saveEdit = async () => {
    const title = editVal.trim();
    if (!title) return toast("Название не может быть пустым");
    setSaving(true);
    const { error } = await supabase.from("fee_columns").update({ title }).eq("id", editCol);
    setSaving(false);
    if (error) return toast("Не получилось сохранить: " + error.message);
    setEditCol(null);
    toast("Название статьи обновлено");
    reload();
  };

  const addColumn = async () => {
    if (!isLive || !live) return toast("Добавление статей заработает после настройки базы сборов");
    const title = window.prompt("Название новой статьи сбора (списание из взноса):");
    if (!title || !title.trim()) return;
    const maxSort = Math.max(0, ...live.columns.map((c) => c.sort || 0));
    const { error } = await supabase.from("fee_columns").insert({ title: title.trim(), kind: "charge", sort: maxSort + 1 });
    if (error) return toast("Не получилось добавить: " + error.message);
    toast("Статья добавлена");
    reload();
  };

  const oneOffTotal = round2((oneOffs || []).reduce((s, o) => s + o.amount, 0));

  // ===== Общая касса класса: собрано / потрачено / осталось (без сумм фонда ГПД) =====
  const totalCharges = round2(columns.filter((c) => c.kind === "charge").reduce((s, c) => s + (totals[c.id] || 0), 0));
  const cashCollected = round2(totalPaid + oneOffTotal); // взносы семей + разовые поступления
  const cashSpent = totalCharges; // все списания из взносов
  const cashLeft = round2(cashCollected - cashSpent);

  return (
    <section id="tab-fees" className="fin">
      {/* ===== Общая касса класса (страница начинается сразу с неё) ===== */}
      <div className="card fin-cash reveal d1">
        <div className="fin-cash-info">
          <h3 className="fin-h3">Общая касса класса <span className="chip blue">1 «Г»</span></h3>
          <div className="muted">Общий бюджет нашего класса</div>
          <div className="fin-actions">
            <button className="btn teal" onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen}>
              <Ic id="i-users" />{listOpen ? "Скрыть список" : "Взносы по детям"}
            </button>
            <button className="btn outline" onClick={() => onGoExpenses && onGoExpenses(false)}>
              <Ic id="i-receipt" />Расходы класса
            </button>
          </div>
          <button className="fin-how-toggle" onClick={() => setHowOpen(!howOpen)} aria-expanded={howOpen}>
            <span className={"fin-chevron" + (howOpen ? " open" : "")} aria-hidden="true"><Ic id="i-arrow-right" /></span>
            Как устроена общая касса
          </button>
          {howOpen && (
            <div className="fin-how muted">
              Каждая семья сдаёт {fmt(FEE_TARGET)} BYN за учебный год. Из взносов списываются общие траты:
              хознужды, подарки, гардероб, магнитные значки, доля класса на ГПД и рабочие тетради.
              Разовые поступления плюсуются в кассу. Фонд ГПД — отдельный сбор со своим списком детей,
              его суммы в кассе класса не учитываются. Каждая правка сумм попадает в историю изменений внизу страницы.
            </div>
          )}
        </div>
        {/* Пушистый казначей с банкой «Общее дело 1Г» — как и раньше, живёт в кассе */}
        <div className="fin-mascot">
          <TreasurerMascot collected={totalPaid} goal={MASCOT_GOAL} />
        </div>
        {/* Плитки сумм — на всю ширину карточки, чтобы цифры влезали целиком */}
        <div className="fin-tiles">
          <div className="fin-tile blue">
            <div className="fin-tile-head"><Ic id="i-users" />Собрано</div>
            <Sum value={cashCollected} />
          </div>
          <div className="fin-tile pink">
            <div className="fin-tile-head"><Ic id="i-receipt" />Потрачено</div>
            <Sum value={cashSpent} />
          </div>
          <div className="fin-tile green">
            <div className="fin-tile-head"><Ic id="i-check" />Осталось</div>
            <Sum value={cashLeft} />
          </div>
        </div>
      </div>

      {/* ===== Ведомость взносов по детям (раскрыта по умолчанию) ===== */}
      {listOpen && (
        <div className="card fee-card reveal d2">
          <div className="fee-head">
            <div>
              <h3>Взносы 2026–2027 <span className="chip violet">идёт</span></h3>
              <div className="fee-meta">
                Всего {fmt(FEE_TARGET)} BYN с семьи · из взносов списываются: хознужды, подарки, гардероб, магнитные значки, ГПД, рабочие тетради · бейджи (3,85) — у четверых
              </div>
            </div>
            <span className={"chip " + (doneCount === rows.length ? "green" : "amber")}>сдали полностью · {doneCount}/{rows.length}</span>
          </div>
          <div className="progress"><i style={{ width: Math.round((doneCount / Math.max(1, rows.length)) * 100) + "%" }}></i></div>
          <div className="muted" style={{ marginBottom: 12 }}>
            Сдали полностью {doneCount} из {rows.length} · собрано {fmt(totalPaid)} BYN · осталось собрать {fmt(totalDue)} BYN · остаток на детях {fmt(totalRest)} BYN
          </div>
          <div className="row" style={{ marginBottom: 4 }}>
            <button className="btn small teal" onClick={() => onOpenUpload("Взносы 2026–2027", "до " + fmt(FEE_TARGET) + " BYN с семьи")}>Загрузить чек об оплате</button>
            {committee && (
              <button className="btn small white" onClick={addColumn}><Ic id="i-plus" />Новая статья</button>
            )}
          </div>
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table>
              <tbody>
                <tr>
                  <th>№</th>
                  <th>Ребёнок</th>
                  {columns.map((c) => (
                    <th key={c.id}>
                      {editCol === c.id ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <input
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditCol(null); }}
                            autoFocus
                            style={{ width: 110, fontSize: 12, padding: "2px 6px" }}
                          />
                          <button className="mini-btn" title="Сохранить" onClick={saveEdit} disabled={saving}>✓</button>
                          <button className="mini-btn danger" title="Отмена" onClick={() => setEditCol(null)}>✕</button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: "nowrap" }}>
                          {c.title}
                          {committee && (
                            <button className="mini-btn" title="Переименовать статью" onClick={() => startEdit(c)} style={{ marginLeft: 4 }}>
                              <Ic id="i-edit" />
                            </button>
                          )}
                        </span>
                      )}
                    </th>
                  ))}
                  <th>Остаток</th>
                  <th>Осталось сдать</th>
                </tr>
                {displayRows.map((r) => (
                  <tr key={r.id} className={myN && r.n === myN ? "fee-my-row" : undefined}>
                    <td>{r.n}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.child}
                      {isGpd(r.child) && (
                        <span className="chip green" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5 }}>ГПД</span>
                      )}
                      {myN && r.n === myN && (
                        <span className="chip blue" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5 }}>ваш ребёнок</span>
                      )}
                    </td>
                    {columns.map((c) => {
                      const v = r.values[c.id] || 0;
                      const meta = (r.meta && r.meta[c.id]) || {};
                      const inner = !v ? "—" : c.kind === "paid" ? <b>{fmt(v)}</b> : "−" + fmt(v);
                      return (
                        <td key={c.id}>
                          {committee ? (
                            <button
                              className="cell-btn"
                              title={"Изменить: " + c.title + (meta.method ? " · " + METHOD_LABEL[meta.method] : "") + (meta.note ? " · " + meta.note : "")}
                              onClick={() => openCell(r, c)}
                            >
                              {inner}
                              {c.kind === "paid" && v > 0 && meta.method === "cash" && <span className="pay-tag">нал.</span>}
                            </button>
                          ) : (
                            <>
                              {inner}
                              {c.kind === "paid" && v > 0 && meta.method === "cash" && <span className="pay-tag">нал.</span>}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <b style={r.rest < 0 ? { color: "#c2410c" } : undefined}>{fmt(r.rest)}</b>
                      {r.rest < 0 && <span className="chip amber" style={{ marginLeft: 6 }}>доплата</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.due > 0.005
                        ? <b style={{ color: "#c2410c" }}>{fmt(r.due)}</b>
                        : <span className="chip green" style={{ padding: "2px 8px", fontSize: 10.5 }}>сдано полностью</span>}
                      {r.over > 0.005 && <span className="chip violet" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5 }}>излишек +{fmt(r.over)}</span>}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ textAlign: "right" }}><b>Итого:</b></td>
                  {columns.map((c) => (
                    <td key={c.id}><b>{totals[c.id] ? `${c.kind === "paid" ? "" : "−"}${fmt(totals[c.id])}` : "—"}</b></td>
                  ))}
                  <td><b>{fmt(totalRest)}</b></td>
                  <td><b>{totalDue > 0.005 ? fmt(totalDue) : "—"}</b></td>
                </tr>
              </tbody>
            </table>
            <div className="muted" style={{ marginTop: 8 }}>
              «Осталось сдать» — сколько не хватает до полных {fmt(FEE_TARGET)} BYN · «Остаток» — сданное минус списания · отрицательный остаток — нужна доплата
              {committee ? " · нажмите на сумму, чтобы исправить её (изменение попадёт в журнал)" : ""}
            </div>
          </div>
        </div>
      )}

      {/* ===== Фонд ГПД: отдельный компактный сбор ===== */}
      <div className="card fin-gpd reveal d3">
        <div className="fee-head">
          <div>
            <h3>Фонд ГПД <span className="chip violet">Дополнительный сбор</span></h3>
            <div className="fee-meta">
              {GPD_FUND.length} детей · {fmt(GPD_FUND_FEE)} BYN с ребёнка · свой список: без троих ребят класса, зато с тремя из других классов
            </div>
          </div>
        </div>
        <div className="fin-gpd-stats">
          <div className="fin-gpd-stat blue">
            <span className="fin-gpd-lb"><Ic id="i-users" />Собрано</span>
            <span className="fin-gpd-sum">{fmt(GPD_FUND_COLLECTED)} <i>BYN</i></span>
          </div>
          <div className="fin-gpd-stat pink">
            <span className="fin-gpd-lb"><Ic id="i-receipt" />Потрачено</span>
            <span className="fin-gpd-sum">{fmt(GPD_FUND_SPENT)} <i>BYN</i></span>
          </div>
          <div className="fin-gpd-stat green">
            <span className="fin-gpd-lb"><Ic id="i-check" />Остаток</span>
            <span className="fin-gpd-sum">{fmt(GPD_FUND_REST)} <i>BYN</i></span>
          </div>
        </div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Остаток {fmt(GPD_FUND_REST)} BYN — как в таблице казначея: в кассе фонда 650,00 − 338,32 = 311,68,
          минус 13,01 — доля расходов Дашкевич Варвары, взнос которой ещё не сдан.
        </div>
        <div className="fin-actions">
          <button className="btn outline" onClick={() => setGpdOpen(!gpdOpen)} aria-expanded={gpdOpen}>
            <Ic id="i-users" />{gpdOpen ? "Скрыть взносы ГПД" : "Взносы ГПД"}
          </button>
          <button className="btn outline" onClick={() => onGoExpenses && onGoExpenses(true)}>
            <Ic id="i-receipt" />Расходы ГПД
          </button>
        </div>
        {gpdOpen && (
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table>
              <tbody>
                <tr>
                  <th>№</th>
                  <th>Ребёнок</th>
                  <th>Взнос</th>
                  <th>Хознужды ГПД</th>
                  <th>Остаток</th>
                </tr>
                {GPD_FUND.map((r) => {
                  const rest = gpdFundRest(r);
                  return (
                    <tr key={r.n}>
                      <td>{r.n}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.child}</td>
                      <td>{r.paid ? <b>{fmt(r.paid)}</b> : "—"}</td>
                      <td>−{fmt(GPD_FUND_CHARGE)}</td>
                      <td>
                        <b style={rest < 0 ? { color: "#c2410c" } : undefined}>{fmt(rest)}</b>
                        {rest < 0 && <span className="chip amber" style={{ marginLeft: 6 }}>доплата</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={2} style={{ textAlign: "right" }}><b>Итого:</b></td>
                  <td><b>{fmt(GPD_FUND_COLLECTED)}</b></td>
                  <td><b>−{fmt(GPD_FUND_SPENT)}</b></td>
                  <td><b>{fmt(GPD_FUND_REST)}</b></td>
                </tr>
              </tbody>
            </table>
            <div className="muted" style={{ marginTop: 8 }}>
              «Хознужды ГПД» — доля каждого ребёнка в общих тратах фонда · отрицательный остаток — взнос ещё не сдан
            </div>
          </div>
        )}
      </div>

      {/* ===== Разовые поступления ===== */}
      <div className="card fin-oneoff reveal d3">
        <div className="fin-oneoff-head">
          <div className="fin-oneoff-title">
            <span className="fin-ic-circle" aria-hidden="true"><Ic id="i-coin" /></span>
            <div>
              <h3 style={{ margin: 0 }}>Разовые поступления {oneOffs && oneOffs.length > 0 && <span className="chip green">+{fmt(oneOffTotal)} BYN</span>}</h3>
              <div className="fee-meta">Пополнения общей кассы вне сборов</div>
            </div>
          </div>
          {committee && (
            <button className="btn outline" onClick={() => {
              if (!isLive || oneOffs === null) return toast("Заработает после запуска файла fees2-setup.sql в Supabase");
              setOneOffOpen(true);
            }}>
              <Ic id="i-plus" />Добавить поступление
            </button>
          )}
        </div>
        {oneOffs === null ? (
          <div className="fin-load">
            <div className="fin-skel" aria-hidden="true"><i /><i /><i /></div>
            <button className="btn small white" onClick={reloadOneOffs}>Повторить загрузку</button>
          </div>
        ) : oneOffs.length > 0 ? (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table>
              <tbody>
                <tr><th>Дата</th><th>От кого</th><th>На что</th><th>Сумма</th><th>Как</th><th>Комментарий</th></tr>
                {oneOffs.map((o) => (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{dateRu(o.date)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{o.from_name}</td>
                    <td>{o.purpose}</td>
                    <td><b>{fmt(o.amount)}</b></td>
                    <td>{METHOD_LABEL[o.method] || "—"}</td>
                    <td className="muted">{o.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}><span className="chip gray">Поступлений пока нет</span></div>
        )}
      </div>

      {/* ===== История изменений: компактная раскрываемая строка ===== */}
      <div className="card fin-history reveal d3">
        <button className="fin-hist-row" onClick={() => setLogOpen(!logOpen)} aria-expanded={logOpen}>
          <span className="fin-ic-circle" aria-hidden="true"><Ic id="i-clock" /></span>
          <b>История изменений</b>
          {log === null ? (
            <span className="fin-skel chipload" aria-hidden="true"><i /></span>
          ) : (
            <span className="chip violet">{log.length} {plural(log.length, "запись", "записи", "записей")}</span>
          )}
          <span className={"fin-chevron end" + (logOpen ? " open" : "")} aria-hidden="true"><Ic id="i-arrow-right" /></span>
        </button>
        {logOpen && (
          <div className="fin-hist-body">
            {log === null ? (
              <div className="fin-load">
                <div className="fin-skel" aria-hidden="true"><i /><i /><i /></div>
                <button className="btn small white" onClick={reloadLog}>Повторить загрузку</button>
              </div>
            ) : log.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <tbody>
                    <tr><th>Когда</th><th>Где</th><th>Кого касается</th><th>Что</th><th>Было → стало</th><th>Кто</th></tr>
                    {log.map((e) => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{dateRu(e.at)}</td>
                        <td>{e.target}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{e.child || "—"}</td>
                        <td>{e.field || "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {e.old_amount != null ? fmt(Number(e.old_amount)) : "—"} → <b>{e.new_amount != null ? fmt(Number(e.new_amount)) : "—"}</b>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{e.editor || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="muted" style={{ marginTop: 8 }}>Каждая правка сумм записывается: что, было → стало, кто и когда</div>
              </div>
            ) : (
              <div className="muted">Пока изменений не было</div>
            )}
          </div>
        )}
      </div>

      {cellEdit && <CellModal cell={cellEdit} onClose={() => setCellEdit(null)} onSave={saveCell} saving={saving} />}
      {oneOffOpen && <OneOffModal childNames={rows.map((r) => r.child)} onClose={() => setOneOffOpen(false)} onSave={saveOneOff} saving={saving} />}
    </section>
  );
}
