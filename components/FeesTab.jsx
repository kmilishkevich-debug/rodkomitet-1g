"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import {
  GPD_CHILDREN, fmt,
  GPD_FUND, GPD_FUND_FEE, GPD_FUND_SPENT, groupTotal,
  applyAutoFees, fallbackFeeData, familyNs,
} from "./data";
import {
  supabase, isLive, fetchFees, fetchChildNotes, saveFeeValue, saveFeeValuesBulk,
  fetchOneOffIncomes, addOneOffIncome, fetchFeeEditsLog, addFeeEdit,
  fetchGpdFund, saveGpdPaid, addGpdChild, deleteGpdChild,
  renameChildEverywhere, addFamilyEdit,
  fetchFeeCampaigns, createFeeCampaign, updateFeeCampaign, addCampaignPayment,
  fetchPaymentRequisites, savePaymentRequisites, addCampaignClaim, updateCampaignClaim,
  uploadReceipt, saveAnnouncement,
} from "@/lib/supabase";
import { sendManualPush, sendReceiptPush } from "@/lib/push";
import TreasurerMascot, { notifyTreasurer } from "./TreasurerMascot";
import { shareText, shareUrl } from "@/lib/share";
import { useRefreshPause, useDraftAutosave, readDraft, clearDraft, confirmDiscard, isDirty } from "@/lib/formGuard";

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
  const dkey = "fee:" + (cell.row.id || cell.row.child) + ":" + cell.column.id;
  const base = {
    amount: cell.amount ? String(cell.amount) : "",
    method: cell.method || "transfer",
    note: cell.note || "",
  };
  const [saved] = useState(() => (typeof window === "undefined" ? null : readDraft(dkey)));
  const start = saved ? { ...base, ...saved } : base;
  const [amount, setAmount] = useState(start.amount);
  const [method, setMethod] = useState(start.method);
  const [note, setNote] = useState(start.note);
  const [restored] = useState(!!saved);

  useRefreshPause(true);
  const values = { amount, method, note };
  const dirty = isDirty(values, base);
  useDraftAutosave(true, dkey, values, dirty);

  const close = () => {
    if (!confirmDiscard(dirty, "Закрыть без сохранения? Введённая сумма не запишется.")) return;
    clearDraft(dkey);
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && close()}>
      <div className="modal">
        <h3>{cell.column.title}</h3>
        <div className="muted">{cell.row.child} · взносы 2026–2027 (всего {cell.row.target || FEE_TARGET} руб с семьи)</div>
        {restored && <div className="chip amber" style={{ marginTop: 6 }}>Восстановлен незаконченный черновик</div>}
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
          <button className="btn small white" onClick={close}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => { clearDraft(dkey); onSave(parseFloat(String(amount).replace(",", ".")) || 0, cell.column.kind === "paid" ? method : null, note.trim()); }}
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
  const dkey = "oneoff:new";
  const base = {
    from: "", purpose: "ГПД", custom: "", amount: "", method: "cash",
    date: new Date().toISOString().slice(0, 10), comment: "",
  };
  const [saved] = useState(() => (typeof window === "undefined" ? null : readDraft(dkey)));
  const start = saved ? { ...base, ...saved } : base;
  const [from, setFrom] = useState(start.from);
  const [purpose, setPurpose] = useState(start.purpose);
  const [custom, setCustom] = useState(start.custom);
  const [amount, setAmount] = useState(start.amount);
  const [method, setMethod] = useState(start.method);
  const [date, setDate] = useState(start.date);
  const [comment, setComment] = useState(start.comment);
  const [restored] = useState(!!saved);
  const purposes = ["ГПД", "Подарки", "Хознужды", "Другое"];

  useRefreshPause(true);
  const values = { from, purpose, custom, amount, method, date, comment };
  const dirty = isDirty(values, base);
  useDraftAutosave(true, dkey, values, dirty);

  const close = () => {
    if (!confirmDiscard(dirty, "Закрыть поступление без сохранения? Всё, что вы набрали, пропадёт.")) return;
    clearDraft(dkey);
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && close()}>
      <div className="modal exp-modal">
        <h3>Разовое поступление</h3>
        <div className="muted">Например: другой ученик сдал 25 руб на ГПД</div>
        {restored && <div className="chip amber" style={{ marginTop: 6 }}>Восстановлен незаконченный черновик</div>}
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
          <button className="btn small white" onClick={close}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => {
              const a = parseFloat(String(amount).replace(",", "."));
              const p = purpose === "Другое" ? custom.trim() : purpose;
              clearDraft(dkey);
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

// Окошко правки взноса в фонде ГПД
function GpdPaidModal({ row, onClose, onSave, saving }) {
  const [amount, setAmount] = useState(row.paid ? String(row.paid) : "");
  useRefreshPause(true);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal">
        <h3>Взнос в фонд ГПД</h3>
        <div className="muted">{row.child} · взнос {fmt(GPD_FUND_FEE)} BYN с ребёнка</div>
        <label className="fee-lb">Сумма, BYN</label>
        <input
          className="fee-inp" type="number" step="0.01" inputMode="decimal"
          value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
        />
        <div className="actions">
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => onSave(parseFloat(String(amount).replace(",", ".")) || 0)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// Окошко массовых действий по статье: проставить сумму всем детям сразу
// или очистить колонку. Открывается нажатием на название статьи в шапке.
// Две суммы: для ходящих в ГПД и (необязательно) для не ходящих.
function BulkModal({ column, rows, isGpd, onClose, onApply, onClear, saving }) {
  const [gpdSum, setGpdSum] = useState("");
  const [otherSum, setOtherSum] = useState("");
  const [mode, setMode] = useState("empty"); // empty — только пустым, all — перезаписать все
  const [step, setStep] = useState("form"); // form → confirm

  useRefreshPause(true);

  const parse = (s) => parseFloat(String(s).replace(",", ".")) || 0;
  // Пустая клетка — где суммы нет вовсе. Явный ноль («не участвует») — заполненная!
  const isEmpty = (r) => r.values[column.id] === undefined || r.values[column.id] === null || r.values[column.id] === "";
  const filled = rows.filter((r) => !isEmpty(r)).length;
  const g = parse(gpdSum);
  const split = otherSum.trim() !== ""; // второе поле заполнено → две разные суммы
  const o = split ? parse(otherSum) : g;

  // Кому проставляем: всем или только тем, у кого в статье пусто (нули не трогаем)
  const targets = rows.filter((r) => mode === "all" || isEmpty(r));
  const gpdT = targets.filter((r) => isGpd(r.child));
  const othT = targets.filter((r) => !isGpd(r.child));
  const total = round2(gpdT.length * g + othT.length * o);

  const apply = () => {
    const entries = targets.map((r) => {
      const meta = (r.meta && r.meta[column.id]) || {};
      return { rowId: r.id, columnId: column.id, amount: isGpd(r.child) ? g : o, method: meta.method, note: meta.note };
    });
    const logField = column.title + " · массово" +
      (split ? " (ГПД " + fmt(g) + ", без ГПД " + fmt(o) + ")" : " (" + fmt(g) + " каждому)");
    onApply({ entries, logField, total });
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal">
        <h3>{column.title}</h3>
        <div className="muted">Массовая простановка: сумма появится сразу у всех детей в этой статье</div>

        {step === "form" ? (
          <>
            <label className="fee-lb">Сумма для детей с ГПД, BYN</label>
            <input
              className="fee-inp" type="number" step="0.01" inputMode="decimal"
              value={gpdSum} onChange={(e) => setGpdSum(e.target.value)} autoFocus
            />
            <label className="fee-lb">Сумма для детей без ГПД, BYN (необязательно)</label>
            <input
              className="fee-inp" type="number" step="0.01" inputMode="decimal"
              value={otherSum} onChange={(e) => setOtherSum(e.target.value)}
              placeholder="пусто — всем одна сумма"
            />
            {filled > 0 && (
              <>
                <label className="fee-lb">У {filled} {plural(filled, "ребёнка уже есть сумма", "детей уже есть суммы", "детей уже есть суммы")} в этой статье</label>
                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  <button type="button" className={"btn small " + (mode === "empty" ? "teal" : "white")} onClick={() => setMode("empty")}>
                    Только пустым
                  </button>
                  <button type="button" className={"btn small " + (mode === "all" ? "teal" : "white")} onClick={() => setMode("all")}>
                    Перезаписать все
                  </button>
                </div>
              </>
            )}
            <div className="actions">
              {filled > 0 && (
                <button className="btn small white" style={{ color: "#c2410c" }} onClick={onClear} disabled={saving}>
                  Очистить у всех
                </button>
              )}
              <button className="btn small white" onClick={onClose} disabled={saving}>Отмена</button>
              <button
                className="btn small teal"
                disabled={saving || !(g > 0 || (split && o > 0)) || !targets.length}
                onClick={() => setStep("confirm")}
              >
                Далее
              </button>
            </div>
            {!targets.length && (
              <div className="muted" style={{ marginTop: 8 }}>Пустых ячеек в статье нет — выберите «Перезаписать все», чтобы обновить суммы.</div>
            )}
          </>
        ) : (
          <>
            <div style={{ marginTop: 10 }}>
              {split ? (
                <>
                  <div>ГПД: <b>{fmt(g)}</b> × {gpdT.length} {plural(gpdT.length, "ребёнок", "ребёнка", "детей")}</div>
                  <div>Без ГПД: <b>{fmt(o)}</b> × {othT.length} {plural(othT.length, "ребёнок", "ребёнка", "детей")}</div>
                </>
              ) : (
                <div>По <b>{fmt(g)}</b> BYN × {targets.length} {plural(targets.length, "ребёнок", "ребёнка", "детей")}</div>
              )}
              <div style={{ marginTop: 6 }}>Всего: <b>{fmt(total)} BYN</b></div>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {mode === "all" && filled > 0
                ? "Уже заполненные суммы будут перезаписаны."
                : "Уже заполненные суммы не изменятся."}
              {" "}Изменение попадёт в журнал. Пуш родителям не отправляется.
            </div>
            <div className="actions">
              <button className="btn small white" onClick={() => setStep("form")} disabled={saving}>Назад</button>
              <button className="btn small teal" onClick={apply} disabled={saving}>
                {saving ? "Проставляем…" : "Применить"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Окошко создания и правки целевого сбора (экскурсия, подарок и т.п.)
// Сумма — с семьи; участники — галочки по списку детей (не все ходят на экскурсии)
function CollectionModal({ coll, rows, committee, onClose, onSave, saving }) {
  const dkey = "coll:" + (coll ? coll.id : "new");
  const allNs = rows.map((r) => r.n);
  const base = {
    title: coll ? coll.title : "",
    amount: coll && coll.amount ? String(coll.amount) : "",
    deadline: (coll && coll.deadline) || "",
    parts: coll && Array.isArray(coll.participants) && coll.participants.length
      ? coll.participants.filter((n) => allNs.includes(n))
      : allNs,
    teacherVisible: coll ? !!coll.teacher_visible : false,
    markPaid: false, doPush: true, doAnnounce: true,
  };
  const [saved] = useState(() => (typeof window === "undefined" ? null : readDraft(dkey)));
  const start = saved ? { ...base, ...saved } : base;
  const [title, setTitle] = useState(start.title);
  const [amount, setAmount] = useState(start.amount);
  const [deadline, setDeadline] = useState(start.deadline);
  const [parts, setParts] = useState(start.parts);
  const [teacherVisible, setTeacherVisible] = useState(start.teacherVisible);
  const [markPaid, setMarkPaid] = useState(start.markPaid);
  const [doPush, setDoPush] = useState(start.doPush);
  const [doAnnounce, setDoAnnounce] = useState(start.doAnnounce);
  const [restored] = useState(!!saved);

  useRefreshPause(true);
  const values = { title, amount, deadline, parts, teacherVisible, markPaid, doPush, doAnnounce };
  const dirty = isDirty(values, base);
  useDraftAutosave(true, dkey, values, dirty);

  const close = () => {
    if (!confirmDiscard(dirty, "Закрыть без сохранения? Всё, что вы набрали, пропадёт.")) return;
    clearDraft(dkey);
    onClose();
  };
  const togglePart = (n) => setParts((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  // Сколько семей участвует (близнецы — одна семья, сдают один раз)
  const famSet = new Set();
  rows.forEach((r) => { if (parts.includes(r.n)) famSet.add(Math.min(...familyNs(r.n))); });

  const lbRow = { display: "flex", gap: 8, alignItems: "center", marginBottom: 6, cursor: "pointer" };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && close()}>
      <div className="modal exp-modal">
        <h3>{coll ? "Правка сбора" : "Новый сбор"}</h3>
        <div className="muted">Целевой сбор на конкретное дело. Сумма — с семьи: близнецы сдают один раз.</div>
        {restored && <div className="chip amber" style={{ marginTop: 6 }}>Восстановлен незаконченный черновик</div>}
        <label className="fee-lb">Название</label>
        <input className="fee-inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="например: Экскурсия в музей" autoFocus />
        <label className="fee-lb">Сумма с семьи, BYN</label>
        <input className="fee-inp" type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="fee-lb">Сдать до (необязательно)</label>
        <input className="fee-inp" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <label className="fee-lb">Кто участвует: {parts.length} из {rows.length} детей ({famSet.size} {plural(famSet.size, "семья", "семьи", "семей")})</label>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <button type="button" className="btn small white" onClick={() => setParts(allNs)}>Все</button>
          <button type="button" className="btn small white" onClick={() => setParts([])}>Никто</button>
        </div>
        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 10px", marginBottom: 10 }}>
          {rows.map((r) => (
            <label key={r.n} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={parts.includes(r.n)} onChange={() => togglePart(r.n)} />
              <span>{r.n}. {r.child}</span>
            </label>
          ))}
        </div>
        {committee && (
          <label style={lbRow}>
            <input type="checkbox" checked={teacherVisible} onChange={(e) => setTeacherVisible(e.target.checked)} />
            <span>Показывать сбор учителю</span>
          </label>
        )}
        {!coll && (
          <>
            <label style={lbRow}>
              <input type="checkbox" checked={doPush} onChange={(e) => setDoPush(e.target.checked)} />
              <span>Отправить пуш-уведомление родителям</span>
            </label>
            <label style={lbRow}>
              <input type="checkbox" checked={doAnnounce} onChange={(e) => setDoAnnounce(e.target.checked)} />
              <span>Создать объявление в ленте</span>
            </label>
            <label style={lbRow}>
              <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
              <span>Сразу отметить сумму как сданную всем участникам</span>
            </label>
          </>
        )}
        <div className="actions">
          <button className="btn small white" onClick={close} disabled={saving}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => {
              clearDraft(dkey);
              onSave({
                title: title.trim(),
                amount: parseFloat(String(amount).replace(",", ".")) || 0,
                deadline: deadline || null,
                participants: parts.length === rows.length ? null : [...parts].sort((x, y) => x - y),
                teacherVisible, markPaid, doPush, doAnnounce,
              });
            }}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Окошко отметки платежа семьи по целевому сбору
function CollPayModal({ coll, fam, child, onClose, onSave, saving }) {
  const [amount, setAmount] = useState(fam.due > 0 ? String(fam.due) : "");
  const [method, setMethod] = useState("transfer");
  const [note, setNote] = useState("");
  useRefreshPause(true);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal">
        <h3>{coll.title}</h3>
        <div className="muted">{child} · {fmt(coll.amount)} BYN с семьи · уже сдано {fmt(fam.paid)} BYN</div>
        <label className="fee-lb">Сумма, BYN</label>
        <input
          className="fee-inp" type="number" step="0.01" inputMode="decimal"
          value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
        />
        <label className="fee-lb">Как сдали</label>
        <MethodPick value={method} onChange={setMethod} />
        <label className="fee-lb">Заметка (необязательно)</label>
        <input className="fee-inp" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="actions">
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => onSave(parseFloat(String(amount).replace(",", ".")) || 0, method, note.trim())}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// Окошко правки реквизитов для перевода (только комитет): карта, телефон, банк
function RequisitesModal({ reqs, onClose, onSave, saving }) {
  const [card, setCard] = useState((reqs && reqs.card_number) || "");
  const [phone, setPhone] = useState((reqs && reqs.phone) || "");
  const [bank, setBank] = useState((reqs && reqs.bank) || "");
  useRefreshPause(true);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal">
        <h3>Реквизиты для перевода</h3>
        <div className="muted">Одни общие на все сборы — родители увидят их в карточке сбора и в напоминании на главной.</div>
        <label className="fee-lb">Номер карты</label>
        <input className="fee-inp" value={card} onChange={(e) => setCard(e.target.value)} placeholder="0000 0000 0000 0000" autoFocus />
        <label className="fee-lb">Номер телефона</label>
        <input className="fee-inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+375 ..." />
        <label className="fee-lb">Банк</label>
        <input className="fee-inp" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="например: Беларусбанк" />
        <div className="actions">
          <button className="btn small white" onClick={onClose} disabled={saving}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => onSave({ card_number: card.trim() || null, phone: phone.trim() || null, bank: bank.trim() || null })}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Окошко родителя «Я перевёл(а)»: сумма, фото чека, примечание.
// Создаёт заявку «на проверке» — комитет подтвердит, и платёж попадёт в кассу.
function ClaimModal({ coll, fam, child, reqs, onClose, onSave, saving }) {
  const [amount, setAmount] = useState(fam.due > 0 ? String(fam.due) : "");
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  useRefreshPause(true);
  const hasReqs = reqs && (reqs.card_number || reqs.phone || reqs.bank);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal">
        <h3>Я перевёл(а) — {coll.title}</h3>
        <div className="muted">{child} · {fmt(coll.amount)} BYN с семьи · осталось {fmt(fam.due)} BYN</div>
        {hasReqs && (
          <div className="muted" style={{ marginTop: 6 }}>
            Перевод на карту{reqs.bank ? " (" + reqs.bank + ")" : ""}:
            {reqs.card_number ? " " + reqs.card_number : ""}{reqs.phone ? " · тел. " + reqs.phone : ""}
          </div>
        )}
        <label className="fee-lb">Сумма перевода, BYN</label>
        <input
          className="fee-inp" type="number" step="0.01" inputMode="decimal"
          value={amount} onChange={(e) => setAmount(e.target.value)}
        />
        <label className="fee-lb">Фото или скриншот чека</label>
        <input
          className="fee-inp" type="file" accept="image/*"
          onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
        />
        <label className="fee-lb">Примечание (необязательно)</label>
        <input className="fee-inp" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="muted" style={{ marginTop: 6 }}>
          Заявка уйдёт комитету «на проверку». После подтверждения платёж появится в списке «кто сдал».
        </div>
        <div className="actions">
          <button className="btn small white" onClick={onClose} disabled={saving}>Отмена</button>
          <button
            className="btn small teal" disabled={saving}
            onClick={() => onSave(parseFloat(String(amount).replace(",", ".")) || 0, file, note.trim())}
          >
            {saving ? "Отправляем…" : "Отправить на проверку"}
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

export default function FeesTab({ committee, teacher, toast, onOpenUpload, author, onGoExpenses, family, liveGroups, onReloadFamilies }) {
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
  const [bulkCol, setBulkCol] = useState(null); // статья для массовой простановки
  const [oneOffOpen, setOneOffOpen] = useState(false);

  const [gpdLive, setGpdLive] = useState(null); // живой список фонда ГПД из базы
  const [gpdEdit, setGpdEdit] = useState(null); // редактируемая строка фонда

  // Целевые сборы (экскурсии, подарки): создаёт комитет или учитель
  const [colls, setColls] = useState(null); // null = таблицы ещё нет / не загружено
  const [collModal, setCollModal] = useState(null); // { coll } или { coll: null } = новый
  const [collPay, setCollPay] = useState(null); // { coll, fam, child } — отметить платёж
  const [collOpen, setCollOpen] = useState({}); // раскрытые списки «кто сдал»
  const [reqs, setReqs] = useState(null); // реквизиты для перевода (карта/телефон/банк)
  const [reqsOpen, setReqsOpen] = useState(false); // модалка правки реквизитов
  const [claimModal, setClaimModal] = useState(null); // { coll, fam, child } — заявка «я перевёл(а)»

  const editor = author || "Комитет";
  const canManage = committee || teacher; // сборы создают и правят комитет И учитель

  const reload = async () => setLive(await fetchFees());
  const reloadOneOffs = async () => setOneOffs(await fetchOneOffIncomes());
  const reloadLog = async () => setLog(await fetchFeeEditsLog());
  const reloadGpd = async () => setGpdLive(await fetchGpdFund());
  const reloadColls = async () => setColls(await fetchFeeCampaigns());
  useEffect(() => {
    reload();
    fetchChildNotes().then(setNotes);
    reloadOneOffs();
    reloadLog();
    reloadGpd();
    reloadColls();
    fetchPaymentRequisites().then(setReqs);
  }, []);

  // Ходит ли ребёнок в ГПД: живые пометки из базы или встроенный список
  const isGpd = (child) => (notes ? !!(notes[child] && notes[child].gpd) : GPD_CHILDREN.includes(child));

  // Переименование ребёнка прямо из ведомости: обновляет карточку семьи,
  // ведомость, пометки и коды входа — и попадает в журнал правок списков
  const renameChild = async (r) => {
    if (!isLive || !live) {
      return toast("Переименование заработает после запуска файла families-setup.sql в Supabase");
    }
    const answer = window.prompt("Фамилия и имя ребёнка:", r.child);
    if (answer == null) return;
    const newName = answer.trim();
    if (!newName || newName === r.child) return;
    try {
      await renameChildEverywhere(r.child, newName);
      addFamilyEdit({ n: r.n, child: newName, field: "ребёнок", old_value: r.child, new_value: newName, editor });
      toast("Переименовано всюду: ведомость, список класса, коды входа");
      reload();
      fetchChildNotes().then(setNotes);
      onReloadFamilies && onReloadFamilies();
    } catch (e) {
      toast("Не получилось переименовать: " + (e.message || e));
    }
  };

  // Единый вид данных: живые из базы или встроенные из data.js.
  // Авто-списания (хознужды, подарки, тетради) пересчитываются из раздела «Расходы»,
  // статья «ГПД» — фикс 25 BYN в фонд ГПД; ручной ноль исключает ребёнка из статьи.
  const src = live || fallbackFeeData();
  const { columns, rows: autoRows, auto } = applyAutoFees(src.columns, src.rows, liveGroups);
  // Норма взноса: 200 BYN у ходящих в ГПД (175 + 25 в фонд), 175 — у не ходящих (0 в колонке «ГПД»)
  const gpdColId = (columns.find((c) => c.kind === "charge" && /гпд/i.test(c.title || "")) || {}).id;
  const rowTarget = (r) => (gpdColId && r.values[gpdColId] === 0 ? FEE_TARGET - GPD_FUND_FEE : FEE_TARGET);
  const rows = autoRows.map((r) => {
    const paid = livePaid(r, columns);
    const target = rowTarget(r);
    return {
      ...r, paid, target,
      rest: liveRest(r, columns),
      due: Math.max(0, round2(target - paid)),
      over: Math.max(0, round2(paid - target)),
    };
  });

  const totals = {};
  columns.forEach((c) => {
    totals[c.id] = round2(rows.reduce((s, r) => s + (r.values[c.id] || 0), 0));
  });
  const totalPaid = columns.filter((c) => c.kind === "paid").reduce((s, c) => s + totals[c.id], 0);
  // Цель банки казначея: сумма норм по всем семьям (200 у ходящих в ГПД, 175 — у не ходящих).
  // Пересчитывается сама при изменении списка детей или пометок ГПД — без захардкоженных чисел.
  const mascotGoal = round2(rows.reduce((s, r) => s + r.target, 0));
  const totalRest = round2(rows.reduce((s, r) => s + r.rest, 0));
  const totalDue = round2(rows.reduce((s, r) => s + r.due, 0));
  const doneCount = rows.filter((r) => r.due <= 0.005).length;

  // Своя семья — первой строкой и с подсветкой (у близнецов «свои» обе строки)
  const myNs = family ? familyNs(family.n) : [];
  const displayRows = myNs.length
    ? [...rows.filter((r) => myNs.includes(r.n)), ...rows.filter((r) => !myNs.includes(r.n))]
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

  // ===== Массовая простановка сумм по статье =====
  const openBulk = (c) => {
    if (!committee) return;
    if (!live) return toast("Массовая простановка заработает после запуска файла fees2-setup.sql в Supabase");
    if (auto[c.id]) return toast("Статья «" + c.title + "» считается автоматически из расходов — суммы проставлять не нужно");
    setBulkCol(c);
  };

  const applyBulk = async ({ entries, logField, total }) => {
    setSaving(true);
    try {
      await saveFeeValuesBulk(entries);
      await addFeeEdit({
        target: "Взносы 2026–2027", child: "Все дети (" + entries.length + ")", field: logField,
        old_amount: null, new_amount: total, editor,
      });
      setBulkCol(null);
      toast("Суммы проставлены: " + entries.length + " " + plural(entries.length, "ребёнок", "ребёнка", "детей") + ", изменение записано в журнал");
      reload(); reloadLog();
    } catch (e) {
      toast("Не получилось проставить: " + e.message);
    }
    setSaving(false);
  };

  const clearBulk = async () => {
    const c = bulkCol;
    const affected = rows.filter((r) => (r.values[c.id] || 0) !== 0);
    if (!affected.length) return toast("В этой статье и так нет сумм");
    if (!window.confirm("Очистить статью «" + c.title + "» у всех детей (" + affected.length + ")? Суммы обнулятся, изменение попадёт в журнал.")) return;
    setSaving(true);
    try {
      await saveFeeValuesBulk(affected.map((r) => ({ rowId: r.id, columnId: c.id, amount: 0 })));
      await addFeeEdit({
        target: "Взносы 2026–2027", child: "Все дети (" + affected.length + ")", field: c.title + " · массовая очистка",
        old_amount: totals[c.id] || 0, new_amount: 0, editor,
      });
      setBulkCol(null);
      toast("Статья очищена у всех, изменение записано в журнал");
      reload(); reloadLog();
    } catch (e) {
      toast("Не получилось очистить: " + e.message);
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

  // ===== Фонд ГПД: живой список детей + «Потрачено» из раздела «Расходы» =====
  // Дети: из базы (gpd_fund_children) или встроенный запасной список.
  const gpdRows = gpdLive || GPD_FUND.map((r) => ({ id: "demo-" + r.n, child: r.child, paid: r.paid }));
  // «Собрано» — расчётное: 25 BYN × все дети списка (взносы детей класса идут из классного сбора 200).
  // Кто фактически не сдал, виден по нулю в своей строке.
  const gpdCollected = round2(gpdRows.length * GPD_FUND_FEE);
  const gpdPaidTotal = round2(gpdRows.reduce((s, r) => s + (r.paid || 0), 0)); // фактически проставлено в строках
  // «Потрачено» — автоматически: сумма живых групп расходов, в названии которых есть «ГПД».
  const gpdSpent = liveGroups
    ? round2(liveGroups.filter((g) => /гпд/i.test(g.title || "")).reduce((s, g) => s + groupTotal(g), 0))
    : GPD_FUND_SPENT;
  // Доля расходов делится на всех детей в списке фонда.
  const gpdCharge = gpdRows.length ? gpdSpent / gpdRows.length : 0;
  const gpdRest = round2(gpdCollected - gpdSpent);

  const openGpdCell = (r) => {
    if (!committee) return;
    if (!gpdLive) return toast("Правка взносов ГПД заработает после запуска файла gpd-fund-setup.sql в Supabase");
    setGpdEdit(r);
  };

  const saveGpdCell = async (amount) => {
    const r = gpdEdit;
    const old = r.paid || 0;
    setSaving(true);
    try {
      await saveGpdPaid(r.id, amount);
      if (round2(old) !== round2(amount)) {
        await addFeeEdit({
          target: "Фонд ГПД", child: r.child, field: "Взнос",
          old_amount: old, new_amount: amount, editor,
        });
        if (amount > old) {
          notifyTreasurer({ type: "contribution", id: "gpd:" + r.id + ":" + Date.now(), child: r.child, amount: round2(amount - old) });
        }
      }
      setGpdEdit(null);
      toast("Взнос сохранён, изменение записано в журнал");
      reloadGpd(); reloadLog();
    } catch (e) {
      toast("Не получилось сохранить: " + e.message);
    }
    setSaving(false);
  };

  const addGpdKid = async () => {
    if (!gpdLive) return toast("Добавление детей заработает после запуска файла gpd-fund-setup.sql в Supabase");
    const name = window.prompt("Фамилия и имя ребёнка для фонда ГПД:");
    if (!name || !name.trim()) return;
    try {
      await addGpdChild(name.trim(), gpdRows.length + 1);
      await addFeeEdit({
        target: "Фонд ГПД", child: name.trim(), field: "Добавлен в список",
        old_amount: null, new_amount: 0, editor,
      });
      toast("Ребёнок добавлен в фонд ГПД");
      reloadGpd(); reloadLog();
    } catch (e) {
      toast("Не получилось добавить: " + e.message);
    }
  };

  const removeGpdKid = async (r) => {
    if (!gpdLive) return toast("Удаление детей заработает после запуска файла gpd-fund-setup.sql в Supabase");
    if (!window.confirm(`Убрать «${r.child}» из списка фонда ГПД?`)) return;
    try {
      await deleteGpdChild(r.id);
      await addFeeEdit({
        target: "Фонд ГПД", child: r.child, field: "Удалён из списка",
        old_amount: r.paid || 0, new_amount: null, editor,
      });
      toast("Ребёнок удалён из фонда ГПД");
      reloadGpd(); reloadLog();
    } catch (e) {
      toast("Не получилось удалить: " + e.message);
    }
  };

  // ===== Целевые сборы (экскурсии, подарки): сумма с семьи, близнецы сдают раз =====
  const famOf = (n) => Math.min(...familyNs(n));

  // Расчёт по одному сбору: семьи-участники, кто сколько сдал, у кого остаток
  const collCalc = (coll) => {
    const parts = Array.isArray(coll.participants) && coll.participants.length ? coll.participants : null;
    const isPart = (n) => !parts || parts.includes(n);
    const fams = new Map(); // ключ — № первой строки семьи
    rows.forEach((r) => {
      const k = famOf(r.n);
      if (!fams.has(k)) fams.set(k, { ns: [], children: [] });
      const f = fams.get(k);
      f.ns.push(r.n);
      f.children.push(r.child);
    });
    fams.forEach((f) => {
      f.part = f.ns.some(isPart); // семья участвует, если участвует любой её ребёнок
      f.paid = round2((coll.payments || []).filter((p) => f.children.includes(p.child)).reduce((s, p) => s + p.amount, 0));
      f.due = f.part ? Math.max(0, round2(coll.amount - f.paid)) : 0;
    });
    const famList = [...fams.values()];
    const partCount = famList.filter((f) => f.part).length;
    const doneCount = famList.filter((f) => f.part && f.due <= 0.005).length;
    const collected = round2(famList.reduce((s, f) => s + f.paid, 0));
    return { fams, isPart, partCount, doneCount, collected };
  };

  // Учитель видит только сборы, открытые комитетом галочкой, и созданные им самим.
  // Закрытые сборы учителю не показываем совсем. Комитет и родители видят все сборы.
  const visibleColls = Array.isArray(colls) && teacher && !committee
    ? colls.filter((c) => c.status !== "closed" && (c.teacher_visible || (c.created_by && c.created_by === author)))
    : colls;

  const openCollCreate = () => {
    if (colls === null) return toast("Целевые сборы заработают после запуска файла fee-collections-setup.sql в Supabase");
    setCollModal({ coll: null });
  };
  const openCollEdit = (coll) => setCollModal({ coll });
  const openCollPay = (coll, fam, child) => {
    if (!committee) return;
    setCollPay({ coll, fam, child });
  };

  // Сохранение сбора: создание (с объявлением/пушем/авто-отметкой) или правка
  const saveColl = async (vals) => {
    if (!vals.title) return toast("Напишите название сбора");
    if (!(vals.amount > 0)) return toast("Укажите сумму с семьи");
    setSaving(true);
    try {
      const old = collModal.coll;
      if (old) {
        const patch = {
          title: vals.title, amount: vals.amount,
          deadline: vals.deadline, participants: vals.participants,
        };
        // Видимость учителю меняет только комитет — иначе не трогаем поле
        if (committee) patch.teacher_visible = vals.teacherVisible;
        await updateFeeCampaign(old.id, patch);
        if (vals.title !== old.title) {
          await addFeeEdit({
            target: "Целевые сборы", child: vals.title,
            field: "Переименован (было: «" + old.title + "»)",
            old_amount: null, new_amount: null, editor,
          });
        }
        if (round2(vals.amount) !== round2(old.amount)) {
          await addFeeEdit({
            target: "Целевые сборы", child: vals.title, field: "Сумма с семьи",
            old_amount: old.amount, new_amount: vals.amount, editor,
          });
        }
        toast("Сбор обновлён");
      } else {
        const created = await createFeeCampaign({
          title: vals.title, amount: vals.amount,
          deadline: vals.deadline, participants: vals.participants,
          sort: (colls || []).length + 1,
          // Новый сбор скрыт от учителя, пока комитет не поставил галочку;
          // created_by — чтобы учитель видел сборы, которые создал сам
          teacher_visible: committee ? vals.teacherVisible : false,
          created_by: editor,
        });
        await addFeeEdit({
          target: "Целевые сборы", child: vals.title, field: "Создан сбор",
          old_amount: null, new_amount: vals.amount, editor,
        });
        let extra = "";
        if (vals.markPaid) {
          // Одна запись на семью: платит семья, а не каждый ребёнок
          const seen = new Set();
          const pays = rows
            .filter((r) => !vals.participants || vals.participants.includes(r.n))
            .filter((r) => {
              const k = famOf(r.n);
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .map((r) => ({
              campaign_id: created.id, child: r.child, amount: vals.amount,
              method: "transfer", note: "отмечено при создании сбора",
            }));
          if (pays.length) await addCampaignPayment(pays);
          extra += ", оплата проставлена всем";
        }
        const when = vals.deadline ? " до " + dateRu(vals.deadline) : "";
        if (vals.doAnnounce) {
          try {
            await saveAnnouncement({
              title: "Новый сбор: " + vals.title,
              body: "Сдаём по " + fmt(vals.amount) + " BYN с семьи" + when + ". Подробности — во вкладке «Деньги → Сборы».",
              important: false, pinned: false, image_url: null,
              teacher_visible: true, author: editor, status: "active",
            });
            extra += ", объявление создано";
          } catch {
            extra += ", объявление создать не вышло";
          }
        }
        if (vals.doPush) {
          const res = await sendManualPush({
            title: "Новый сбор: " + vals.title,
            body: "Сдаём по " + fmt(vals.amount) + " BYN с семьи" + when,
            url: "/?tab=fees", audience: "all",
          }).catch(() => null);
          extra += res && res.ok ? ", пуш отправлен" : ", пуш отправить не вышло";
        }
        toast("Сбор создан" + extra);
      }
      setCollModal(null);
      reloadColls(); reloadLog();
    } catch (e) {
      toast("Не получилось сохранить: " + (e.message || e));
    }
    setSaving(false);
  };

  // Отметка платежа по сбору (только комитет)
  const saveCollPay = async (amount, method, note) => {
    if (!(amount > 0)) return toast("Укажите сумму платежа");
    const { coll, child } = collPay;
    setSaving(true);
    try {
      await addCampaignPayment({ campaign_id: coll.id, child, amount, method, note: note || null });
      await addFeeEdit({
        target: "Целевые сборы", child, field: coll.title + " (" + METHOD_LABEL[method] + ")",
        old_amount: null, new_amount: amount, editor,
      });
      notifyTreasurer({ type: "contribution", id: "coll:" + coll.id + ":" + Date.now(), child, amount });
      toast("Платёж записан — он уже учтён в кассе");
      setCollPay(null);
      reloadColls(); reloadLog();
    } catch (e) {
      toast("Не получилось сохранить: " + (e.message || e));
    }
    setSaving(false);
  };

  // ===== Реквизиты для перевода: одни общие на все сборы, правит комитет =====
  const saveReqs = async (patch) => {
    setSaving(true);
    try {
      await savePaymentRequisites(patch);
      setReqs({ id: 1, ...patch });
      setReqsOpen(false);
      toast("Реквизиты сохранены — родители увидят их в сборах и напоминаниях");
    } catch (e) {
      toast("Не получилось сохранить (запущен ли fee-collections-upgrade.sql?): " + (e.message || e));
    }
    setSaving(false);
  };
  const copyReqs = async () => {
    const parts = [];
    if (reqs?.card_number) parts.push("Карта: " + reqs.card_number);
    if (reqs?.phone) parts.push("Телефон: " + reqs.phone);
    if (reqs?.bank) parts.push("Банк: " + reqs.bank);
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      toast("Реквизиты скопированы");
    } catch {
      toast("Не получилось скопировать — выделите текст вручную");
    }
  };

  // ===== Заявки родителей: «я перевёл(а) + чек» и «передам наличными» =====
  // Имя для заявки — первый ребёнок семьи (как в платежах: семья платит один раз)
  const myClaimChild = () => {
    const first = rows.find((r) => myNs.includes(r.n));
    return first ? first.child : family ? family.child : "";
  };
  // Заявки моей семьи по сбору (по детям семьи)
  const myClaims = (coll) => {
    const names = rows.filter((r) => myNs.includes(r.n)).map((r) => r.child);
    return (coll.claims || []).filter((cl) => names.includes(cl.child));
  };

  const submitClaim = async (amount, file, note) => {
    if (!(amount > 0)) return toast("Укажите сумму перевода");
    if (!file) return toast("Прикрепите фото или скриншот чека");
    const { coll } = claimModal;
    const child = myClaimChild();
    setSaving(true);
    try {
      const receiptUrl = await uploadReceipt(file);
      await addCampaignClaim({
        campaign_id: coll.id, child, amount,
        method: "transfer", receipt_url: receiptUrl, note: note || null,
      });
      // Пуш комитету о новом чеке (роут сам ограничивает получателей)
      sendReceiptPush({
        body: child + ": " + fmt(amount) + " BYN на «" + coll.title + "»",
        url: receiptUrl,
      }).catch(() => null);
      setClaimModal(null);
      toast("Заявка отправлена — комитет проверит чек и подтвердит платёж");
      reloadColls();
    } catch (e) {
      toast("Не получилось отправить (запущен ли fee-collections-upgrade.sql?): " + (e.message || e));
    }
    setSaving(false);
  };

  const submitCashClaim = async (coll, fam) => {
    const child = myClaimChild();
    if (!window.confirm("Передадите " + fmt(fam.due) + " BYN наличными? Комитет отметит платёж, когда получит деньги.")) return;
    setSaving(true);
    try {
      await addCampaignClaim({ campaign_id: coll.id, child, amount: fam.due, method: "cash" });
      sendReceiptPush({
        body: child + ": передаст " + fmt(fam.due) + " BYN наличными на «" + coll.title + "»",
        url: "/?tab=fees",
      }).catch(() => null);
      toast("Заявка отправлена — передайте деньги комитету, и платёж отметят");
      reloadColls();
    } catch (e) {
      toast("Не получилось отправить (запущен ли fee-collections-upgrade.sql?): " + (e.message || e));
    }
    setSaving(false);
  };

  // Комитет подтверждает заявку (платёж попадает в кассу) или отклоняет
  const decideClaim = async (coll, claim, ok) => {
    if (!committee) return;
    if (!ok && !window.confirm("Отклонить заявку? Родитель увидит это и сможет отправить новую.")) return;
    setSaving(true);
    try {
      if (ok) {
        await addCampaignPayment({
          campaign_id: coll.id, child: claim.child, amount: claim.amount,
          method: claim.method, note: "по заявке родителя" + (claim.note ? ": " + claim.note : ""),
        });
        await addFeeEdit({
          target: "Целевые сборы", child: claim.child,
          field: coll.title + " (" + METHOD_LABEL[claim.method] + ", по заявке)",
          old_amount: null, new_amount: claim.amount, editor,
        });
        notifyTreasurer({ type: "contribution", id: "claim:" + claim.id, child: claim.child, amount: claim.amount });
      }
      await updateCampaignClaim(claim.id, { status: ok ? "approved" : "rejected" });
      toast(ok ? "Заявка подтверждена — платёж записан в кассу" : "Заявка отклонена");
      reloadColls(); reloadLog();
    } catch (e) {
      toast("Не получилось: " + (e.message || e));
    }
    setSaving(false);
  };

  // Комитет закрывает сбор (родители больше не видят напоминаний и кнопок)
  // или открывает его снова. Платежи, правки и расходы комитету доступны всегда.
  const toggleCollClosed = async (coll) => {
    if (!committee) return;
    const closing = coll.status !== "closed";
    if (
      closing &&
      !window.confirm(
        "Закрыть сбор «" + coll.title + "»? Родители больше не увидят напоминаний и кнопок по нему. " +
        "Комитет по-прежнему сможет отмечать платежи и вносить правки. Сбор можно будет открыть снова."
      )
    )
      return;
    setSaving(true);
    try {
      await updateFeeCampaign(coll.id, { status: closing ? "closed" : "active" });
      await addFeeEdit({
        target: "Целевые сборы", child: coll.title,
        field: closing ? "Сбор закрыт" : "Сбор открыт снова",
        old_amount: null, new_amount: null, editor,
      });
      toast(closing ? "Сбор закрыт" : "Сбор снова открыт");
      reloadColls(); reloadLog();
    } catch (e) {
      toast("Не получилось: " + (e.message || e));
    }
    setSaving(false);
  };

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
              Семьи детей, ходящих в ГПД, сдают {fmt(FEE_TARGET)} BYN за учебный год ({fmt(FEE_TARGET - GPD_FUND_FEE)} классу
              + {fmt(GPD_FUND_FEE)} в фонд ГПД), не ходящих — {fmt(FEE_TARGET - GPD_FUND_FEE)} BYN. Списания по статьям «хознужды»,
              «подарки» и «рабочие тетради» считаются автоматически из раздела «Расходы»:
              сумма группы трат делится поровну между детьми (гардероб входит в хознужды).
              Статья «ГПД» — фиксированные {fmt(GPD_FUND_FEE)} BYN с каждого ходящего: это его взнос в фонд ГПД,
              а сами расходы ГПД оплачиваются только из фонда. Бейджи и магнитные значки проставляются вручную.
              Разовые поступления плюсуются в кассу. Каждая правка сумм попадает в историю изменений внизу страницы.
            </div>
          )}
        </div>
        {/* Пушистый казначей с банкой «Общее дело 1Г» — как и раньше, живёт в кассе.
            В банке — только взносы семей (без разовых поступлений), цель — сумма норм по семьям. */}
        <div className="fin-mascot">
          <TreasurerMascot collected={totalPaid} goal={mascotGoal} />
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
        {/* Поделиться ссылкой на сборы в вайбер-чате */}
        <button
          className="share-btn"
          onClick={() =>
            shareText(
              `Взносы класса 1 «Г»: посмотреть суммы и остатки можно здесь: ${shareUrl({ tab: "fees" })}`,
              toast
            )
          }
        >
          🔗 Поделиться
        </button>
      </div>

      {/* ===== Целевые сборы: экскурсии, подарки и другие разовые сборы с семьи ===== */}
      <div className="card fin-coll reveal d2">
        <div className="fee-head">
          <div>
            <h3 className="fin-h3">Целевые сборы <span className="chip violet">экскурсии и подарки</span></h3>
            <div className="fee-meta">Разовые сборы с семьи на конкретное дело · близнецы сдают один раз</div>
          </div>
          {canManage && (
            <button className="btn small teal" onClick={openCollCreate}>+ Новый сбор</button>
          )}
        </div>
        {/* Реквизиты для перевода — одни общие на все сборы; правит только комитет */}
        {(reqs && (reqs.card_number || reqs.phone || reqs.bank)) || committee ? (
          <div className="fee-meta" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {reqs && (reqs.card_number || reqs.phone || reqs.bank) ? (
              <>
                <span>
                  💳 Для перевода{reqs.bank ? " (" + reqs.bank + ")" : ""}:
                  {reqs.card_number ? <> карта <b>{reqs.card_number}</b></> : null}
                  {reqs.phone ? <>{reqs.card_number ? " ·" : ""} тел. <b>{reqs.phone}</b></> : null}
                </span>
                <button className="btn small white" onClick={copyReqs}>Скопировать</button>
              </>
            ) : (
              <span className="muted">Реквизиты для перевода пока не заполнены</span>
            )}
            {committee && (
              <button className="btn small white" onClick={() => setReqsOpen(true)}>
                <Ic id="i-edit" />{reqs && (reqs.card_number || reqs.phone || reqs.bank) ? "Изменить" : "Заполнить реквизиты"}
              </button>
            )}
          </div>
        ) : null}
        {colls === null && (
          <div className="muted" style={{ marginTop: 8 }}>
            Целевые сборы заработают после запуска файла fee-collections-setup.sql в Supabase (SQL Editor → вставить файл → Run).
          </div>
        )}
        {Array.isArray(visibleColls) && visibleColls.length === 0 && (
          <div style={{ marginTop: 8 }}><span className="chip gray">Сборов пока нет</span></div>
        )}
        {Array.isArray(visibleColls) && visibleColls.map((coll) => {
          const cc = collCalc(coll);
          const myFam = myNs.length ? cc.fams.get(famOf(myNs[0])) : null;
          const open = !!collOpen[coll.id];
          const closed = coll.status === "closed";
          return (
            <div
              key={coll.id}
              style={{ borderTop: "2px solid rgba(0,0,0,.08)", marginTop: 28, paddingTop: 20, opacity: closed ? 0.65 : 1 }}
            >
              <div className="fee-head">
                <div>
                  <strong>{coll.title}</strong>{" "}
                  <span className="chip blue">{fmt(coll.amount)} BYN с семьи</span>{" "}
                  {closed && <span className="chip gray">сбор закрыт</span>}{" "}
                  {!closed && coll.deadline && <span className="chip amber">сдать до {dateRu(coll.deadline)}</span>}
                  <div className="fee-meta">
                    Сдали {cc.doneCount} из {cc.partCount} семей · собрано {fmt(cc.collected)} BYN
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  {committee && (
                    <button className="btn small white" disabled={saving} onClick={() => toggleCollClosed(coll)}>
                      {closed ? "Открыть снова" : "Закрыть сбор"}
                    </button>
                  )}
                  {canManage && (
                    <button className="mini-btn" title="Изменить сбор" onClick={() => openCollEdit(coll)}>
                      <Ic id="i-edit" />
                    </button>
                  )}
                </div>
              </div>
              <div className="progress" style={{ marginTop: 6 }}>
                <i style={{ width: (cc.partCount ? Math.round((cc.doneCount / cc.partCount) * 100) : 0) + "%" }} />
              </div>
              {!closed && family && myFam && myFam.part && (() => {
                // Заявки нашей семьи: pending — ждёт комитета, последняя rejected — можно отправить снова
                const cls = myClaims(coll);
                const pending = cls.find((c) => c.status === "pending");
                const lastRejected =
                  !pending && cls.length && cls[cls.length - 1].status === "rejected"
                    ? cls[cls.length - 1]
                    : null;
                return (
                  <div style={{ marginTop: 8 }}>
                    {myFam.due > 0.005 ? (
                      pending ? (
                        <span className="chip blue">
                          {pending.method === "cash"
                            ? "Вы передадите наличными — ждёт подтверждения комитета"
                            : "Ваш чек на проверке у комитета"}
                        </span>
                      ) : (
                        <>
                          <span className="chip amber">Вы ещё не сдали — осталось {fmt(myFam.due)} BYN</span>
                          {lastRejected && (
                            <div className="muted" style={{ marginTop: 4 }}>
                              Прошлую заявку комитет отклонил — можно отправить новую.
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                            <button
                              className="btn small teal"
                              disabled={saving}
                              onClick={() => setClaimModal({ coll, fam: myFam, child: myClaimChild() })}
                            >
                              Я перевёл(а) — прикрепить чек
                            </button>
                            <button
                              className="btn small white"
                              disabled={saving}
                              onClick={() => submitCashClaim(coll, myFam)}
                            >
                              Передам наличными
                            </button>
                          </div>
                        </>
                      )
                    ) : (
                      <span className="chip green">Ваша семья сдала — спасибо!</span>
                    )}
                  </div>
                );
              })()}
              {committee && (coll.claims || []).some((cl) => cl.status === "pending") && (
                <div style={{ marginTop: 8 }}>
                  <span className="chip amber">
                    Заявки на проверку ({(coll.claims || []).filter((cl) => cl.status === "pending").length})
                  </span>
                  {(coll.claims || [])
                    .filter((cl) => cl.status === "pending")
                    .map((cl) => (
                      <div
                        key={cl.id}
                        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}
                      >
                        <span>
                          <b>{cl.child}</b> — {fmt(cl.amount)} BYN, {METHOD_LABEL[cl.method]}
                          {cl.receipt_url ? (
                            <>
                              {" · "}
                              <a href={cl.receipt_url} target="_blank" rel="noreferrer">чек</a>
                            </>
                          ) : null}
                          {cl.note ? <span className="muted"> · {cl.note}</span> : null}
                        </span>
                        <button className="btn small teal" disabled={saving} onClick={() => decideClaim(coll, cl, true)}>
                          Подтвердить
                        </button>
                        <button className="btn small white" disabled={saving} onClick={() => decideClaim(coll, cl, false)}>
                          Отклонить
                        </button>
                      </div>
                    ))}
                </div>
              )}
              <button
                className="fin-how-toggle"
                onClick={() => setCollOpen({ ...collOpen, [coll.id]: !open })}
                aria-expanded={open}
              >
                <span className={"fin-chevron" + (open ? " open" : "")} aria-hidden="true"><Ic id="i-arrow-right" /></span>
                {open ? "Скрыть список" : "Кто сдал"}
              </button>
              {open && (
                <div className="table-scroll" style={{ marginTop: 6 }}>
                  <table className="fee-table">
                    <thead>
                      <tr><th>№</th><th>Ребёнок</th><th>Статус</th></tr>
                    </thead>
                    <tbody>
                      {displayRows.map((r) => {
                        const fam = cc.fams.get(famOf(r.n));
                        const mine = myNs.includes(r.n);
                        let cell;
                        if (!cc.isPart(r.n) && !(fam && fam.part)) {
                          cell = <span className="muted">— не участвует</span>;
                        } else if (fam.due <= 0.005) {
                          cell = (
                            <span className="chip green">
                              сдано{fam.paid > coll.amount + 0.005 ? " · излишек " + fmt(round2(fam.paid - coll.amount)) : ""}
                            </span>
                          );
                        } else if (fam.paid > 0) {
                          cell = <span style={{ color: "#c0392b" }}>{fmt(fam.paid)} · осталось {fmt(fam.due)}</span>;
                        } else {
                          cell = <span style={{ color: "#c0392b" }}>не сдано · {fmt(fam.due)}</span>;
                        }
                        const clickable = committee && fam && fam.part;
                        return (
                          <tr key={r.n} className={mine ? "fee-my-row" : undefined}>
                            <td>{r.n}</td>
                            <td>{r.child}{mine && <> <span className="chip teal">ваш ребёнок</span></>}</td>
                            <td>
                              {clickable ? (
                                <button className="cell-btn" onClick={() => openCollPay(coll, fam, r.child)} title="Отметить платёж семьи">
                                  {cell}
                                </button>
                              ) : cell}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Сумма — с семьи: у близнецов платёж отмечается один раз, на любого из детей.
                    {committee ? " Нажмите на статус, чтобы отметить платёж." : ""}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Ведомость взносов по детям (раскрыта по умолчанию) ===== */}
      {listOpen && (
        <div className="card fee-card reveal d2">
          <div className="fee-head">
            <div>
              <h3>Взносы 2026–2027 <span className="chip violet">идёт</span></h3>
              <div className="fee-meta">
                {fmt(FEE_TARGET)} BYN с семьи (с ГПД) · {fmt(FEE_TARGET - GPD_FUND_FEE)} BYN — без ГПД · статьи «авто» считаются сами · бейджи и значки — вручную
              </div>
            </div>
            <span className={"chip " + (doneCount === rows.length ? "green" : "amber")}>сдали полностью · {doneCount}/{rows.length}</span>
          </div>
          <div className="progress"><i style={{ width: Math.round((doneCount / Math.max(1, rows.length)) * 100) + "%" }}></i></div>
          <div className="muted" style={{ marginBottom: 12 }}>
            Сдали полностью {doneCount} из {rows.length} · собрано {fmt(totalPaid)} BYN · осталось собрать {fmt(totalDue)} BYN · остаток на детях {fmt(totalRest)} BYN
          </div>
          <div className="row" style={{ marginBottom: 4 }}>
            <button className="btn small teal" onClick={() => onOpenUpload("Взносы 2026–2027", "до " + fmt(FEE_TARGET) + " BYN с семьи (" + fmt(FEE_TARGET - GPD_FUND_FEE) + " — без ГПД)")}>Загрузить чек об оплате</button>
            {committee && (
              <button className="btn small white" onClick={addColumn}><Ic id="i-plus" />Новая статья</button>
            )}
          </div>
          <div className="kids-scroll" style={{ marginTop: 14 }}>
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
                          {committee ? (
                            <button
                              type="button"
                              title={auto[c.id] ? "Статья считается автоматически" : "Проставить сумму всем детям сразу"}
                              onClick={() => openBulk(c)}
                              style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textDecoration: "underline dotted" }}
                            >
                              {c.title}
                            </button>
                          ) : c.title}
                          {auto[c.id] && (
                            <span className="chip teal" style={{ marginLeft: 4, padding: "1px 6px", fontSize: 9.5 }} title={auto[c.id].fixed != null
                              ? "Фиксированный взнос " + fmt(auto[c.id].fixed) + " BYN в фонд ГПД с каждого ходящего ребёнка"
                              : "Считается автоматически из раздела «Расходы»: " + fmt(auto[c.id].sum) + " BYN ÷ " + auto[c.id].count}>авто</span>
                          )}
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
                  <tr key={r.id} className={myNs.includes(r.n) ? "fee-my-row" : undefined}>
                    <td>{r.n}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.child}
                      {committee && (
                        <button className="mini-btn" title={"Переименовать: " + r.child} onClick={() => renameChild(r)}>
                          <Ic id="i-edit" />
                        </button>
                      )}
                      {isGpd(r.child) && (
                        <span className="chip green" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5 }}>ГПД</span>
                      )}
                      {myNs.includes(r.n) && (
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
          </div>
          <div>
            <div className="muted" style={{ marginTop: 8 }}>
              «Осталось сдать» — сколько не хватает до нормы: {fmt(FEE_TARGET)} BYN у ходящих в ГПД, {fmt(FEE_TARGET - GPD_FUND_FEE)} BYN у не ходящих (0 в колонке «ГПД») · «Остаток» — сданное минус списания · отрицательный остаток — нужна доплата
              · статьи «авто» пересчитываются сами при каждой новой трате в разделе «Расходы»; чтобы исключить ребёнка из такой статьи, поставьте ему 0 — его доля разделится между остальными · «ГПД» — фикс {fmt(GPD_FUND_FEE)} BYN в фонд ГПД
              {committee ? " · нажмите на сумму, чтобы исправить её, или на название статьи в шапке, чтобы проставить сумму всем детям сразу (изменения попадают в журнал)" : ""}
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
              {gpdRows.length} {plural(gpdRows.length, "ребёнок", "ребёнка", "детей")} · {fmt(GPD_FUND_FEE)} BYN с ребёнка · свой список — не совпадает со списком класса
            </div>
          </div>
        </div>
        <div className="fin-gpd-stats">
          <div className="fin-gpd-stat blue">
            <span className="fin-gpd-lb"><Ic id="i-users" />Собрано</span>
            <span className="fin-gpd-sum">{fmt(gpdCollected)} <i>BYN</i></span>
          </div>
          <div className="fin-gpd-stat pink">
            <span className="fin-gpd-lb"><Ic id="i-receipt" />Потрачено</span>
            <span className="fin-gpd-sum">{fmt(gpdSpent)} <i>BYN</i></span>
          </div>
          <div className="fin-gpd-stat green">
            <span className="fin-gpd-lb"><Ic id="i-check" />Остаток</span>
            <span className="fin-gpd-sum">{fmt(gpdRest)} <i>BYN</i></span>
          </div>
        </div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Остаток {fmt(gpdRest)} BYN = собрано {fmt(gpdCollected)} − потрачено {fmt(gpdSpent)}.
          «Собрано» — расчётное: {fmt(GPD_FUND_FEE)} BYN × {gpdRows.length} детей; у детей класса взнос входит в классный сбор {fmt(FEE_TARGET)} BYN.
          «Потрачено» подтягивается автоматически из групп «ГПД» в разделе «Расходы».
          Доля каждого ребёнка: {fmt(gpdSpent)} ÷ {gpdRows.length} = {fmt(gpdCharge)} BYN.
        </div>
        <div className="fin-actions">
          <button className="btn outline" onClick={() => setGpdOpen(!gpdOpen)} aria-expanded={gpdOpen}>
            <Ic id="i-users" />{gpdOpen ? "Скрыть взносы ГПД" : "Взносы ГПД"}
          </button>
          <button className="btn outline" onClick={() => onGoExpenses && onGoExpenses(true)}>
            <Ic id="i-receipt" />Расходы ГПД
          </button>
          {committee && gpdOpen && (
            <button className="btn outline" onClick={addGpdKid}>
              <Ic id="i-plus" />Добавить ребёнка
            </button>
          )}
        </div>
        {gpdOpen && (
          <>
          <div className="kids-scroll" style={{ marginTop: 14 }}>
            <table>
              <tbody>
                <tr>
                  <th>№</th>
                  <th>Ребёнок</th>
                  <th>Взнос</th>
                  <th>Хознужды ГПД</th>
                  <th>Остаток</th>
                  {committee && gpdLive && <th></th>}
                </tr>
                {gpdRows.map((r, i) => {
                  const rest = round2((r.paid || 0) - gpdCharge);
                  const inner = r.paid ? <b>{fmt(r.paid)}</b> : "—";
                  return (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.child}</td>
                      <td>
                        {committee ? (
                          <button className="cell-btn" title={"Изменить взнос: " + r.child} onClick={() => openGpdCell(r)}>
                            {inner}
                          </button>
                        ) : inner}
                      </td>
                      <td>−{fmt(gpdCharge)}</td>
                      <td>
                        <b style={rest < 0 ? { color: "#c2410c" } : undefined}>{fmt(rest)}</b>
                        {rest < 0 && <span className="chip amber" style={{ marginLeft: 6 }}>доплата</span>}
                      </td>
                      {committee && gpdLive && (
                        <td>
                          <button className="mini-btn danger" title="Убрать из списка" onClick={() => removeGpdKid(r)}><Ic id="i-x" /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={2} style={{ textAlign: "right" }}><b>Итого:</b></td>
                  <td><b>{fmt(gpdPaidTotal)}</b></td>
                  <td><b>−{fmt(gpdSpent)}</b></td>
                  <td><b>{fmt(round2(gpdPaidTotal - gpdSpent))}</b></td>
                  {committee && gpdLive && <td></td>}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            «Хознужды ГПД» — доля каждого ребёнка в общих тратах фонда · отрицательный остаток — взнос ещё не сдан
            {committee ? " · нажмите на взнос, чтобы исправить его (изменение попадёт в журнал)" : ""}
          </div>
          </>
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
      {bulkCol && <BulkModal column={bulkCol} rows={rows} isGpd={isGpd} onClose={() => setBulkCol(null)} onApply={applyBulk} onClear={clearBulk} saving={saving} />}
      {oneOffOpen && <OneOffModal childNames={rows.map((r) => r.child)} onClose={() => setOneOffOpen(false)} onSave={saveOneOff} saving={saving} />}
      {gpdEdit && <GpdPaidModal row={gpdEdit} onClose={() => setGpdEdit(null)} onSave={saveGpdCell} saving={saving} />}
      {collModal && <CollectionModal coll={collModal.coll} rows={rows} committee={committee} onClose={() => setCollModal(null)} onSave={saveColl} saving={saving} />}
      {collPay && <CollPayModal coll={collPay.coll} fam={collPay.fam} child={collPay.child} onClose={() => setCollPay(null)} onSave={saveCollPay} saving={saving} />}
      {reqsOpen && <RequisitesModal reqs={reqs} onClose={() => setReqsOpen(false)} onSave={saveReqs} saving={saving} />}
      {claimModal && <ClaimModal coll={claimModal.coll} fam={claimModal.fam} child={claimModal.child} reqs={reqs} onClose={() => setClaimModal(null)} onSave={submitClaim} saving={saving} />}
    </section>
  );
}
