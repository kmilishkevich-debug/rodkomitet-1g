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
// ТЗ §12.1: форма открывается на дате активной вкладки тумблера. Если
// учитель смотрит «На сегодня» и нажимает «Добавить задание», дата в форме
// уже стоит сегодняшняя — иначе запись молча уходила бы на завтра.
function HomeworkForm({ author, onDone, toast, defaultDate }) {
  const [date, setDate] = useState(defaultDate || tomorrowIso());
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

// ===== Иконки шапок и пустых состояний =====
// ТЗ §12 просит для каждой карточки свой плоский значок: синяя закрытая
// книга, синий календарь, жёлтый колокольчик в бледно-жёлтом круге,
// зелёный замок в светло-зелёном круге, а в пустых состояниях —
// бледно-голубые листок, календарь, рупор и группа людей.
// В /public/icons таких файлов нет — там объёмные цветные картинки,
// которые нельзя перекрасить в бледно-голубой. Поэтому значки нарисованы
// контуром прямо здесь: новых файлов в проект не добавляется, а системные
// emoji, которые ТЗ запрещает, не используются. Список недостающих
// ассетов вынесен в отчёт — если картинки появятся, замена будет точечной.

// Значок шапки: 40 px (ТЗ §12.1 — 38–42 px)
function HeadBook() {
  return (
    <svg className="tc-head-ico tone-blue" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M9 7.5h17.5A4.5 4.5 0 0 1 31 12v20.5H13.5A4.5 4.5 0 0 1 9 28V7.5Z"
        fill="currentColor" opacity=".16" />
      <path d="M9 7.5h17.5A4.5 4.5 0 0 1 31 12v20.5H13.5A4.5 4.5 0 0 1 9 28V7.5Z"
        stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M13.5 32.5H31" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M15 14h10M15 19.5h7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function HeadCalendar() {
  return (
    <svg className="tc-head-ico tone-blue" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6.5" y="9.5" width="27" height="24" rx="5.5"
        fill="currentColor" opacity=".16" />
      <rect x="6.5" y="9.5" width="27" height="24" rx="5.5"
        stroke="currentColor" strokeWidth="2.4" />
      <path d="M6.5 17h27M14 6v6M26 6v6" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="14" cy="24" r="2.1" fill="currentColor" />
    </svg>
  );
}

// ТЗ §12.3: жёлтый колокольчик на бледно-жёлтом круге
function HeadBell() {
  return (
    <svg className="tc-head-ico tone-yellow" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#FDF0CE" />
      <path d="M20 9.5a7.6 7.6 0 0 1 7.6 7.6v4.4l1.7 3a1.2 1.2 0 0 1-1.05 1.8H11.75a1.2 1.2 0 0 1-1.05-1.8l1.7-3v-4.4A7.6 7.6 0 0 1 20 9.5Z"
        fill="currentColor" />
      <path d="M17 27.2a3.1 3.1 0 0 0 6 0" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// ТЗ §12.4: зелёный замок на светло-зелёном круге
function HeadLock() {
  return (
    <svg className="tc-head-ico tone-green" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#E3F2D5" />
      <rect x="11.5" y="19" width="17" height="12.5" rx="4" fill="currentColor" />
      <path d="M15.4 19v-3.6a4.6 4.6 0 0 1 9.2 0V19" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="25.2" r="1.9" fill="#fff" />
    </svg>
  );
}

// Значки пустых состояний: 56 px (ТЗ §12 — 52–60 px), бледно-голубые.
// ТЗ §12.1 отдельно оговаривает, что рюкзака здесь быть не должно.
function EmptySheet() {
  return (
    <svg className="tc-empty-ico" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <path d="M13 8.5h20L44 20v27.5H13V8.5Z" fill="currentColor" opacity=".22" />
      <path d="M13 8.5h20L44 20v27.5H13V8.5Z" stroke="currentColor"
        strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M32.5 8.5V20H44" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M20 29h17M20 37h11" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function EmptyCalendar() {
  return (
    <svg className="tc-empty-ico" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="7" y="12" width="42" height="36" rx="7" fill="currentColor" opacity=".22" />
      <rect x="7" y="12" width="42" height="36" rx="7" stroke="currentColor" strokeWidth="2.8" />
      <path d="M7 23h42M18 7v9M38 7v9" stroke="currentColor"
        strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="19" cy="33" r="2.8" fill="currentColor" />
      <circle cx="28" cy="33" r="2.8" fill="currentColor" />
    </svg>
  );
}

function EmptyMegaphone() {
  return (
    <svg className="tc-empty-ico" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <path d="M40 11v34a1.9 1.9 0 0 1-3.07 1.5l-9.2-7.15A8 8 0 0 0 22.8 37.6H15a6 6 0 0 1-6-6v-7.2a6 6 0 0 1 6-6h7.8a8 8 0 0 0 4.93-1.7l9.2-7.16A1.9 1.9 0 0 1 40 11Z"
        fill="currentColor" opacity=".3" />
      <path d="M40 11v34a1.9 1.9 0 0 1-3.07 1.5l-9.2-7.15A8 8 0 0 0 22.8 37.6H15a6 6 0 0 1-6-6v-7.2a6 6 0 0 1 6-6h7.8a8 8 0 0 0 4.93-1.7l9.2-7.16A1.9 1.9 0 0 1 40 11Z"
        stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M46 22.5a7.5 7.5 0 0 1 0 11" stroke="currentColor"
        strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function EmptyPeople() {
  return (
    <svg className="tc-empty-ico" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="23" cy="19" r="8" fill="currentColor" opacity=".3" />
      <circle cx="23" cy="19" r="8" stroke="currentColor" strokeWidth="2.8" />
      <path d="M9 44a14 14 0 0 1 28 0" fill="currentColor" opacity=".3" />
      <path d="M9 44a14 14 0 0 1 28 0" stroke="currentColor"
        strokeWidth="2.8" strokeLinecap="round" />
      <path d="M38 13.6a7.4 7.4 0 0 1 0 14.3M42 42a12.6 12.6 0 0 0-5.4-10.4"
        stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

// ===== Карточка рабочей колонки =====
// ТЗ §12: в шапке остаются только значок и заголовок (плюс подпись там,
// где она что-то добавляет). Кнопки «Записать», «Добавить», «Создать»,
// «Написать» из шапок убраны — действие переехало под пустое состояние,
// ближе к месту, где его ищут глазами. В объявлениях вместо кнопки —
// текстовая ссылка на полный список.
function WorkCard({ icon, title, sub, link, onLink, children, delay, tall }) {
  return (
    <div className={"card tc-work" + (tall ? " " + tall : "") +
      (delay ? " reveal " + delay : " reveal")}>
      <div className="dash-card-head tc-work-head">
        {icon}
        <div className="dash-card-titles">
          <h2 className="sec-title">{title}</h2>
          {sub && <div className="dash-card-sub">{sub}</div>}
        </div>
        {link && (
          <button className="tc-work-link" onClick={onLink}>
            {link}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ===== Пустое состояние карточки =====
// Бледно-голубой значок, короткая главная строка, пояснение обычного веса
// и кнопка действия (ТЗ §12). Кнопка здесь единственная — в шапке её нет,
// поэтому дублирования не возникает.
//
// Вариант `plain`: у объявлений и сообщений ТЗ §12.3/§12.4 задают ровно
// одну строку пояснения. Раньше эта строка шла как title — тёмная и
// полужирная, хотя в референсе 2 она обычная серая. Поэтому при plain
// текст отдаётся в .tc-empty-hint, а не в заголовок.
function Empty({ icon, title, hint, plain, cta, ctaTone, onCta }) {
  return (
    <div className="tc-empty">
      {icon}
      {plain ? (
        <div className="tc-empty-hint only">{title}</div>
      ) : (
        <div className="tc-empty-title">{title}</div>
      )}
      {!plain && hint && <div className="tc-empty-hint">{hint}</div>}
      {cta && (
        <button className={"tc-empty-btn " + (ctaTone || "soft")} onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  );
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
    <section className="tab active teacher-dashboard" id="tab-teacher">
      <TeacherWelcomeCard
        name={greetingName}
        todayIso={todayIso}
        onAnnounce={() => setForm("ann")}
        onHomework={() => setForm("hw")}
      />

      <TeacherQuickCards onPick={pickCard} />

      {/* ТЗ §14: карточки лежат прямо в сетке, без колонок-обёрток.
          Порядок в DOM — задания → события → объявления → сообщения,
          ровно тот, что нужен на телефоне одной колонкой. На десктопе
          двухколоночная сетка сама раскладывает их 1-2 / 3-4, поэтому
          визуальный порядок нигде не расходится с порядком табуляции
          и обходиться свойством order не приходится. */}
      <div className="tc-grid">
          <WorkCard
            icon={<HeadBook />}
            title="Задания и что взять"
            delay="d2"
            tall={hw.length ? null : "tc-h-hw"}
          >
            <div className="tc-seg">
              <button className={"tc-seg-btn" + (hwDay === "today" ? " on" : "")}
                onClick={() => setHwDay("today")}>На сегодня</button>
              <button className={"tc-seg-btn" + (hwDay === "tomorrow" ? " on" : "")}
                onClick={() => setHwDay("tomorrow")}>На завтра</button>
            </div>
            {!hw.length && (
              <Empty
                icon={<EmptySheet />}
                title={hwDay === "today" ? "На сегодня заданий пока нет" : "На завтра заданий пока нет"}
                hint="Добавьте задание или напоминание, что взять с собой."
                cta="+ Добавить задание"
                ctaTone="blue"
                onCta={() => setForm("hw")}
              />
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

          {/* ТЗ §12.2: подпись «Поездки, праздники, собрания» убрана —
              она дословно повторяла подпись быстрого действия «Событие
              класса», стоящего на том же экране двумя блоками выше. */}
          <WorkCard
            icon={<HeadCalendar />}
            title="Ближайшие события"
            delay="d2"
            tall={ev.length ? null : "tc-h-ev"}
          >
            {!ev.length && (
              <Empty
                icon={<EmptyCalendar />}
                title="Ближайших событий пока нет"
                hint="Здесь будут поездки, праздники и собрания."
                cta="+ Создать событие"
                ctaTone="soft"
                onCta={() => setForm("event")}
              />
            )}
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

          {/* ТЗ §12.3: вместо кнопки — текстовая ссылка на полный список.
              Кнопку создания здесь не дублируем: объявление создаётся
              главной синей кнопкой в приветствии. */}
          <WorkCard
            icon={<HeadBell />}
            title="Объявления класса"
            link="Все объявления"
            onLink={() => onTab("announcements")}
            delay="d3"
            tall={myAnn.length ? null : "tc-h-ann"}
          >
            {!myAnn.length && (
              <Empty
                icon={<EmptyMegaphone />}
                title="Здесь появятся ваши публикации."
                plain
              />
            )}
            {myAnn.map((a) => (
              <button className="tc-line" key={a.id} onClick={() => onTab("announcements")}>
                <span className="tc-line-title">{a.important && <b className="tc-hot">Важно · </b>}{a.title}</span>
                {a.body && <span className="tc-line-sub">{short(a.body, 70)}</span>}
              </button>
            ))}
          </WorkCard>

          <WorkCard
            icon={<HeadLock />}
            title="Личные сообщения семьям"
            sub="Видно только вам и выбранной семье"
            delay="d3"
            tall={threads.length ? null : "tc-h-msg"}
          >
            {!threads.length && (
              <Empty
                icon={<EmptyPeople />}
                title="Выберите семью, чтобы написать сообщение."
                plain
                cta="Выбрать семью"
                ctaTone="soft"
                onCta={() => setPickOpen(true)}
              />
            )}
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

      {form === "ann" && (
        <Modal title="Объявление классу" sub="Увидят все родители, придёт уведомление" onClose={close}>
          <AnnounceForm author={author} onDone={close} toast={toast} />
        </Modal>
      )}
      {form === "hw" && (
        <Modal title="Задание и что взять" sub="Появится на главной у родителей" onClose={close}>
          <HomeworkForm author={author} onDone={close} toast={toast} defaultDate={pickedDay} />
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
