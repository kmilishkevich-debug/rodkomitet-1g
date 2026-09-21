"use client";
import { useEffect, useState } from "react";
import { Ic } from "./Art";
import NavIcon from "./NavIcons";
import { FAMILIES_COUNT } from "./data";
import { isLive, saveAnnouncement, deleteAnnouncement, markRead, uploadNewsImage } from "@/lib/supabase";
import FamilyPicker, { RichText, fmtNewsDate, familyName } from "./FamilyPicker";

// ===== Редактор объявления (создание и правка) =====
function AnnouncementEditor({ open, initial, author, onClose, onSaved, toast }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [important, setImportant] = useState(!!initial?.important);
  const [pinned, setPinned] = useState(!!initial?.pinned);
  const [imageUrl, setImageUrl] = useState(initial?.image_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const pickPhoto = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await uploadNewsImage(file);
        setImageUrl(url);
        toast("Фото загружено");
      } catch (e) {
        console.error(e);
        toast("Не удалось загрузить фото: " + (e.message || "ошибка"));
      }
      setUploading(false);
    };
    inp.click();
  };

  const save = async () => {
    if (!title.trim()) { toast("Напишите заголовок объявления"); return; }
    if (!isLive) { toast("База не подключена — объявления пока нельзя сохранять"); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        important,
        pinned,
        image_url: imageUrl,
      };
      if (initial?.id) payload.id = initial.id;
      else { payload.author = author; payload.status = "active"; }
      await saveAnnouncement(payload);
      toast(initial?.id ? "Объявление обновлено" : "Объявление опубликовано");
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
        <h3>{initial?.id ? "Изменить объявление" : "Новое объявление"}</h3>
        <label className="fld-lbl">Заголовок</label>
        <input className="fld" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Собрание в пятницу" maxLength={120} />
        <label className="fld-lbl">Текст</label>
        <textarea className="fld" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Текст объявления.\nАбзацы — с новой строки, ссылки вида https://… станут кликабельными."} />
        <div className="news-editor-flags">
          <label className="chk-row"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> Важное (заметная метка)</label>
          <label className="chk-row"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Закрепить сверху ленты</label>
        </div>
        {imageUrl ? (
          <div className="news-editor-photo">
            <img src={imageUrl} alt="Фото объявления" />
            <button className="btn small white" onClick={() => setImageUrl(null)}>Убрать фото</button>
          </div>
        ) : (
          <button className="btn small white" onClick={pickPhoto} disabled={uploading}>
            <Ic id="i-clip" /> {uploading ? "Загрузка…" : "Прикрепить фото"}
          </button>
        )}
        <div className="actions">
          <button className="btn small white" onClick={onClose}>Отмена</button>
          <button className="btn small gold" onClick={save} disabled={saving}>{saving ? "Сохраняю…" : initial?.id ? "Сохранить" : "Опубликовать"}</button>
        </div>
      </div>
    </div>
  );
}

// ===== Карточка объявления =====
function AnnouncementCard({ a, committee, canEdit, family, reads, toast, onEdit, onReload, onReloadReads, onNeedFamily }) {
  const [readsOpen, setReadsOpen] = useState(false);
  const myRead = family && reads.some((r) => r.announcement_id === a.id && r.family_n === family.n);
  const whoRead = reads.filter((r) => r.announcement_id === a.id).sort((x, y) => x.family_n - y.family_n);

  const doRead = async (fam) => {
    try {
      await markRead(a.id, fam.n, fam.child);
      onReloadReads();
      toast("Отмечено: прочитано семьёй " + fam.child.split(" ")[0]);
    } catch (e) {
      console.error(e);
      toast("Не получилось отметить: " + (e.message || "ошибка"));
    }
  };

  const archive = async (toStatus) => {
    try {
      await saveAnnouncement({ id: a.id, status: toStatus });
      onReload();
      toast(toStatus === "archived" ? "Объявление в архиве" : "Объявление возвращено в ленту");
    } catch (e) {
      toast("Не получилось: " + (e.message || "ошибка"));
    }
  };

  const remove = async () => {
    if (!window.confirm("Удалить объявление насовсем? Отменить будет нельзя.")) return;
    try {
      await deleteAnnouncement(a.id);
      onReload();
      toast("Объявление удалено");
    } catch (e) {
      toast("Не получилось удалить: " + (e.message || "ошибка"));
    }
  };

  return (
    <article id={"ann-" + a.id} className={"card news-card reveal d2" + (a.important ? " important" : "")}>
      <div className="news-head">
        <div className="news-titles">
          <h3 className="news-title">
            {a.pinned && <span className="news-pin" title="Закреплено">📌</span>}
            {a.title}
            {a.important && <span className="news-imp">Важное</span>}
          </h3>
          <div className="news-meta">
            {fmtNewsDate(a.created_at)} · {a.author || "Комитет"}
            {a.updated_at && <span className="muted"> · изменено</span>}
            {a.status === "archived" && <span className="tag-pill"> архив</span>}
          </div>
        </div>
        {canEdit && (
          <div className="news-tools">
            <button className="icon-btn" title="Изменить" onClick={() => onEdit(a)}><Ic id="i-edit" /></button>
            {a.status === "active"
              ? <button className="icon-btn" title="В архив" onClick={() => archive("archived")}><Ic id="i-eye" /></button>
              : <button className="icon-btn" title="Вернуть из архива" onClick={() => archive("active")}><Ic id="i-arrow-right" /></button>}
            <button className="icon-btn" title="Удалить" onClick={remove}><Ic id="i-x" /></button>
          </div>
        )}
      </div>
      <div className="news-body"><RichText text={a.body} /></div>
      {a.image_url && (
        <a href={a.image_url} target="_blank" rel="noopener noreferrer" className="news-photo">
          <img src={a.image_url} alt="Фото к объявлению" loading="lazy" />
        </a>
      )}
      <div className="news-foot">
        {committee ? (
          <button className="news-read-count" onClick={() => setReadsOpen(!readsOpen)} aria-expanded={readsOpen}>
            <Ic id="i-check" /> Прочитали {whoRead.length} из {FAMILIES_COUNT} семей {readsOpen ? "▴" : "▾"}
          </button>
        ) : myRead ? (
          <span className="news-read-done"><Ic id="i-check" /> Вы прочитали</span>
        ) : (
          <button className="pill-btn blue" onClick={() => (family ? doRead(family) : onNeedFamily(doRead))}>
            Отметить «прочитано»
          </button>
        )}
        {!committee && <span className="muted news-read-cnt">{whoRead.length} из {FAMILIES_COUNT} семей прочитали</span>}
      </div>
      {committee && readsOpen && (
        <div className="news-readers">
          {whoRead.length === 0 && <span className="muted">Пока никто не отметил прочтение</span>}
          {whoRead.map((r) => (
            <span className="news-reader" key={r.id}>{r.child || familyName(r.family_n)}</span>
          ))}
        </div>
      )}
    </article>
  );
}

