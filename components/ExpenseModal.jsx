"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, uploadReceipt } from "@/lib/supabase";
import { notifyTreasurer } from "./TreasurerMascot";
import {
  useRefreshPause,
  useDraftAutosave,
  readDraft,
  clearDraft,
  hasDraft,
  confirmDiscard,
  isDirty,
} from "@/lib/formGuard";

const NEW_GROUP = "__new__";
const DRAFT_NEW = "expense:new";
const draftKeyFor = (id) => (id ? "expense:" + id : DRAFT_NEW);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function hasExpenseDraft() {
  return hasDraft(DRAFT_NEW);
}

export function clearExpenseDraft() {
  clearDraft(DRAFT_NEW);
}

export function readExpenseDraft() {
  return readDraft(DRAFT_NEW);
}

// «2 уп (48 шт)» → 2 ; «3» → 3
function qtyNumber(qty) {
  const m = String(qty || "").replace(",", ".").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
}

// Снимок расхода — чтобы заметить, что его правит кто-то ещё
function stamp(it) {
  if (!it) return "";
  return JSON.stringify([
    it.group_id, it.name, it.price, it.qty, it.sum, it.place,
    it.purchased_at, it.comment, !!it.free, !!it.planned, it.receipt_url || null,
  ]);
}

const EMPTY = {
  groupId: "", newGroupTitle: "", name: "", price: "", qty: "1", sum: "",
  sumTouched: false, place: "", date: "", comment: "", free: false, planned: false,
};

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
  const [initial, setInitial] = useState(null);    // состояние полей на момент открытия
  const [conflict, setConflict] = useState("");    // расход изменили/удалили, пока мы его правим
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  // Группы читаем через ref: их список обновляется в фоне, и раньше это
  // перезапускало эффект ниже и стирало наполовину заполненную форму
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const editId = editItem?.id || null;
  const baselineRef = useRef("");
  const dkey = draftKeyFor(editId);

  // Пока форма открыта — приложение не обновляет данные в фоне
  useRefreshPause(open);

  // Заполнение формы. Ключ эффекта — только «открылась» и «какой расход правим»,
  // поэтому фоновое обновление списка больше не сбрасывает ввод.
  useEffect(() => {
    if (!open) return;
    const gs = groupsRef.current || [];
    const d = readDraft(draftKeyFor(editId));
    const base = editItem
      ? {
          groupId: editItem.group_id || "",
          newGroupTitle: "",
          name: editItem.name || "",
          price: editItem.price ? String(editItem.price) : "",
          qty: editItem.qty || "1",
          sum: editItem.sum ? String(editItem.sum) : "",
          sumTouched: true,
          place: editItem.place || "",
          date: editItem.purchased_at || todayISO(),
          comment: editItem.comment || "",
          free: !!editItem.free,
          planned: !!editItem.planned,
        }
      : { ...EMPTY, groupId: gs?.[0]?.id || "", date: todayISO() };

    const v = d ? { ...base, ...d } : base;

    setGroupId(v.groupId || "");
    setNewGroupTitle(v.newGroupTitle || "");
    setName(v.name || "");
    setPrice(v.price || "");
    setQty(v.qty || "1");
    setSum(v.sum || "");
    setSumTouched(!!v.sumTouched);
    setPlace(v.place || "");
    setDate(v.date || todayISO());
    setComment(v.comment || "");
    setFree(!!v.free);
    setPlanned(!!v.planned);
    setRestored(!!d);
    setInitial(base);
    setConflict("");
    setFile(null);
    baselineRef.current = stamp(editItem);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  // Этот же расход в свежих данных — чтобы заметить правку от другого человека
  const liveItem = useMemo(() => {
    if (!editId) return null;
    for (const g of groups || []) {
      for (const it of g.items || []) if (it.id === editId) return it;
    }
    return null;
  }, [groups, editId]);

  useEffect(() => {
    if (!open || !editId || !baselineRef.current) return;
    if (!liveItem) {
      if ((groups || []).length) setConflict("deleted");
      return;
    }
    if (stamp(liveItem) !== baselineRef.current) setConflict("changed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, liveItem]);

  const values = useMemo(
    () => ({ groupId, newGroupTitle, name, price, qty, sum, sumTouched, place, date, comment, free, planned }),
    [groupId, newGroupTitle, name, price, qty, sum, sumTouched, place, date, comment, free, planned]
  );

  const dirty = useMemo(() => isDirty(values, initial) || !!file, [values, initial, file]);

  // Черновик пишем и для нового расхода, и для правки существующего
  useDraftAutosave(open, dkey, values, dirty);

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
    if (!confirmDiscard(dirty, "Закрыть форму? Всё, что вы набрали, пропадёт.")) return;
    clearDraft(dkey);
    onClose();
  };

  const onBackdrop = (e) => {
    if (e.target === e.currentTarget && !saving) cancel();
  };

  const save = async () => {
    const groupsNow = groupsRef.current || [];
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
        const maxSort = Math.max(0, ...groupsNow.map((g) => g.sort || 0));
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

      clearDraft(dkey);
      toast(editItem ? "Расход обновлён" : "Расход добавлен — родители уже видят его");
      // Пушистый казначей штампует чек «Учтено!» (только новые реальные расходы)
      if (!editItem && !planned && !free && sumNum > 0) {
        const groupTitle = (groupsNow.find((g) => g.id === gid) || {}).title || newGroupTitle.trim();
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
    <div className="overlay" onClick={onBackdrop}>
      <div className="modal exp-modal" onPaste={onPaste}>
        <h3>{editItem ? "Изменить расход" : "Новый расход"}</h3>
        <div className="muted">Расход сразу станет виден всем родителям</div>
        {restored && (
          <div className="chip amber" style={{ marginTop: 6 }}>
            Восстановлен незаконченный черновик — фото чека нужно прикрепить заново
          </div>
        )}
        {conflict === "changed" && (
          <div className="chip amber" style={{ marginTop: 6 }}>
            Этот расход изменил кто-то ещё, пока вы его правили. Ваш текст сохранён — после «Сохранить» останется ваш вариант.
          </div>
        )}
        {conflict === "deleted" && (
          <div className="chip amber" style={{ marginTop: 6 }}>
            Этот расход удалили, пока вы его правили. Сохранить его уже не получится — скопируйте текст, если он нужен.
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
