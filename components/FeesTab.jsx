"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";
import { FEES, FEE_COLUMNS, FAMILIES_COUNT, GPD_CHILDREN, fmt, feeRest } from "./data";
import { supabase, isLive, fetchFees, fetchChildNotes } from "@/lib/supabase";

// Остаток по строке живых данных: взнос минус все списания
function liveRest(row, columns) {
  let rest = 0;
  columns.forEach((c) => {
    const v = row.values[c.id] || 0;
    rest += c.kind === "paid" ? v : -v;
  });
  return Math.round(rest * 100) / 100;
}

export default function FeesTab({ committee, toast, onOpenUpload }) {
  const [listOpen, setListOpen] = useState(false);
  const [live, setLive] = useState(null); // { columns, rows } из базы
  const [editCol, setEditCol] = useState(null); // id колонки в режиме переименования
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState(null); // пометки ГПД/заметки из базы

  const reload = async () => setLive(await fetchFees());
  useEffect(() => { reload(); fetchChildNotes().then(setNotes); }, []);

  // Ходит ли ребёнок в ГПД: живые пометки из базы или встроенный список
  const isGpd = (child) => (notes ? !!(notes[child] && notes[child].gpd) : GPD_CHILDREN.includes(child));

  // Единый вид данных: живые из базы или встроенные из data.js
  const columns = live
    ? live.columns
    : FEE_COLUMNS.map((c) => ({ id: c.key, title: c.title, kind: c.kind }));
  const rows = live
    ? live.rows.map((r) => ({ ...r, rest: liveRest(r, live.columns) }))
    : FEES.map((f) => {
        const values = {};
        FEE_COLUMNS.forEach((c) => { values[c.key] = f[c.key] || 0; });
        return { id: f.n, n: f.n, child: f.child, values, rest: feeRest(f) };
      });

  const totals = {};
  columns.forEach((c) => {
    totals[c.id] = Math.round(rows.reduce((s, r) => s + (r.values[c.id] || 0), 0) * 100) / 100;
  });
  const totalPaid = columns.filter((c) => c.kind === "paid").reduce((s, c) => s + totals[c.id], 0);
  const totalRest = Math.round(rows.reduce((s, r) => s + r.rest, 0) * 100) / 100;

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

  return (
    <section id="tab-fees">
      <div className="section-cover reveal d1" style={{ background: "var(--gold)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2><NavIcon name="fees" uid="h-fees" size={32} className="nvi-big" />Сборы и взносы</h2>
        {committee && (
          <button className="btn small" onClick={addColumn}>
            <Ic id="i-plus" />Новая статья
          </button>
        )}
      </div>

      <div className="card fee-card reveal d2">
        <div className="fee-head">
          <div>
            <h3>Взносы 2026–2027 <span className="chip violet">годовой</span></h3>
            <div className="fee-meta">
              Из взносов списываются: хознужды, подарки, магнитные значки, ГПД · бейджи (3,85) — у четверых
            </div>
          </div>
          <span className="chip green">сдали · {FAMILIES_COUNT}/{FAMILIES_COUNT}</span>
        </div>
        <div className="progress"><i style={{ width: "100%" }}></i></div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Сдали {FAMILIES_COUNT} из {FAMILIES_COUNT} · собрано {fmt(totalPaid)} BYN · остаток на детях {fmt(totalRest)} BYN
        </div>
        <div className="row">
          <button className="btn small teal" onClick={() => onOpenUpload("Взнос 2026–2027", "по таблице класса")}>Загрузить чек об оплате</button>
          <button className="btn small white" onClick={() => setListOpen(!listOpen)}>{listOpen ? "Скрыть список" : "Взносы и остатки по детям"}</button>
        </div>
        {listOpen && (
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
                </tr>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.n}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.child}
                      {isGpd(r.child) && (
                        <span className="chip green" style={{ marginLeft: 6, padding: "2px 8px", fontSize: 10.5 }}>ГПД</span>
                      )}
                    </td>
                    {columns.map((c) => {
                      const v = r.values[c.id] || 0;
                      if (!v) return <td key={c.id}>—</td>;
                      return <td key={c.id}>{c.kind === "paid" ? <b>{fmt(v)}</b> : `−${fmt(v)}`}</td>;
                    })}
                    <td>
                      <b style={r.rest < 0 ? { color: "#c2410c" } : undefined}>{fmt(r.rest)}</b>
                      {r.rest < 0 && <span className="chip amber" style={{ marginLeft: 6 }}>доплата</span>}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ textAlign: "right" }}><b>Итого:</b></td>
                  {columns.map((c) => (
                    <td key={c.id}><b>{totals[c.id] ? `${c.kind === "paid" ? "" : "−"}${fmt(totals[c.id])}` : "—"}</b></td>
                  ))}
                  <td><b>{fmt(totalRest)}</b></td>
                </tr>
              </tbody>
            </table>
            <div className="muted" style={{ marginTop: 8 }}>
              Отрицательный остаток — нужна доплата · суммы как в таблице класса
            </div>
          </div>
        )}
      </div>

      <div className="card flat fee-card reveal d3" style={{ opacity: 0.72 }}>
        <div className="fee-head">
          <div>
            <h3>Рабочие тетради <span className="chip blue">планируется</span></h3>
            <div className="fee-meta">Белорусский язык · Человек и мир · Труд · ИЗО · Шкала самооценки · Планшет для прописей — сумма уточняется</div>
          </div>
          <span className="chip amber">скоро</span>
        </div>
      </div>
    </section>
  );
}