// ===== Вкладка «Объявления» =====
export default function AnnouncementsTab({ committee, canEdit, author, toast, announcements, reads, onReload, onReloadReads, family, setFamily }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [famOpen, setFamOpen] = useState(false);
  const [famAction, setFamAction] = useState(null); // функция, вызываемая после выбора семьи

  // Переход с главной к конкретному объявлению: плавно прокручиваем к его карточке
  useEffect(() => {
    let id = null;
    try {
      id = sessionStorage.getItem("rk1g-focus-ann");
      sessionStorage.removeItem("rk1g-focus-ann");
    } catch {}
    if (!id) return;
    const t = setTimeout(() => {
      document.getElementById("ann-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, []);

  const all = announcements || [];
  const active = all.filter((a) => a.status === "active");
  const archived = all.filter((a) => a.status === "archived");

  const openEditor = (a) => {
    setEditing(a || null);
    setEditorOpen(true);
  };

  const needFamily = (action) => {
    setFamAction(() => action);
    setFamOpen(true);
  };

  return (
    <section id="tab-announcements">
      <div className="section-cover reveal" style={{ background: "var(--blue)" }}>
        <div className="cover-copy">
          <h1><NavIcon name="announcements" uid="cv-news" size={34} className="cover-navico" /> Объявления</h1>
          <p>Новости класса от комитета и учителя: собрания, события, важные напоминания.</p>
        </div>
        {canEdit && (
          <button className="btn small gold" onClick={() => openEditor(null)}>
            <Ic id="i-plus" /> Новое объявление
          </button>
        )}
      </div>

      {!isLive && (
        <div className="card reveal d1" style={{ padding: 18 }}>
          <b>База пока не подключена.</b>
          <p className="muted" style={{ marginTop: 6 }}>
            Объявления появятся после настройки базы (файл news-votes-setup.sql в Supabase).
          </p>
        </div>
      )}

      {isLive && announcements === null && (
        <div className="card reveal d1" style={{ padding: 18 }}>
          <b>Таблицы объявлений ещё не созданы.</b>
          <p className="muted" style={{ marginTop: 6 }}>
            Запустите файл news-votes-setup.sql в Supabase (SQL Editor → Run) — и раздел заработает.
          </p>
        </div>
      )}

      {announcements !== null && active.length === 0 && (
        <div className="card news-empty reveal d1">
          <p><b>Пока нет объявлений.</b></p>
          <p className="muted">Когда комитет или учитель опубликует новость — она появится здесь, а на вкладке загорится бейдж.</p>
        </div>
      )}

      {active.map((a) => (
        <AnnouncementCard
          key={a.id} a={a} committee={committee} canEdit={canEdit} family={family}
          reads={reads} toast={toast} onEdit={openEditor} onReload={onReload}
          onReloadReads={onReloadReads} onNeedFamily={needFamily}
        />
      ))}

      {archived.length > 0 && canEdit && (
        <>
          <button className="pill-btn news-arch-toggle" onClick={() => setShowArchive(!showArchive)} aria-expanded={showArchive}>
            Архив ({archived.length}) {showArchive ? "▴" : "▾"}
          </button>
          {showArchive && archived.map((a) => (
            <AnnouncementCard
              key={a.id} a={a} committee={committee} canEdit={canEdit} family={family}
              reads={reads} toast={toast} onEdit={openEditor} onReload={onReload}
              onReloadReads={onReloadReads} onNeedFamily={needFamily}
            />
          ))}
        </>
      )}

      {editorOpen && (
        <AnnouncementEditor
          open={editorOpen} initial={editing} author={author} toast={toast}
          onClose={() => setEditorOpen(false)} onSaved={onReload}
        />
      )}

      <FamilyPicker
        open={famOpen}
        onClose={() => setFamOpen(false)}
        title="Отметить прочтение: выберите свою семью"
        onPick={(f) => {
          setFamily(f);
          if (famAction) famAction(f);
          setFamAction(null);
        }}
      />
    </section>
  );
}
