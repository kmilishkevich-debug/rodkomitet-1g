"use client";
import { useState } from "react";
import { Ic } from "./Art";
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

  const remove = async (item) => {
    if (!window.confirm(`Удалить расход «${item.name}»?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", item.id);
    if (error) return toast("Не получилось удалить: " + error.message);
    toast("Расход удалён");
    onReload?.();
  };

  return (
    <section id="tab-expenses">
      <div className="section-cover" style={{ background: "var(--rose)" }}>
        <svg className="cover-deco"><use href="#i-flower" /></svg>
        <h2>
          <Ic id="i-receipt" className="ic big" />Расходы{" "}
          <span style={{ fontFamily: "'Nunito'", fontSize: 13, fontWeight: 700 }}>— как в таблице класса</span>
        </h2>
        {committee && (
          <button className="btn small" onClick={openAdd}>
            <Ic id="i-plus" />Добавить расход
          </button>
        )}
      </div>

      {groups.map((g) => (
        <div className="card" key={g.id} style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>{g.title}</h3>
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
                      <td>{i.free ? "—" : fmt(i.price)}</td>
                      <td>{i.qty}</td>
                      <td><b>{i.free ? <span className="chip green">бесплатно</span> : fmt(i.sum)}</b></td>
                      <td>{i.place}</td>
                    </>
                  )}
                  {committee && liveGroups && (
                    <td className="exp-actions">
                      <button className="mini-btn" title="Изменить" onClick={() => openEdit(i)}>✎</button>
                      <button className="mini-btn danger" title="Удалить" onClick={() => remove(i)}>✕</button>
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
