"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  supabase, fetchPhotoEvents, createPhotoEvent, deletePhotoEvent,
  uploadPhotoMedia, addPhotoLink, deletePhotoItem, togglePhotoLike,
  sendPhotoComment, editPhotoComment, deletePhotoComment,
} from "@/lib/supabase";
import { sendPhotoPush } from "@/lib/push";
import { familyLabel } from "./data";
import { useRefreshPause } from "@/lib/formGuard";

// ===== Фото класса =====
// Лента всех фото (новые сверху, по дате ДОБАВЛЕНИЯ) + альбомы-события.
// Загружают все родители и учитель: до 30 файлов за раз, фото до 50 МБ
// (сжимаются на телефоне в две версии — миниатюра и полная), видео до 500 МБ.
// К событию можно прикрепить и внешнюю ссылку (YouTube, облако, любой сайт) —
// она живёт в ленте как карточка, с теми же сердечками и комментариями.
// Комментарий можно исправить (появится отметка «Изменено»).
// Своё удаляет автор, чужое — комитет и учитель.

const MAX_FILES = 30;      // файлов за одну загрузку
const PAGE = 20;           // фото на страницу ленты («Показать ещё»)
const CMT_MAX = 1000;      // максимум знаков в комментарии

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function fmtEventDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === new Date().toDateString()) return hm;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}, ${hm}`;
}

// День по минскому времени: ключ для группировки и подпись-разделитель
function minskDayKey(iso) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk" }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}
function minskDayLabel(iso) {
  let txt;
  try {
    txt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Minsk", day: "numeric", month: "long",
    }).format(new Date(iso));
  } catch {
    txt = "";
  }
  const key = minskDayKey(iso);
  const now = Date.now();
  if (key === minskDayKey(now)) return `Сегодня · ${txt}`;
  if (key === minskDayKey(now - 86400000)) return `Вчера · ${txt}`;
  return `Ранее · ${txt}`;
}

// Скачать один файл по ссылке (через blob, чтобы браузер не открыл его вместо скачивания)
async function downloadFile(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Файл недоступен");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

const safeName = (s) => String(s || "file").replace(/[\\/:*?"<>|]/g, "_");

// Название сайта из ссылки: «youtube.com», «disk.yandex.by»…
function linkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "ссылка";
  }
}

export default function PhotosTab({ committee, teacher, family, author, toast }) {
  const [events, setEvents] = useState(undefined); // undefined=грузим, null=нет таблиц
  const [view, setView] = useState("feed");        // "feed" | "albums"
  const [filterId, setFilterId] = useState(null);  // фильтр ленты по событию
  const [shown, setShown] = useState(PAGE);        // сколько фото показано в ленте
  const [createOpen, setCreateOpen] = useState(false);
  const [addTo, setAddTo] = useState(null);        // событие, в которое догружаем файлы
  const [linkTo, setLinkTo] = useState(null);      // событие, к которому добавляем ссылку
  const [viewer, setViewer] = useState(null);      // { source: "feed"|eventId, index, comments }
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const createdEvent = useRef(null);               // чтобы повтор неудачных не создавал событие заново

  const isParent = !committee && !teacher;
  // Подпись и «кто» для сердечек
  const signature = isParent
    ? (family ? `Семья · ${familyLabel(family.n)}` : "")
    : (author || (teacher ? "Учитель" : "Комитет"));
  const who = isParent
    ? (family ? `family:${family.n}` : "")
    : (teacher ? "teacher" : "committee");
  const myFamilyN = isParent && family ? family.n : null;

  const reload = useCallback(async () => {
    const data = await fetchPhotoEvents();
    setEvents(data);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Мгновенные обновления: свой канал, чтобы не трогать общий в page.jsx
  useEffect(() => {
    if (!supabase) return;
    let ch = supabase.channel("rk1g-photos");
    for (const t of ["photo_events", "photo_items", "photo_likes", "photo_comments"]) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, reload);
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  // ----- Лента: все фото всех событий, новые по времени добавления — сверху -----
  const feed = useMemo(() => {
    const all = [];
    for (const e of events || []) {
      for (const it of e.items) all.push({ ...it, event: e });
    }
    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return all;
  }, [events]);

  const filtered = filterId ? feed.filter((i) => i.event_id === filterId) : feed;
  const visible = filtered.slice(0, shown);

  // Элементы просмотра: лента (с учётом фильтра) или конкретный альбом
  const viewerItems = useMemo(() => {
    if (!viewer) return [];
    if (viewer.source === "feed") return filtered;
    const ev = (events || []).find((e) => e.id === viewer.source);
    return ev ? ev.items.map((it) => ({ ...it, event: ev })) : [];
  }, [viewer, filtered, events]);

  // ----- Права: своё удаляет автор, чужое — комитет и учитель -----
  const canDeleteItem = (it) =>
    committee || teacher || (myFamilyN != null && it.family_n === myFamilyN);
  const canDeleteEvent = (ev) =>
    committee || teacher || (myFamilyN != null && ev.family_n === myFamilyN);
  const isMyComment = (m) =>
    myFamilyN != null
      ? m.family_n === myFamilyN
      : m.family_n == null && m.author === signature;
  const canDeleteComment = (m) => committee || teacher || isMyComment(m);

  // ----- Загрузка файлов (последовательно, с прогрессом и списком неудачных) -----
  const uploadFiles = async (eventId, files) => {
    let done = 0;
    const failed = [];
    for (const f of files) {
      setProgress(`Загружаем ${done + failed.length + 1} из ${files.length}…`);
      try {
        await uploadPhotoMedia(eventId, f, signature, myFamilyN);
        done++;
      } catch (e) {
        console.error(e);
        failed.push(f);
        toast?.(e?.message ? `«${f.name}»: ${e.message}` : `Не загрузилось: ${f.name}`);
      }
    }
    setProgress("");
    return { done, failed };
  };

  // Пуш «Новые фото» — при любой загрузке
  const pushAbout = (title, n) => {
    const text = n > 1 ? `${title} — новых фото: ${n}` : `${title} — новое фото`;
    sendPhotoPush({ body: text, url: "/?tab=photos" }).catch(() => {});
  };

  // ----- Создание события (возвращает список неудачных файлов для повтора) -----
  const handleCreate = async ({ title, date, descr, files }) => {
    setBusy(true);
    try {
      let ev = createdEvent.current;
      if (!ev) {
        ev = await createPhotoEvent({
          title,
          event_date: date,
          descr,
          author: signature,
          family_n: myFamilyN,
        });
        createdEvent.current = ev;
      }
      const { done, failed } = await uploadFiles(ev.id, files);
      await reload();
      if (done) pushAbout(ev.title, done);
      if (!failed.length) {
        createdEvent.current = null;
        setCreateOpen(false);
        toast?.(done ? "Событие добавлено" : "Событие создано");
      }
      return failed;
    } catch (e) {
      console.error(e);
      toast?.(e?.message || "Не получилось создать событие");
      return files;
    } finally {
      setBusy(false);
    }
  };

  // ----- Догрузка файлов в существующее событие -----
  const handleAddFiles = async (files) => {
    if (!addTo) return [];
    setBusy(true);
    try {
      const { done, failed } = await uploadFiles(addTo.id, files);
      await reload();
      if (done) pushAbout(addTo.title, done);
      if (!failed.length) {
        setAddTo(null);
        if (done) toast?.(done === 1 ? "Файл добавлен" : `Добавлено файлов: ${done}`);
      }
      return failed;
    } finally {
      setBusy(false);
    }
  };

  // ----- Добавление внешней ссылки в событие -----
  const handleAddLink = async ({ url, caption }) => {
    if (!linkTo) return;
    setBusy(true);
    try {
      await addPhotoLink({
        event_id: linkTo.id,
        url,
        caption,
        author: signature,
        family_n: myFamilyN,
      });
      await reload();
      sendPhotoPush({ body: `${linkTo.title} — новая ссылка`, url: "/?tab=photos" }).catch(() => {});
      setLinkTo(null);
      toast?.("Ссылка добавлена");
    } catch (e) {
      console.error(e);
      toast?.(e?.message || "Не получилось добавить ссылку");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEvent = async (ev) => {
    const n = ev.items.length;
    if (!window.confirm(`Удалить событие «${ev.title}»${n ? ` и все файлы (${n} шт.)` : ""}? Вернуть будет нельзя.`)) return;
    try {
      await deletePhotoEvent(ev.id, ev.items);
      if (filterId === ev.id) setFilterId(null);
      await reload();
      toast?.("Событие удалено");
    } catch (e) {
      console.error(e);
      toast?.("Не получилось удалить событие");
    }
  };

  const handleDeleteItem = async (item) => {
    const q = item.type === "link"
      ? "Удалить эту ссылку? Вернуть будет нельзя."
      : "Удалить это фото или видео? Вернуть будет нельзя.";
    if (!window.confirm(q)) return;
    try {
      await deletePhotoItem(item);
      await reload();
      toast?.("Удалено");
    } catch (e) {
      console.error(e);
      toast?.("Не получилось удалить");
    }
  };

  // Точечное обновление одного фото в состоянии (для мгновенных сердечек)
  const mutateItem = (itemId, fn) => {
    setEvents((list) => (list || []).map((e) => ({
      ...e,
      items: e.items.map((it) => (it.id === itemId ? fn(it) : it)),
    })));
  };

  const handleLike = async (item) => {
    if (!who) { toast?.("Сначала выберите своего ребёнка на Главной"); return; }
    const liked = item.likes.some((l) => l.who === who);
    mutateItem(item.id, (it) => ({
      ...it,
      likes: liked ? it.likes.filter((l) => l.who !== who) : [...it.likes, { item_id: it.id, who }],
    }));
    try { await togglePhotoLike(item.id, who, liked); }
    catch (e) { console.error(e); reload(); }
  };

  const handleComment = async (item, text) => {
    if (!signature) { toast?.("Сначала выберите своего ребёнка на Главной"); return false; }
    try {
      await sendPhotoComment({ item_id: item.id, family_n: myFamilyN, author: signature, text });
      await reload();
      return true;
    } catch (e) {
      console.error(e);
      toast?.("Не получилось отправить");
      return false;
    }
  };

  const handleEditComment = async (id, text) => {
    try {
      await editPhotoComment(id, text);
      await reload();
      return true;
    } catch (e) {
      console.error(e);
      toast?.("Не получилось исправить");
      return false;
    }
  };

  const handleDeleteComment = async (id) => {
    if (!window.confirm("Удалить комментарий?")) return;
    try { await deletePhotoComment(id); await reload(); }
    catch (e) { console.error(e); toast?.("Не получилось удалить"); }
  };

  // ----- «Скачать всё» одним zip-архивом (ссылки не скачиваются — пропускаем) -----
  const handleDownloadAll = async (ev) => {
    const files = ev.items.filter((it) => it.type !== "link");
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let i = 0;
      for (const item of files) {
        i++;
        setProgress(`Собираем архив: ${i} из ${files.length}…`);
        const res = await fetch(item.url);
        if (!res.ok) continue;
        const ext = (item.path || "").split(".").pop() || (item.type === "video" ? "mp4" : "jpg");
        zip.file(`${String(i).padStart(2, "0")}-${safeName(item.name).replace(/\.[^.]+$/, "")}.${ext}`, await res.blob());
      }
      setProgress("Упаковываем…");
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeName(ev.title)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      toast?.("Архив скачан");
    } catch (e) {
      console.error(e);
      toast?.("Не получилось собрать архив");
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  // ----- Состояния «грузим» и «таблиц нет» -----
  if (events === undefined) {
    return <div className="card"><p className="muted">Загружаем фотоленту…</p></div>;
  }
  if (events === null) {
    return (
      <div className="card">
        <h3>Фотолента пока не настроена</h3>
        <p className="muted">
          Чтобы включить фото и видео, нужно один раз выполнить файл
          photos-setup.sql в Supabase (SQL Editor). После этого вкладка заработает у всех.
        </p>
      </div>
    );
  }

  const openFeedViewer = (item, withComments = false) => {
    const idx = filtered.findIndex((i) => i.id === item.id);
    if (idx >= 0) setViewer({ source: "feed", index: idx, comments: withComments });
  };

  // Разделители по дням для видимой части ленты
  const rows = [];
  let lastDay = "";
  for (const item of visible) {
    const k = minskDayKey(item.created_at);
    if (k !== lastDay) {
      lastDay = k;
      rows.push({ sep: minskDayLabel(item.created_at), key: "sep-" + k });
    }
    rows.push({ item, key: item.id });
  }

  return (
    <>
      {/* Шапка с маскотом и облачком */}
      <div className="card ph-hero">
        <div className="ph-hero-mascot">
          <img src="/mascot-1000.jpg" alt="" width={84} height={84} loading="lazy" />
        </div>
        <div className="ph-hero-main">
          <div className="ph-hero-bubble">Самые тёплые моменты — здесь!</div>
          <h3>Фото класса</h3>
          <p className="muted">Фото и видео с событий 1 «Г». Загружать могут все.</p>
        </div>
        <button className="btn teal ph-hero-add" onClick={() => setCreateOpen(true)}>+ Событие</button>
      </div>

      {/* Переключатель Лента / Альбомы */}
      <div className="ph-switch" role="tablist">
        <button
          role="tab"
          aria-selected={view === "feed"}
          className={view === "feed" ? "act" : ""}
          onClick={() => setView("feed")}
        >Лента фото</button>
        <button
          role="tab"
          aria-selected={view === "albums"}
          className={view === "albums" ? "act" : ""}
          onClick={() => setView("albums")}
        >Альбомы</button>
      </div>

      {!events.length && (
        <div className="card">
          <p className="muted">
            Пока пусто. Нажмите «+ Событие», чтобы добавить первые фото —
            например, с 1 сентября или экскурсии.
          </p>
        </div>
      )}

      {view === "feed" && events.length > 0 && (
        <>
          {/* Фильтры-карточки событий */}
          {events.length > 1 && (
            <div className="ph-filters">
              <button
                className={"ph-filter ph-filter-all" + (!filterId ? " act" : "")}
                onClick={() => { setFilterId(null); setShown(PAGE); }}
              >
                <span className="ph-filter-title">Все</span>
                <span className="ph-filter-n">{feed.length}</span>
              </button>
              {events.map((e) => {
                const cover = e.items[0];
                return (
                  <button
                    key={e.id}
                    className={"ph-filter" + (filterId === e.id ? " act" : "")}
                    onClick={() => { setFilterId(filterId === e.id ? null : e.id); setShown(PAGE); }}
                    title={e.title}
                  >
                    {cover ? (
                      cover.type === "video"
                        ? <span className="ph-filter-img ph-filter-video">▶</span>
                        : cover.type === "link" && !cover.thumb_url
                          ? <span className="ph-filter-img ph-filter-video">🔗</span>
                          : <img className="ph-filter-img" src={cover.thumb_url || cover.url} alt="" loading="lazy" />
                    ) : (
                      <span className="ph-filter-img ph-filter-video">📷</span>
                    )}
                    <span className="ph-filter-title">{e.title}</span>
                    <span className="ph-filter-n">{e.items.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!filtered.length && (
            <div className="card"><p className="muted">В этом событии пока нет фото.</p></div>
          )}

          {/* Лента: 2 колонки с разделителями по дням */}
          <div className="ph-feed">
            {rows.map((r) =>
              r.sep ? (
                <div key={r.key} className="ph-day">{r.sep}</div>
              ) : (
                <FeedCard
                  key={r.key}
                  item={r.item}
                  who={who}
                  onOpen={() => openFeedViewer(r.item)}
                  onComments={() => openFeedViewer(r.item, true)}
                  onLike={() => handleLike(r.item)}
                />
              )
            )}
          </div>

          {filtered.length > shown && (
            <div className="ph-more">
              <button className="btn white" onClick={() => setShown((n) => n + PAGE)}>
                Показать ещё фото ({filtered.length - shown})
              </button>
            </div>
          )}
        </>
      )}

      {view === "albums" && events.map((ev) => (
        <div key={ev.id} className="card ph-event">
          <div className="ph-ev-top">
            <div>
              <h3 className="ph-ev-title">{ev.title}</h3>
              <div className="muted ph-ev-meta">
                {[fmtEventDate(ev.event_date), ev.author, ev.items.length ? `фото: ${ev.items.length}` : ""].filter(Boolean).join(" · ")}
              </div>
            </div>
            {canDeleteEvent(ev) && (
              <button className="ph-x" title="Удалить событие" onClick={() => handleDeleteEvent(ev)}>✕</button>
            )}
          </div>

          {ev.descr && <p className="ph-ev-descr">{ev.descr}</p>}

          {ev.items.length > 0 ? (
            <div className="ph-grid">
              {ev.items.slice(0, 8).map((item, idx) => (
                <button
                  key={item.id}
                  className="ph-thumb"
                  onClick={() => setViewer({ source: ev.id, index: idx, comments: false })}
                  title={item.name || ""}
                >
                  {item.type === "video" ? (
                    <>
                      <video src={item.url} preload="metadata" muted playsInline />
                      <span className="ph-play">▶</span>
                    </>
                  ) : item.type === "link" ? (
                    item.thumb_url ? (
                      <>
                        <img src={item.thumb_url} alt={item.name || ""} loading="lazy" />
                        <span className="ph-play">▶</span>
                      </>
                    ) : (
                      <span className="ph-thumb-link">🔗</span>
                    )
                  ) : (
                    <img src={item.thumb_url || item.url} alt={item.name || ""} loading="lazy" />
                  )}
                  {idx === 7 && ev.items.length > 8 && (
                    <span className="ph-rest">+{ev.items.length - 8}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Файлов пока нет.</p>
          )}

          <div className="ph-actions">
            <button className="btn small white" onClick={() => setAddTo(ev)}>+ Фото</button>
            <button className="btn small white" onClick={() => setLinkTo(ev)}>🔗 Ссылка</button>
            {ev.items.length > 0 && (
              <button
                className="btn small white"
                onClick={() => { setView("feed"); setFilterId(ev.id); setShown(PAGE); }}
              >Открыть в ленте</button>
            )}
            {ev.items.some((it) => it.type !== "link") && (
              <button className="btn small white" disabled={busy} onClick={() => handleDownloadAll(ev)}>
                ⬇ Скачать всё
              </button>
            )}
          </div>
          {busy && progress && <p className="muted ph-progress">{progress}</p>}
        </div>
      ))}

      {createOpen && (
        <UploadModal
          mode="create"
          busy={busy}
          progress={progress}
          onSubmit={handleCreate}
          onClose={() => { if (!busy) { createdEvent.current = null; setCreateOpen(false); } }}
        />
      )}

      {addTo && (
        <UploadModal
          mode="add"
          event={addTo}
          busy={busy}
          progress={progress}
          onSubmit={handleAddFiles}
          onClose={() => !busy && setAddTo(null)}
        />
      )}

      {linkTo && (
        <LinkModal
          event={linkTo}
          busy={busy}
          onSubmit={handleAddLink}
          onClose={() => !busy && setLinkTo(null)}
        />
      )}

      {viewer && viewerItems.length > 0 && (
        <PhotoViewer
          items={viewerItems}
          index={viewer.index}
          commentsOpen={viewer.comments}
          setIndex={(i) => setViewer((v) => ({ ...v, index: i }))}
          who={who}
          onLike={handleLike}
          canDeleteItem={canDeleteItem}
          onDeleteItem={handleDeleteItem}
          isMyComment={isMyComment}
          canDeleteComment={canDeleteComment}
          onComment={handleComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          onClose={() => setViewer(null)}
          toast={toast}
        />
      )}
    </>
  );
}

// ===== Карточка фото в ленте =====
// Ссылка (type='link') — тоже карточка: с обложкой YouTube или аккуратной
// заглушкой с названием сайта; нажатие открывает ссылку в новой вкладке.
function FeedCard({ item, who, onOpen, onComments, onLike }) {
  const liked = who && item.likes.some((l) => l.who === who);
  return (
    <div className="ph-card">
      {item.type === "link" ? (
        <a
          className="ph-card-media ph-linkcard"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={item.name || item.url}
        >
          {item.thumb_url ? (
            <>
              <img src={item.thumb_url} alt={item.name || ""} loading="lazy" />
              <span className="ph-play">▶</span>
            </>
          ) : (
            <span className="ph-link-fill">🔗</span>
          )}
          <span className="ph-link-label">
            {item.name || linkHost(item.url)} <span className="ph-link-host">{linkHost(item.url)} ↗</span>
          </span>
        </a>
      ) : (
        <button className="ph-card-media" onClick={onOpen} title={item.name || ""}>
          {item.type === "video" ? (
            <>
              <video src={item.url} preload="metadata" muted playsInline />
              <span className="ph-play">▶</span>
            </>
          ) : (
            <img src={item.thumb_url || item.url} alt={item.name || ""} loading="lazy" />
          )}
        </button>
      )}
      <div className="ph-card-bar">
        <button
          className={"ph-like" + (liked ? " act" : "")}
          onClick={onLike}
          title={liked ? "Убрать сердечко" : "Нравится"}
        >
          {liked ? "❤️" : "🤍"}{item.likes.length > 0 && <span> {item.likes.length}</span>}
        </button>
        <button className="ph-cmt-btn" onClick={onComments} title="Комментарии">
          💬{item.comments.length > 0 && <span> {item.comments.length}</span>}
        </button>
      </div>
      <div className="muted ph-card-meta">
        {[item.event?.title, item.author].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

// ===== Комментарии под фото (в просмотре) =====
function PhotoComments({ item, isMyComment, canDeleteComment, onSend, onEdit, onDelete }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const body = text.trim().slice(0, CMT_MAX);
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSend(item, body);
    setBusy(false);
    if (ok) setText("");
  };

  const saveEdit = async () => {
    const body = editText.trim().slice(0, CMT_MAX);
    if (!body || busy) return;
    setBusy(true);
    const ok = await onEdit(editId, body);
    setBusy(false);
    if (ok) { setEditId(null); setEditText(""); }
  };

  return (
    <div className="ph-comments" onClick={(e) => e.stopPropagation()}>
      {!item.comments.length && <p className="muted">Пока никто не написал — будьте первыми!</p>}
      {item.comments.map((m) =>
        editId === m.id ? (
          <div key={m.id} className="ph-cmt">
            <textarea
              className="chat-input"
              rows={2}
              maxLength={CMT_MAX}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="actions">
              <button className="btn small white" onClick={() => setEditId(null)} disabled={busy}>Отмена</button>
              <button className="btn small primary" onClick={saveEdit} disabled={busy || !editText.trim()}>
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <div key={m.id} className="ph-cmt">
            <div className="ph-cmt-text">{m.text}</div>
            <div className="muted ph-cmt-meta">
              {m.author || "Родитель"} · {fmtTime(m.created_at)}
              {m.edited_at && <span className="ph-edited"> · Изменено</span>}
              {isMyComment(m) && (
                <button
                  className="pc-del"
                  title="Исправить комментарий"
                  onClick={() => { setEditId(m.id); setEditText(m.text); }}
                >✎</button>
              )}
              {canDeleteComment(m) && (
                <button className="pc-del" title="Удалить комментарий" onClick={() => onDelete(m.id)}>✕</button>
              )}
            </div>
          </div>
        )
      )}
      <textarea
        className="chat-input"
        rows={2}
        maxLength={CMT_MAX}
        placeholder="Написать комментарий…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="actions">
        <button className="btn small primary" onClick={send} disabled={busy || !text.trim()}>
          {busy ? "Отправляем…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}

// ===== Модалка загрузки: новое событие или догрузка файлов =====
// После неудачных загрузок остаётся открытой и предлагает «Повторить неудачные».
function UploadModal({ mode, event, busy, progress, onSubmit, onClose }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [descr, setDescr] = useState("");
  const [files, setFiles] = useState([]);
  const [retryMode, setRetryMode] = useState(false);
  const inputRef = useRef(null);
  const create = mode === "create";

  useRefreshPause(true);

  const pick = (list) => {
    let arr = Array.from(list || []);
    if (arr.length > MAX_FILES) {
      arr = arr.slice(0, MAX_FILES);
      alert(`За один раз можно загрузить до ${MAX_FILES} файлов — взяли первые ${MAX_FILES}.`);
    }
    setFiles(arr);
    setRetryMode(false);
  };

  const submit = async () => {
    if (create && !title.trim()) return;
    if (!files.length) return;
    const failed = await (create
      ? onSubmit({ title: title.trim(), date: date || null, descr: descr.trim(), files })
      : onSubmit(files));
    if (failed && failed.length) {
      setFiles(failed);
      setRetryMode(true);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{create ? "Новое событие" : `Добавить в «${event.title}»`}</h3>
        {create && (
          <>
            <label>Название</label>
            <input
              placeholder="Например: Экскурсия в музей"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              disabled={retryMode}
            />
            <label>Дата события</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={retryMode} />
            <label>Описание (необязательно)</label>
            <textarea
              rows={2}
              placeholder="Пару слов о событии…"
              value={descr}
              onChange={(e) => setDescr(e.target.value)}
              disabled={retryMode}
            />
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => pick(e.target.files)}
        />
        <button className="upload-zone" onClick={() => inputRef.current?.click()} disabled={busy}>
          {retryMode
            ? `Не загрузилось файлов: ${files.length}`
            : files.length
              ? `Выбрано файлов: ${files.length}`
              : "📷 Выбрать фото и видео"}
        </button>
        <p className="muted ph-hint">
          До {MAX_FILES} файлов за раз. Фото до 50 МБ (сожмутся сами), видео — до 500 МБ.
        </p>
        {busy && progress && <p className="muted ph-progress">{progress}</p>}
        <div className="actions">
          <button className="btn small white" onClick={onClose} disabled={busy}>
            {retryMode ? "Закрыть" : "Отмена"}
          </button>
          <button
            className="btn small teal"
            onClick={submit}
            disabled={busy || !files.length || (create && !retryMode && !title.trim())}
          >
            {busy ? "Загружаем…" : retryMode ? "Повторить неудачные" : create ? "Создать" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Модалка «Добавить ссылку»: адрес + необязательная подпись =====
// Принимаем только http/https. Если это YouTube — в ленте появится
// обложка ролика, иначе — карточка с названием сайта.
function LinkModal({ event, busy, onSubmit, onClose }) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  useRefreshPause(true);

  const clean = url.trim();
  const valid = /^https?:\/\/\S+\.\S+/i.test(clean);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ссылка в «{event.title}»</h3>
        <label>Адрес ссылки</label>
        <input
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {clean && !valid && (
          <p className="muted ph-hint">
            Нужна полная ссылка, начиная с https:// — проще всего нажать
            «Поделиться» → «Копировать ссылку» и вставить сюда.
          </p>
        )}
        <label>Подпись (необязательно)</label>
        <input
          placeholder="Например: Видео с утренника"
          maxLength={120}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="muted ph-hint">
          Подойдёт ссылка на YouTube (покажем обложку ролика), облако или любой
          сайт. Без подписи покажем название сайта.
        </p>
        <div className="actions">
          <button className="btn small white" onClick={onClose} disabled={busy}>Отмена</button>
          <button
            className="btn small teal"
            onClick={() => onSubmit({ url: clean, caption: caption.trim() })}
            disabled={busy || !valid}
          >
            {busy ? "Добавляем…" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Полноэкранный просмотр: листание + сердечко + комментарии =====
function PhotoViewer({
  items, index, commentsOpen, setIndex, who, onLike,
  canDeleteItem, onDeleteItem, isMyComment, canDeleteComment,
  onComment, onEditComment, onDeleteComment, onClose, toast,
}) {
  const i = Math.min(index, items.length - 1);
  const item = items[i];
  const touchX = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [showComments, setShowComments] = useState(!!commentsOpen);

  useRefreshPause(true);

  // Если удалили последний файл — закрываем просмотр
  useEffect(() => {
    if (!items.length) onClose();
  }, [items.length, onClose]);

  const prev = useCallback(() => setIndex(i > 0 ? i - 1 : items.length - 1), [i, items.length, setIndex]);
  const next = useCallback(() => setIndex(i < items.length - 1 ? i + 1 : 0), [i, items.length, setIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  if (!item) return null;

  const liked = who && item.likes.some((l) => l.who === who);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const ext = (item.path || "").split(".").pop() || "jpg";
      const base = safeName(item.name || "photo").replace(/\.[^.]+$/, "");
      await downloadFile(item.url, `${base}.${ext}`);
    } catch (e) {
      console.error(e);
      toast?.("Не получилось скачать");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="overlay ph-viewer"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx > 50) prev();
        else if (dx < -50) next();
      }}
    >
      <div className="ph-view-top" onClick={(e) => e.stopPropagation()}>
        <span className="ph-view-count">{i + 1} / {items.length}</span>
        <span className="ph-view-btns">
          {item.type !== "link" && (
            <button className="ph-vbtn" title="Скачать" disabled={downloading} onClick={download}>⬇</button>
          )}
          {canDeleteItem(item) && (
            <button className="ph-vbtn" title="Удалить" onClick={() => onDeleteItem(item)}>🗑</button>
          )}
          <button className="ph-vbtn" title="Закрыть" onClick={onClose}>✕</button>
        </span>
      </div>

      <div className="ph-view-body" onClick={(e) => e.stopPropagation()}>
        {item.type === "link" ? (
          <a
            key={item.id}
            className="ph-view-link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.thumb_url && <img src={item.thumb_url} alt="" />}
            <span className="ph-view-link-name">{item.name || linkHost(item.url)}</span>
            <span className="ph-view-link-host">Открыть: {linkHost(item.url)} ↗</span>
          </a>
        ) : item.type === "video" ? (
          <video key={item.id} src={item.url} controls autoPlay playsInline />
        ) : (
          <img key={item.id} src={item.url} alt={item.name || ""} />
        )}
      </div>

      <div className="ph-view-social" onClick={(e) => e.stopPropagation()}>
        <div className="ph-view-meta muted">
          {[item.event?.title, item.author, fmtTime(item.created_at)].filter(Boolean).join(" · ")}
        </div>
        <div className="ph-view-actions">
          <button
            className={"ph-like" + (liked ? " act" : "")}
            onClick={() => onLike(item)}
            title={liked ? "Убрать сердечко" : "Нравится"}
          >
            {liked ? "❤️" : "🤍"}{item.likes.length > 0 && <span> {item.likes.length}</span>}
          </button>
          <button className="ph-cmt-btn" onClick={() => setShowComments((v) => !v)}>
            💬 {item.comments.length ? `Комментарии (${item.comments.length})` : "Комментарии"}
          </button>
        </div>
        {showComments && (
          <PhotoComments
            item={item}
            isMyComment={isMyComment}
            canDeleteComment={canDeleteComment}
            onSend={onComment}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
          />
        )}
      </div>

      {items.length > 1 && (
        <>
          <button className="ph-nav ph-nav-l" onClick={(e) => { e.stopPropagation(); prev(); }}>‹</button>
          <button className="ph-nav ph-nav-r" onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
        </>
      )}
    </div>
  );
}
