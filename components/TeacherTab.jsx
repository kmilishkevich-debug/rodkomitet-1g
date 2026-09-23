"use client";
import { useMemo, useState } from "react";
import {
  saveAnnouncement,
  saveHomework, deleteHomework,
  saveClassEvent, deleteClassEvent,
} from "@/lib/supabase";
import { sendManualPush } from "@/lib/push";
import { useRefreshPause } from "@/lib/formGuard";
import FamilyPicker, { familyName } from "./FamilyPicker";
import TeacherWelcomeCard from "./TeacherWelcomeCard";
import TeacherQuickCards from "./TeacherQuickCards";
import TeacherFamilyChat from "./TeacherFamilyChat";
import { fmtDayWord } from "./TeacherBoard";

// ===== Кабинет классного руководителя =====
// Рабочий экран на каждый день: приветствие с маскотом, две главные кнопки,
// три быстрых действия и две колонки с тем, что уже опубликовано.
// Все формы открываются поверх кабинета — со страницы не уходим.
// Каждая публикация уходит родителям пушем: отдельной галочки больше нет.

function minskIso() {
  try {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function tomorrowIso() {
  const d = new Date(minskIso() + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Короткая строка для пуша: длинный текст обрезаем, чтобы не резалось на телефоне
function short(s, n = 90) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

// ===== Окно поверх кабинета =====
// Пока оно открыто, авто-обновление данных на паузе — иначе оно стирает набранное.
function Modal({ title, sub, onClose, children }) {
  useRefreshPause(true);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tc-modal" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {sub && <p className="muted tc-modal-sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

// ===== Объявление класса =====
function AnnounceForm({ author, onDone, toast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = title.trim();
    if (!t) { toast("Напишите заголовок объявления"); return; }
    setSaving(true);
    try {
      await saveAnnouncement({
        title: t,
        body: body.trim(),
        important,
        pinned: false,
        image_url: null,
        teacher_visible: true, // своё объявление учитель видит всегда
        author,
        status: "active",
      });
      sendManualPush({
        title: important ? "Важное объявление" : "Объявление от учителя",
        body: short(body.trim() || t),
        url: "/?tab=announcements",
        audience: "parents",
      }).catch(() => {});
      toast("Объявление опубликовано, родителям ушло уведомление");
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  return (
    <>
      <label className="tchr-fld">
        <span>Заголовок</span>
        <input type="text" placeholder="Завтра приносим сменку" value={title} maxLength={120}
          onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Текст</span>
        <textarea rows={4} placeholder="Подробности, если нужны" value={body} maxLength={2000}
          onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="notify-box">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        <span>Пометить как важное</span>
      </label>
      <div className="tchr-actions">
        <button className="pill-btn" onClick={onDone}>Отмена</button>
        <button className="pill-btn blue" onClick={save} disabled={saving}>
          {saving ? "Публикую…" : "Опубликовать"}
        </button>
      </div>
    </>
  );
}

// ===== Задание и что взять =====
function HomeworkForm({ author, onDone, toast }) {
  const [date, setDate] = useState(tomorrowIso());
  const [text, setText] = useState("");
  const [bring, setBring] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = text.trim();
    if (!t) { toast("Напишите, что задано"); return; }
    setSaving(true);
    try {
      await saveHomework({
        on_date: date,
        subject: null,
        text: t,
        bring: bring.trim() || null,
        author,
      });
      sendManualPush({
        title: "Задание на " + fmtDayWord(date, minskIso()),
        body: short(t) + (bring.trim() ? ` · Взять: ${short(bring.trim(), 40)}` : ""),
        url: "/?tab=dashboard",
        audience: "parents",
      }).catch(() => {});
      toast("Задание записано, родителям ушло уведомление");
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  return (
    <>
      <label className="tchr-fld">
        <span>На какое число</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Что задано</span>
        <textarea rows={3} placeholder="Математика стр. 24, № 3–5. Чтение — рассказ до конца."
          value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Что взять с собой (необязательно)</span>
        <input type="text" placeholder="Краски, стакан для воды" value={bring} maxLength={200}
          onChange={(e) => setBring(e.target.value)} />
      </label>
      <div className="tchr-actions">
        <button className="pill-btn" onClick={onDone}>Отмена</button>
        <button className="pill-btn blue" onClick={save} disabled={saving}>
          {saving ? "Сохраняю…" : "Записать"}
        </button>
      </div>
    </>
  );
}

// ===== Событие класса =====
function EventForm({ author, onDone, toast }) {
  const [date, setDate] = useState(tomorrowIso());
  const [timeText, setTimeText] = useState("");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = title.trim();
    if (!t) { toast("Напишите название события"); return; }
    setSaving(true);
    try {
      await saveClassEvent({
        on_date: date,
        time_text: timeText.trim() || null,
        title: t,
        place: place.trim() || null,
        note: note.trim() || null,
        author,
      });
      sendManualPush({
        title: "Событие класса",
        body: t + (timeText.trim() ? ` · ${timeText.trim()}` : ""),
        url: "/?tab=dashboard",
        audience: "parents",
      }).catch(() => {});
      toast("Событие добавлено, родителям ушло уведомление");
      onDone();
    } catch (e) {
      console.error(e);
      toast("Не получилось сохранить — попробуйте ещё раз");
    }
    setSaving(false);
  };

  return (
    <>
      <label className="tchr-fld">
        <span>Название</span>
        <input type="text" placeholder="Поездка в зоопарк" value={title} maxLength={120}
          onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="tchr-grid">
        <label className="tchr-fld">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="tchr-fld">
          <span>Время (словами)</span>
          <input type="text" placeholder="в 10:00 / после 3 урока" value={timeText} maxLength={60}
            onChange={(e) => setTimeText(e.target.value)} />
        </label>
      </div>
      <label className="tchr-fld">
        <span>Где собираемся (необязательно)</span>
        <input type="text" placeholder="У входа в школу" value={place} maxLength={120}
          onChange={(e) => setPlace(e.target.value)} />
      </label>
      <label className="tchr-fld">
        <span>Что важно знать (необязательно)</span>
        <textarea rows={2} placeholder="Форма одежды по погоде, обед с собой" value={note} maxLength={400}
          onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="tchr-actions">
        <button className="pill-btn" onClick={onDone}>Отмена</button>
        <button className="pill-btn blue" onClick={save} disabled={saving}>
          {saving ? "Сохраняю…" : "Добавить"}
        </button>
      </div>
    </>
  );
}

// ===== Карточка рабочей колонки =====
function WorkCard({ icon, title, sub, action, onAction, children, delay }) {
  return (
    <div className={"card tc-work" + (delay ? " reveal " + delay : " reveal")}>
      <div className="dash-card-head">
        <img src={icon} className="head-3d" alt="" />
        <div className="dash-card-titles">
          <h2 className="sec-title">{title}</h2>
          {sub && <div className="dash-card-sub">{sub}</div>}
        </div>
        {action && <button className="tc-work-add" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div className="tc-empty">{children}</div>;
}

export default function TeacherTab({
  authorName, greetingName, toast, onTab,
  homework, events, announcements, familyMessages,
  onReload, onReloadMessages,
}) {
  const [form, setForm] = useState(null);      // 'ann' | 'hw' | 'event' | null
  const [pickOpen, setPickOpen] = useState(false);
  const [chatFamily, setChatFamily] = useState(null); // {n, child}
  const [hwDay, setHwDay] = useState("tomorrow");     // 'today' | 'tomorrow'

  const author = authorName || "Учитель";
  const todayIso = minskIso();
  const tmrIso = tomorrowIso();
  const close = () => { setForm(null); onReload?.(); };

  const delHw = async (h) => {
    try { await deleteHomework(h.id); onReload?.(); toast("Задание удалено"); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };
  const delEv = async (e2) => {
    try { await deleteClassEvent(e2.id); onReload?.(); toast("Событие удалено"); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };

  const pickedDay = hwDay === "today" ? todayIso : tmrIso;
  const hw = (homework || []).filter((h) => h.on_date === pickedDay);

  // События — только предстоящие, ближайшие сверху
  const ev = (events || [])
    .filter((e) => e.on_date >= todayIso)
    .slice()
    .sort((a, b) => (a.on_date < b.on_date ? -1 : 1))
    .slice(0, 5);

  // Свои объявления — последние три
  const myAnn = (announcements || [])
    .filter((a) => a.status === "active" && (!authorName || a.author === authorName))
    .slice(0, 3);

  // Переписка: одна строка на семью, сверху те, кто ждёт ответа
  const threads = useMemo(() => {
    const byFamily = new Map();
    (familyMessages || []).forEach((m) => {
      const cur = byFamily.get(m.family_n) || { n: m.family_n, last: null, unread: 0 };
      cur.last = m; // сообщения приходят по возрастанию времени
      if (!m.from_teacher && !m.read_teacher) cur.unread += 1;
      byFamily.set(m.family_n, cur);
    });
    return [...byFamily.values()].sort((a, b) => {
      if (!!b.unread !== !!a.unread) return b.unread - a.unread;
      return (a.last?.created_at || "") < (b.last?.created_at || "") ? 1 : -1;
    }).slice(0, 6);
  }, [familyMessages]);

  const pickCard = (id) => {
    if (id === "event") setForm("event");
    else if (id === "note") setPickOpen(true);
    else if (id === "schedule") onTab("schedule");
  };

  return (
    <section className="tab active" id="tab-teacher">
      <TeacherWelcomeCard
        name={greetingName}
        todayIso={todayIso}
        onAnnounce={() => setForm("ann")}
        onHomework={() => setForm("hw")}
      />

      <TeacherQuickCards onPick={pickCard} />

      <div className="tc-grid">
        <div className="tc-col">
          <WorkCard
            icon="/icons/icon-book.webp"
            title="Задания и что взять"
            sub="Видят все родители класса"
            action="Записать"
            onAction={() => setForm("hw")}
            delay="d2"
          >
            <div className="tc-seg">
              <button className={"tc-seg-btn" + (hwDay === "today" ? " on" : "")}
                onClick={() => setHwDay("today")}>На сегодня</button>
              <button className={"tc-seg-btn" + (hwDay === "tomorrow" ? " on" : "")}
                onClick={() => setHwDay("tomorrow")}>На завтра</button>
            </div>
            {!hw.length && (
              <Empty>
                {hwDay === "today" ? "На сегодня ничего не записано." : "На завтра ничего не записано."}
              </Empty>
            )}
            {hw.map((h) => (
              <div className="tb-row" key={h.id}>
                <div className="tb-body">
                  <div className="tb-text">{h.text}</div>
                  {h.bring && <div className="tb-bring">Взять с собой: {h.bring}</div>}
                </div>
                <button className="note-del" onClick={() => delHw(h)} aria-label="Удалить" title="Удалить">✕</button>
              </div>
            ))}
          </WorkCard>

          <WorkCard
            icon="/icons/nav-announcements.webp"
            title="Объявления класса"
            sub="Последние ваши записи"
            action="Создать"
            onAction={() => setForm("ann")}
            delay="d3"
          >
            {!myAnn.length && <Empty>Вы пока ничего не объявляли.</Empty>}
            {myAnn.map((a) => (
              <button className="tc-line" key={a.id} onClick={() => onTab("announcements")}>
                <span className="tc-line-title">{a.important && <b className="tc-hot">Важно · </b>}{a.title}</span>
                {a.body && <span className="tc-line-sub">{short(a.body, 70)}</span>}
              </button>
            ))}
          </WorkCard>
        </div>

        <div className="tc-col">
          <WorkCard
            icon="/icons/icon-calendar.webp"
            title="Ближайшие события"
            sub="Поездки, праздники, собрания"
            action="Добавить"
            onAction={() => setForm("event")}
            delay="d2"
          >
            {!ev.length && <Empty>Впереди пока ничего не запланировано.</Empty>}
            {ev.map((e) => (
              <div className="tb-row" key={e.id}>
                <span className="tb-day">{fmtDayWord(e.on_date, todayIso)}</span>
                <div className="tb-body">
                  <div className="tb-text"><b>{e.title}</b>{e.time_text ? ` · ${e.time_text}` : ""}</div>
                  {(e.place || e.note) && (
                    <div className="tb-bring">{e.place || ""}{e.place && e.note ? " · " : ""}{e.note || ""}</div>
                  )}
                </div>
                <button className="note-del" onClick={() => delEv(e)} aria-label="Удалить" title="Удалить">✕</button>
              </div>
            ))}
          </WorkCard>

          <WorkCard
            icon="/icons/icon-people.webp"
            title="Личные сообщения семьям"
            sub="Видно только вам и этой семье"
            action="Написать"
            onAction={() => setPickOpen(true)}
            delay="d3"
          >
            {!threads.length && <Empty>Переписок пока нет. Напишите первой семье — родитель увидит сообщение на главной и сможет ответить.</Empty>}
            {threads.map((t) => (
              <button className="tc-line" key={t.n}
                onClick={() => setChatFamily({ n: t.n, child: familyName(t.n) })}>
                <span className="tc-line-title">
                  {familyName(t.n)}
                  {t.unread > 0 && <span className="tc-badge">{t.unread}</span>}
                </span>
                <span className="tc-line-sub">
                  {t.last?.from_teacher ? "Вы: " : ""}{short(t.last?.text, 60)}
                </span>
              </button>
            ))}
          </WorkCard>
        </div>
      </div>

      {form === "ann" && (
        <Modal title="Объявление классу" sub="Увидят все родители, придёт уведомление" onClose={close}>
          <AnnounceForm author={author} onDone={close} toast={toast} />
        </Modal>
      )}
      {form === "hw" && (
        <Modal title="Задание и что взять" sub="Появится на главной у родителей" onClose={close}>
          <HomeworkForm author={author} onDone={close} toast={toast} />
        </Modal>
      )}
      {form === "event" && (
        <Modal title="Событие класса" sub="Поездка, праздник, собрание" onClose={close}>
          <EventForm author={author} onDone={close} toast={toast} />
        </Modal>
      )}

      <FamilyPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Какой семье написать?"
        onPick={(f) => { setChatFamily(f); setPickOpen(false); }}
      />

      <TeacherFamilyChat
        open={!!chatFamily}
        familyN={chatFamily?.n}
        familyChild={chatFamily?.child}
        messages={familyMessages}
        authorName={author}
        side="teacher"
        onSent={onReloadMessages}
        onClose={() => { setChatFamily(null); onReloadMessages?.(); }}
        toast={toast}
      />
    </section>
  );
}
