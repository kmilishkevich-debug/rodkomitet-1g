"use client";
import { useState } from "react";
import { Ic, MascotPeek } from "./Art";
import NavIcon from "./NavIcons";
import { EXPENSE_GROUPS, fmt, groupTotal } from "./data";
import { supabase, isLive } from "@/lib/supabase";
import ExpenseModal from "./ExpenseModal";

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y.slice(2)}`;
}

export default function ExpensesTab({ committee, toast, liveGroups, onReload }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editGroup, setEditGroup] = useState(null); // id группы в режиме переименования
  const [editVal, setEditVal] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const groups = liveGroups || EXPENSE_GROUPS;
  const totalSpent = groups.reduce((s, g) => s + groupTotal(g), 0);

  const openAdd = () => {
    if (!isLive) return toast("База ещё не подключена — жду ключи Supabase от Кристины");
    setEditItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const startEditGroup = (g) => {
    if (!liveGroups) return toast("Названия групп можно менять после подключения базы");
    setEditGroup(g.id);
    setEditVal(g.title);
  };

  const saveGroupTitle = async () => {
    const title = editVal.trim();
    if (!title) return toast("Название не может быть пустым");
    setSavingTitle(true);
    const { error } = await supabase.from("expense_groups").update({ title }).eq("id", editGroup);
    setSavingTitle(false);
    if (error) return toast("Не получилось сохранить: " + error.message);
    setEditGroup(null);
    toast("Название группы обновлено");
    onReload?.();
  };

  const remove = async (item) => {
    if (!window.confirm(`Удалить расход «${item.name}»?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", item.id);
    if (error) return toast("Не получилось удалить: " + error.message);
    toast("Расход удалён");
    onReload?.();
  };

  return (
    <section id="tab-expenses">
      <div className="section-cover reveal d1" style={{ background: "var(--rose)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <NavIcon name="expenses" uid="h-expenses" size={32} className="nvi-big" />Расходы{" "}
          <span style={{ fontFamily: "'Comfortaa'", fontSize: 13, fontWeight: 700 }}>— как в таблице класса</span>
        </h2>
        {committee && (
          <button className="btn small" onClick={openAdd}>
            <Ic id="i-plus" />Добавить расход
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <div className="card reveal d2 empty-state">
          <div className="mascot-wrap"><MascotPeek /></div>
          <b>Пока ни одного расхода</b>
          <div className="muted">Как только комитет добавит первую покупку, она появится здесь — с ценой, местом закупки и чеком.</div>
        </div>
      )}

      {groups.map((g) => (
        <div className="card reveal d2" key={g.id} style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>
            {editGroup === g.id ? (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveGroupTitle(); if (e.key === "Escape") setEditGroup(null); }}
                  autoFocus
                  style={{ fontSize: 15, padding: "4px 8px", minWidth: 220 }}
                />
                <button className="mini-btn" title="Сохранить" onClick={saveGroupTitle} disabled={savingTitle}>✓</button>
                <button className="mini-btn danger" title="Отмена" onClick={() => setEditGroup(null)}>✕</button>
              </span>
            ) : (
              <>
                {g.title}
                {committee && liveGroups && (
                  <button className="mini-btn" title="Переименовать группу" onClick={() => startEditGroup(g)} style={{ marginLeft: 6 }}>
                    <Ic id="i-edit" />
                  </button>
                )}
              </>
            )}
          </h3>
          <table>
            <tbody>
              <tr>
                <th>Наименование</th><th>Цена</th><th>Кол-во</th><th>Сумма</th><th>Место закупки</th>
                {committee && liveGroups && <th></th>}
              </tr>
              {g.items.map((i) => (
                <tr key={i.id || i.name} style={i.planned ? { opacity: 0.6 } : undefined}>
                  <td>
                    {i.name}
                    {i.receipt_url && (
                      <>
                        {" "}
                        <a href={i.receipt_url} target="_blank" rel="noreferrer" className="receipt-link" title="Открыть чек">чек</a>
                      </>
                    )}
                    {(i.comment || (i.purchased_at && liveGroups)) && (
                      <div className="exp-note">
                        {[fmtDate(i.purchased_at), i.comment].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  {i.planned ? (
                    <>
                      <td>—</td>
                      <td>—</td>
                      <td><span className="chip amber">планируется</span></td>
                      <td>—</td>
                    </>
                  ) : (
                    <>
                      <td>{i.free || !i.price ? "—" : fmt(i.price)}</td>
                      <td>{i.qty}</td>
                      <td><b>{i.free ? <span className="chip green">бесплатно</span> : fmt(i.sum)}</b></td>
                      <td>{i.place}</td>
                    </>
                  )}
                  {committee && liveGroups && (
                    <td className="exp-actions">
                      <button className="mini-btn" title="Изменить" onClick={() => openEdit(i)}><Ic id="i-edit" /></button>
                      <button className="mini-btn danger" title="Удалить" onClick={() => remove(i)}><Ic id="i-x" /></button>
                    </td>
                  )}
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ textAlign: "right" }}><b>Итого по группе:</b></td>
                <td><b>{groupTotal(g) > 0 ? `${fmt(groupTotal(g))} BYN` : "—"}</b></td>
                <td></td>
                {committee && liveGroups && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <div className="muted" style={{ marginTop: 10 }}>
        Итого потрачено: <b>{fmt(totalSpent)} BYN</b> · позиции «планируется» в итог не входят · все расходы видны каждому родителю
      </div>

      <ExpenseModal
        open={modalOpen}
        groups={liveGroups || []}
        editItem={editItem}
        onClose={() => setModalOpen(false)}
        onSaved={() => onReload?.()}
        toast={toast}
      />
    </section>
  );
}
