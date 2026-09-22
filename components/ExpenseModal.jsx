"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, uploadReceipt } from "@/lib/supabase";
import { notifyTreasurer } from "./TreasurerMascot";

const NEW_GROUP = "__new__";
const DRAFT_KEY = "expenseDraft";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function hasExpenseDraft() {
  try {
    return !!localStorage.getItem(DRAFT_KEY);
  } catch {
    return false;
  }
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
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
  const [restored, setRestored] = useState(false); // показать подсказку «черновик восстановлен»
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

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
      setRestored(false);
    } else {
      // Новый расход: если есть незаконченный черновик (например, PWA перезагрузилось
      // после открытия камеры) — восстанавливаем его
      const d = readDraft();
      if (d) {
        setGroupId(d.groupId || groups?.[0]?.id || "");
        setNewGroupTitle(d.newGroupTitle || "");
        setName(d.name || "");
        setPrice(d.price || "");
        setQty(d.qty || "1");
        setSum(d.sum || "");
        setSumTouched(!!d.sumTouched);
        setPlace(d.place || "");
        setDate(d.date || todayISO());
        setComment(d.comment || "");
        setFree(!!d.free);
        setPlanned(!!d.planned);
        setRestored(true);
      } else {
        setGroupId(groups?.[0]?.id || "");
        setNewGroupTitle("");
        setName(""); setPrice(""); setQty("1"); setSum(""); setSumTouched(false);
        setPlace(""); setDate(todayISO()); setComment("");
        setFree(false); setPlanned(false);
        setRestored(false);
      }
    }
    if (editItem) setNewGroupTitle("");
    setFile(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem, groups]);

  // Автосохранение черновика (без файла) — чтобы форма пережила перезагрузку PWA
  useEffect(() => {
    if (!open || editItem) return;
    const empty = !name.trim() && !price && !place.trim() && !comment.trim() && !newGroupTitle.trim();
    try {
      if (empty) return; // не плодим пустые черновики
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        groupId, newGroupTitle, name, price, qty, sum, sumTouched,
        place, date, comment, free, planned,
      }));
    } catch {}
  }, [open, editItem, groupId, newGroupTitle, name, price, qty, sum, sumTouched, place, date, comment, free, planned]);

  // Сумма считается сама: цена × количество (если сумму не правили вручную)
  const autoSum = useMemo(() => {
    const p = parseFloat(String(price).replace(",", "."));
    const q = qtyNumber(qty);
    if (isNaN(p)) return "";
    return (p * (isNaN(q) ? 1 : q)).toFixed(2);
  }, [price, qty]);
  const shownSum = sumTouched ? sum : autoSum;

  if (!open) return null;

  // Изменение цены/количества снова включает автопересчёт суммы
  const changePrice = (v) => { setPrice(v); setSumTouched(false); };
  const changeQty = (v) => { setQty(v); setSumTouched(false); };

  const takeFile = (f) => {
    if (!f) return;
    if (!f.type?.startsWith("image/")) return toast("Это не изображение — нужен файл с фото чека");
    setFile(f);
  };

  // Вставка фото чека из буфера обмена (Ctrl+V / «Вставить» на телефоне)
  const onPaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type?.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          takeFile(f);
          toast("Фото чека вставлено из буфера обмена");
          e.preventDefault();
          return;
        }
      }
    }
  };

  const cancel = () => {
    clearDraft();
    onClose();
  };

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

      clearDraft();
      toast(editItem ? "Расход обновлён" : "Расход добавлен — родители уже видят его");
      // Пушистый казначей штампует чек «Учтено!» (только новые реальные расходы)
      if (!editItem && !planned && !free && sumNum > 0) {
        const groupTitle = (groups.find((g) => g.id === gid) || {}).title || newGroupTitle.trim();
        notifyTreasurer({
          type: "expense",
          id: "exp:" + Date.now(),
          category: groupTitle || finalName,
          amount: sumNum,
        });
      }
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
      <div className="modal exp-modal" onPaste={onPaste}>
        <h3>{editItem ? "Изменить расход" : "Новый расход"}</h3>
        <div className="muted">Расход сразу станет виден всем родителям</div>
        {restored && (
          <div className="chip amber" style={{ marginTop: 6 }}>
            Восстановлен незаконченный черновик — фото чека нужно прикрепить заново
          </div>
        )}

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
                    <input inputMode="decimal" placeholder="3,75" value={price} onChange={(e) => changePrice(e.target.value)} />
                  </div>
                  <div>
                    <label>Кол-во</label>
                    <input placeholder="2 уп (48 шт)" value={qty} onChange={(e) => changeQty(e.target.value)} />
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
                  <div className={"upload-zone" + (file || editItem?.receipt_url ? " done" : "")}>
                    <div style={{ marginBottom: 8 }}>
                      {file
                        ? `✓ ${file.name || "фото"} — прикреплён`
                        : editItem?.receipt_url
                          ? "✓ Чек прикреплён · можно заменить"
                          : "Прикрепите фото чека:"}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      <button type="button" className="btn small white" onClick={() => cameraRef.current?.click()}>
                        📷 Сфотографировать
                      </button>
                      <button type="button" className="btn small white" onClick={() => galleryRef.current?.click()}>
                        🖼 Из галереи
                      </button>
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Можно и вставить скриншот из буфера обмена (Ctrl+V)
                    </div>
                  </div>
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => takeFile(e.target.files?.[0])}
                  />
                  <input
                    ref={galleryRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => takeFile(e.target.files?.[0])}
                  />
                </>
              )}
            </>
          )}

          <label>Комментарий (необязательно)</label>
          <textarea rows={2} placeholder="Зачем купили, детали…" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        <div className="actions">
          <button className="btn small white" onClick={cancel} disabled={saving}>Отмена</button>
          <button className="btn small teal" onClick={save} disabled={saving}>
            {saving ? "Сохраняю…" : editItem ? "Сохранить" : "Добавить расход"}
          </button>
        </div>
      </div>
    </div>
  );
}
