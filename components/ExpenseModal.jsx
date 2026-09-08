"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, uploadReceipt } from "@/lib/supabase";

const NEW_GROUP = "__new__";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// «2 уп (48 шт)» → 2 ; «3» → 3
function qtyNumber(qty) {
  const m = String(qty || "").replace(",", ".").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
}

export default function ExpenseModal({ open, groups, editItem, onClose, onSaved, toast }) {
  const [groupId, setGroupId] = useState("");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [sum, setSum] = useState("");
  const [sumTouched, setSumTouched] = useState(false);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(todayISO());
  const [comment, setComment] = useState("");
  const [free, setFree] = useState(false);
  const [planned, setPlanned] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setGroupId(editItem.group_id);
      setName(editItem.name || "");
      setPrice(editItem.price ? String(editItem.price) : "");
      setQty(editItem.qty || "1");
      setSum(editItem.sum ? String(editItem.sum) : "");
      setSumTouched(true);
      setPlace(editItem.place || "");
      setDate(editItem.purchased_at || todayISO());
      setComment(editItem.comment || "");
      setFree(!!editItem.free);
      setPlanned(!!editItem.planned);
    } else {
      setGroupId(groups?.[0]?.id || "");
      setName(""); setPrice(""); setQty("1"); setSum(""); setSumTouched(false);
      setPlace(""); setDate(todayISO()); setComment("");
      setFree(false); setPlanned(false);
    }
    setNewGroupTitle("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [open, editItem, groups]);

  // Сумма считается сама: цена × количество (если сумму не правили вручную)
  const autoSum = useMemo(() => {
    const p = parseFloat(String(price).replace(",", "."));
    const q = qtyNumber(qty);
    if (isNaN(p)) return "";
    return (p * (isNaN(q) ? 1 : q)).toFixed(2);
  }, [price, qty]);
  const shownSum = sumTouched ? sum : autoSum;

  if (!open) return null;

  const save = async () => {
    const finalName = name.trim();
    if (!finalName) return toast("Укажите наименование");
    let gid = groupId;
    if (gid === NEW_GROUP) {
      if (!newGroupTitle.trim()) return toast("Укажите название новой группы");
    } else if (!gid) return toast("Выберите группу расходов");

    const sumNum = free || planned ? 0 : parseFloat(String(shownSum).replace(",", "."));
    if (!free && !planned && (isNaN(sumNum) || sumNum <= 0)) return toast("Укажите цену или сумму");
    if (!planned && !free && !file && !editItem?.receipt_url) return toast("Прикрепите фото чека — без него расход не сохраняется");

    setSaving(true);
    try {
      if (gid === NEW_GROUP) {
        const maxSort = Math.max(0, ...groups.map((g) => g.sort || 0));
        const { data, error } = await supabase
          .from("expense_groups")
          .insert({ title: newGroupTitle.trim(), sort: maxSort + 1 })
          .select()
          .single();
        if (error) throw error;
        gid = data.id;
      }

      let receipt_url = editItem?.receipt_url || null;
      if (file) receipt_url = await uploadReceipt(file);

      const row = {
        group_id: gid,
        name: finalName,
        price: planned ? null : parseFloat(String(price).replace(",", ".")) || 0,
        qty: planned ? null : qty.trim() || "1",
        sum: planned ? null : sumNum,
        place: planned ? null : place.trim() || null,
        comment: comment.trim() || null,
        purchased_at: date || todayISO(),
        planned,
        free,
        receipt_url,
      };

      const q = editItem
        ? supabase.from("expenses").update(row).eq("id", editItem.id)
        : supabase.from("expenses").insert(row);
      const { error } = await q;
      if (error) throw error;

      toast(editItem ? "Расход обновлён" : "Расход добавлен — родители уже видят его");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить: " + (e.message || "ошибка сети. Попробуйте ещё раз"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay">
      <div className="modal exp-modal">
        <h3>{editItem ? "Изменить расход" : "Новый расход"}</h3>
        <div className="muted">Расход сразу станет виден всем родителям</div>

        <div className="exp-form">
          <label>Группа</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
            <option value={NEW_GROUP}>+ Новая группа…</option>
          </select>
          {groupId === NEW_GROUP && (
            <input
              placeholder="Название группы, например «Хозяйственные нужды (октябрь)»"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
            />
          )}

          <label>Наименование</label>
          <input placeholder="Например: Влажные салфетки" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="exp-check">
            <input type="checkbox" checked={planned} onChange={(e) => setPlanned(e.target.checked)} />
            <span>Пока только планируется (без суммы и чека)</span>
          </label>

          {!planned && (
            <>
              <label className="exp-check">
                <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
                <span>Бесплатно (принесли родители / подарок)</span>
              </label>

              {!free && (
                <div className="exp-row3">
                  <div>
                    <label>Цена, BYN</label>
                    <input inputMode="decimal" placeholder="3,75" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <label>Кол-во</label>
                    <input placeholder="2 уп (48 шт)" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div>
                    <label>Сумма, BYN</label>
                    <input
                      inputMode="decimal"
                      placeholder="авто"
                      value={shownSum}
                      onChange={(e) => { setSum(e.target.value); setSumTouched(true); }}
                    />
                  </div>
                </div>
              )}

              <label>Место закупки</label>
              <input placeholder="FixPrice, 21 Век, ЕРИП…" value={place} onChange={(e) => setPlace(e.target.value)} />

              <label>Дата покупки</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

              {!free && (
                <>
                  <label>Фото чека {editItem?.receipt_url && !file ? "(уже прикреплён — можно заменить)" : "(обязательно)"}</label>
                  <div
                    className={"upload-zone" + (file || editItem?.receipt_url ? " done" : "")}
                    onClick={() => fileRef.current?.click()}
                  >
                    {file
                      ? `✓ ${file.name} — прикреплён`
                      : editItem?.receipt_url
                        ? "✓ Чек прикреплён · нажмите, чтобы заменить"
                        : "Нажмите, чтобы сфотографировать или выбрать чек"}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </>
              )}
            </>
          )}

          <label>Комментарий (необязательно)</label>
          <textarea rows={2} placeholder="Зачем купили, детали…" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        <div className="actions">
          <button className="btn small white" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="btn small teal" onClick={save} disabled={saving}>
            {saving ? "Сохраняю…" : editItem ? "Сохранить" : "Добавить расход"}
          </button>
        </div>
      </div>
    </div>
  );
}
