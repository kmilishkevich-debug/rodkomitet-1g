"use client";
import { useEffect, useState } from "react";
import {
  saveAnnouncement,
  saveHomework, deleteHomework,
  saveClassEvent,
} from "@/lib/supabase";
import { sendManualPush, pushStatus, enablePush } from "@/lib/push";
import { IosSteps } from "./PushSettings";
import { CIc } from "./Art";
import { useRefreshPause } from "@/lib/formGuard";
import { AttachPicker } from "./Attachments";
import FamilyPicker from "./FamilyPicker";
import { canonicalN, familyLabel } from "./data";
import TeacherWelcomeCard from "./TeacherWelcomeCard";
import ParentMessagesCard from "./ParentMessagesCard";
import TeacherQuickCards from "./TeacherQuickCards";
import TeacherFamilyChat from "./TeacherFamilyChat";
import { PostChatModal, commentsFor, unreadFor } from "./PostChat";
import { fmtDayWord } from "./TeacherBoard";
import { TeacherAbsenceCard } from "./Absences";
import { ClassCalendar } from "./DashboardTab";
import { BIRTHDAYS_FALLBACK, bdName } from "./birthdaysData";
import { isoToDay, activeOverridesFor, applyOverridesToDay } from "./scheduleOverrides";
import { LESSONS_FALLBACK } from "./scheduleData";

// ===== Кабинет классного руководителя =====
// Переработка 21.10.2026 (ТЗ «календарь — центральный блок»): порядок
// блоков — компактное приветствие с маскотом → единая строка пяти быстрых
// действий → календарь класса (центральный рабочий блок) → две колонки:
// задания | сообщения, объявления | дни рождения месяца. Полоса «Сегодня
// в цифрах» удалена, её цифры разошлись по месту употребления: уроки — в
// строку приветствия, задания — в заголовок карточки заданий, события —
// в календарь, непрочитанные — в заголовок сообщений.
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

// «задание/задания/заданий», «урок/урока/уроков» — по правилам русского
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// Месяц в родительном падеже — заголовок «Именинники октября» и строки «27 октября»
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];

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
  const [files, setFiles] = useState([]);
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
        files: files.length ? files : null,
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
      <AttachPicker files={files} onChange={setFiles} toast={toast} />
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
  const [files, setFiles] = useState([]);
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
        files: files.length ? files : null,
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
      <AttachPicker files={files} onChange={setFiles} toast={toast} />
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
// defaultDate — дата, выбранная в календаре (ТЗ 21.10.2026 §14): форма,
// открытая из календаря, уже стоит на нужном дне.
function EventForm({ author, onDone, toast, defaultDate }) {
  const [date, setDate] = useState(defaultDate || tomorrowIso());
  const [timeText, setTimeText] = useState("");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
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
        files: files.length ? files : null,
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
      <AttachPicker files={files} onChange={setFiles} toast={toast} />
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
// Значки шапок карточек — по референсу 21.10.2026: те же объёмные
// webp-картинки из /public/icons, что и в быстрых действиях и календаре
// (книга, конверт, мегафон, тортик). Контурные SVG прежней версии убраны.
function HeadIcon({ src }) {
  return <img src={src} className="tc-head-img" alt="" />;
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

// ===== Карточка рабочей колонки =====
// ТЗ §12: в шапке остаются только значок и заголовок (плюс подпись там,
// где она что-то добавляет). Кнопки «Записать», «Добавить», «Создать»,
// «Написать» из шапок убраны — действие переехало под пустое состояние,
// ближе к месту, где его ищут глазами. В объявлениях вместо кнопки —
// текстовая ссылка на полный список.
// `head` — дополнительный элемент справа в шапке (редизайн 28.09.2026,
// ТЗ §22: переключатель «Сегодня | Завтра» живёт в хедере карточки
// заданий, а не в её теле). `anchor` — id для прокрутки из полосы
// статистики «Сегодня в цифрах».
// ===== Плашка «уведомления выключены» в кабинете учителя =====
// Доработка 23.10.2026: в базе не было ни одной учительской пуш-подписки —
// сообщения родителей (чат, обсуждения) физически не доходили. На родительской
// главной секция «Уведомления» есть, а в кабинете не было ничего. Плашка
// видна, пока уведомления на этом устройстве не включены; при «on» исчезает.
function TeacherPushBanner({ toast }) {
  const [status, setStatus] = useState(null); // null — ещё проверяем
  const [busy, setBusy] = useState(false);
  const refresh = () => pushStatus().then(setStatus).catch(() => {});
  useEffect(() => {
    // На демо-страницах (скриншоты) плашку не показываем
    if (/-demo\/?$/.test(window.location.pathname)) return;
    refresh();
  }, []);

  if (!status || status === "on" || status === "unsupported") return null;

  const turnOn = async () => {
    setBusy(true);
    const res = await enablePush("teacher", null);
    setBusy(false);
    if (res.ok) toast?.("Уведомления включены — сообщения родителей будут приходить сами");
    else if (res.reason === "denied") toast?.("Уведомления запрещены в браузере — разрешите их в настройках сайта");
    else if (res.reason !== "ios-install") toast?.("Не получилось включить: " + (res.error || res.reason || "ошибка"));
    refresh();
  };

  return (
    <div className="card push-card reveal d1" style={{ marginBottom: 20 }}>
      {status === "off" && (
        <div className="push-row">
          <CIc id="i-bell" tone="blue" size="sm" />
          <div className="push-body">
            <div className="push-title">Уведомления выключены</div>
            <div className="muted">
              Включите, чтобы сообщения родителей и ответы в обсуждениях приходили
              на это устройство сами — даже когда сайт закрыт.
            </div>
          </div>
          <button className="btn small teal" onClick={turnOn} disabled={busy}>
            {busy ? "Включаю…" : "Включить"}
          </button>
        </div>
      )}
      {status === "denied" && (
        <div className="push-row">
          <CIc id="i-bell" tone="pink" size="sm" />
          <div className="push-body">
            <div className="push-title">Уведомления запрещены в браузере</div>
            <div className="muted">
              Разрешите их в настройках браузера для этого сайта (значок замка рядом
              с адресом → Уведомления → Разрешить), затем обновите страницу.
            </div>
          </div>
        </div>
      )}
      {status === "ios-install" && <IosSteps />}
    </div>
  );
}

function WorkCard({ icon, title, sub, link, onLink, head, anchor, children, delay, tall }) {
  return (
    <div id={anchor} className={"card tc-work" + (tall ? " " + tall : "") +
      (delay ? " reveal " + delay : " reveal")}>
      <div className="dash-card-head tc-work-head">
        {icon}
        <div className="dash-card-titles">
          <h2 className="sec-title">{title}</h2>
          {sub && <div className="dash-card-sub">{sub}</div>}
        </div>
        {head}
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

// ===== Скелет загрузки карточки =====
// Редизайн 28.09.2026: null в данных значит «ещё грузится» (или таблица
// недоступна), [] — «реально пусто». Пока данных нет, показываем три
// серые полоски; кнопка «Повторить» дёргает общий reload на случай,
// если запрос упал и авто-обновление ещё не подоспело.
function CardSkeleton({ onRetry }) {
  return (
    <div className="tc-card-skel" aria-busy="true">
      <span className="tc-skel tc-skel-row"></span>
      <span className="tc-skel tc-skel-row w70"></span>
      <span className="tc-skel tc-skel-row w45"></span>
      {onRetry && (
        <button className="tc-skel-retry" onClick={onRetry}>Повторить</button>
      )}
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
  schedule, overrides, birthdays,
  postComments, chatClosed, onReloadComments,
  onReload, onReloadMessages,
}) {
  const [form, setForm] = useState(null);      // 'ann' | 'hw' | 'event' | null
  const [evDate, setEvDate] = useState(null);  // дата из календаря для формы события
  const [pickOpen, setPickOpen] = useState(false);
  const [chatFamily, setChatFamily] = useState(null); // {n, child}
  const [postChat, setPostChat] = useState(null);     // {kind, id, title}
  const [hwDay, setHwDay] = useState("tomorrow");     // 'today' | 'tomorrow'

  // Обсуждения под публикациями. Пока таблицы в базе нет
  // (postComments === null), кнопки «Обсуждение» не показываем.
  const chatsOn = postComments !== null && postComments !== undefined;
  const chatBtn = (kind, id, title) => {
    if (!chatsOn) return null;
    const cnt = commentsFor(postComments, kind, id).length;
    const unread = unreadFor(postComments, kind, id);
    return (
      <button
        className="pc-chatbtn"
        onClick={() => setPostChat({ kind, id, title })}
        title="Открыть обсуждение"
      >
        💬 Обсуждение{cnt ? ` (${cnt})` : ""}
        {unread > 0 && <span className="tc-badge">{unread}</span>}
      </button>
    );
  };

  const author = authorName || "Учитель";
  const todayIso = minskIso();
  const tmrIso = tomorrowIso();
  const close = () => { setForm(null); setEvDate(null); onReload?.(); };

  const delHw = async (h) => {
    try { await deleteHomework(h.id); onReload?.(); toast("Задание удалено"); }
    catch (e) { console.error(e); toast("Не получилось удалить"); }
  };

  const pickedDay = hwDay === "today" ? todayIso : tmrIso;
  // Превью в карточках — не длиннее трёх строк (редизайн 28.09.2026,
  // ТЗ §23): полные списки живут в своих разделах, здесь только сводка.
  const hw = (homework || []).filter((h) => h.on_date === pickedDay).slice(0, 3);

  // Переработка 21.10.2026: отдельной карточки «Ближайшие события» больше
  // нет — события живут в центральном календаре. Вместо неё — блок «Дни
  // рождения в [месяце]»: ВСЕ именинники текущего месяца, включая уже
  // прошедших (они приглушены), список не обрезается.
  const bdays = birthdays || BIRTHDAYS_FALLBACK;
  const curMonth = Number(todayIso.slice(5, 7)) - 1; // 0..11
  const todayDay = Number(todayIso.slice(8, 10));
  const curYear = Number(todayIso.slice(0, 4));
  const monthBd = bdays
    .map((k) => {
      const [by, bm, bd] = (k.born || "").split("-").map(Number);
      return { ...k, bm: bm - 1, bd, turns: by >= 2000 && by <= curYear ? curYear - by : null };
    })
    .filter((k) => k.bm === curMonth)
    .sort((a, b) => a.bd - b.bd);

  // Уроки сегодня — та же математика, что была в удалённой полосе
  // «Сегодня в цифрах»: база из живого расписания или запасного набора,
  // поверх — активные опубликованные замены на сегодняшнюю дату.
  const dow = isoToDay(todayIso); // 1=Пн … 7=Вс
  let lessonsLine = null; // null → выходной, строка — в приветствие
  if (dow >= 1 && dow <= 5) {
    const allLessons = schedule?.lessons?.length ? schedule.lessons : LESSONS_FALLBACK;
    const ovs = activeOverridesFor(overrides || [], todayIso);
    const { lessons } = applyOverridesToDay(allLessons, dow, ovs);
    lessonsLine = `${lessons.length} ${plural(lessons.length, "урок", "урока", "уроков")} сегодня`;
  }

  // Счётчики из удалённой полосы — по месту употребления (ТЗ §8):
  // активные задания → заголовок карточки заданий,
  // непрочитанные от родителей → заголовок карточки сообщений.
  const hwActive = (homework || []).filter((h) => h.on_date >= todayIso).length;
  const msgNew = (familyMessages || []).filter((m) => !m.from_teacher && !m.read_teacher).length;

  // Реплика облачка маскота — по приоритету ТЗ §16: ближайшее событие
  // (до недели) → непрочитанные сообщения → нейтральная (в TeacherPlush).
  const nextEv = (events || [])
    .filter((e) => e.on_date >= todayIso)
    .sort((a, b) => a.on_date.localeCompare(b.on_date))[0];
  let bubble = null;
  if (nextEv) {
    const dd = Math.round((new Date(nextEv.on_date + "T12:00:00") - new Date(todayIso + "T12:00:00")) / 86400000);
    // Референс 21.10.2026: реплика называет тип события и время —
    // «Завтра собрание в 18:00.» Тип угадываем по заголовку, иначе «событие».
    const t = nextEv.title || "";
    const word = /собрани/i.test(t) ? "собрание"
      : /экскурси/i.test(t) ? "экскурсия"
      : /фотограф/i.test(t) ? "фотосъёмка"
      : /праздник|утренник/i.test(t) ? "праздник"
      : "событие";
    const at = nextEv.time_text ? `в ${nextEv.time_text}` : null;
    if (dd === 0) bubble = at ? [`Сегодня ${word}`, `${at}!`] : ["Сегодня событие,", "всё готово?"];
    else if (dd === 1) bubble = at ? [`Завтра ${word}`, `${at}.`] : [`Завтра ${word} —`, "не забудем!"];
    else if (dd <= 7) bubble = [`Скоро ${word}:`, `${Number(nextEv.on_date.slice(8, 10))} ${MONTHS_GEN[Number(nextEv.on_date.slice(5, 7)) - 1]}!`];
  }
  if (!bubble && msgNew > 0) bubble = ["Есть новые", "сообщения!"];

  // Свои объявления — последние три
  const myAnn = (announcements || [])
    .filter((a) => a.status === "active" && (!authorName || a.author === authorName))
    .slice(0, 3);

  // Пять быстрых действий одной строкой (ТЗ §7): объявление и задание
  // переехали сюда из приветствия.
  const pickCard = (id) => {
    if (id === "ann") setForm("ann");
    else if (id === "hw") setForm("hw");
    else if (id === "event") setForm("event");
    else if (id === "note") setPickOpen(true);
    else if (id === "schedule") onTab("schedule");
  };

  // «+ Событие» из календаря: выбранный день подставляется в форму
  const addEventAt = (date) => {
    setEvDate(date || null);
    setForm("event");
  };

  return (
    <section className="tab active teacher-dashboard" id="tab-teacher">
      <TeacherWelcomeCard
        name={greetingName}
        todayIso={todayIso}
        lessonsLine={lessonsLine}
        idlePhrase={bubble}
      />

      <TeacherQuickCards onPick={pickCard} />

      {/* Пока уведомления на этом устройстве не включены — плашка-напоминание:
          без неё пуши о сообщениях родителей учителю не доходят вовсе */}
      <TeacherPushBanner toast={toast} />

      {/* Центральный рабочий блок кабинета (ТЗ 21.10.2026): календарь
          класса сразу под строкой действий. Тот же ClassCalendar, что у
          родителей: события, праздники/каникулы, дни рождения. Личных
          напоминаний у учителя нет (family=null), ссылки «Весь календарь»
          тоже. «+ Событие» в шапке открывает форму с выбранной датой. */}
      <ClassCalendar
        events={events}
        notes={[]}
        bdays={bdays}
        family={null}
        onTab={onTab}
        fullLink={false}
        onAddEvent={addEventAt}
      />

      {/* Правка 23.10.2026 по скриншоту: карточки больше не прямые дети
          сетки — ряды grid выравнивали «Объявления» по высокой карточке
          сообщений, и между окнами возникали огромные пустоты. Теперь две
          независимые flex-колонки: слева задания → объявления → кого нет,
          справа сообщения → именинники; каждая колонка прижимает свои
          карточки друг к другу. На телефоне (≤1023) колонки схлопываются
          display:contents, а мобильный порядок (сообщения выше заданий,
          ТЗ §19) по-прежнему задаёт order в CSS. */}
      <div className="tc-grid">
        <div className="tc-col">
          <WorkCard
            icon={<HeadIcon src="/icons/icon-book.webp" />}
            title="Задания и что взять"
            /* ТЗ §8: счётчик активных заданий — в подписи карточки;
               до загрузки (homework === null) цифру не показываем */
            sub={homework === null ? null
              : `${hwActive} ${plural(hwActive, "активное задание", "активных задания", "активных заданий")}`}
            anchor="tc-card-hw"
            delay="d2"
            tall={hw.length ? null : "tc-h-hw"}
            head={
              /* Редизайн 28.09.2026 (ТЗ §22): переключатель дня переехал
                 из тела карточки в её шапку, справа от заголовка */
              <div className="tc-seg tc-seg-head">
                <button className={"tc-seg-btn" + (hwDay === "today" ? " on" : "")}
                  onClick={() => setHwDay("today")}>Сегодня</button>
                <button className={"tc-seg-btn" + (hwDay === "tomorrow" ? " on" : "")}
                  onClick={() => setHwDay("tomorrow")}>Завтра</button>
              </div>
            }
          >
            {homework === null && <CardSkeleton onRetry={onReload} />}
            {homework !== null && !hw.length && (
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
                  {chatBtn("hw", h.id, `Задание: ${short(h.text, 60)}`)}
                </div>
                <button className="note-del" onClick={() => delHw(h)} aria-label="Удалить" title="Удалить">✕</button>
              </div>
            ))}
          </WorkCard>

          {/* ТЗ §12.3: вместо кнопки — текстовая ссылка на полный список.
              Кнопку создания здесь не дублируем: объявление создаётся
              главной синей кнопкой в приветствии. */}
          <WorkCard
            icon={<HeadIcon src="/icons/icon-megaphone.webp" />}
            title="Объявления класса"
            link="Все объявления"
            onLink={() => onTab("announcements")}
            delay="d3"
            tall={myAnn.length ? null : "tc-h-ann"}
          >
            {announcements === null && <CardSkeleton onRetry={onReload} />}
            {announcements !== null && !myAnn.length && (
              <Empty
                icon={<EmptyMegaphone />}
                title="Здесь появятся ваши публикации."
                plain
              />
            )}
            {myAnn.map((a) => (
              // Кнопка обсуждения не может жить внутри кнопки-строки,
              // поэтому строка обёрнута в контейнер, а чат — под ней.
              <div className="pc-annrow" key={a.id}>
                <button className="tc-line" onClick={() => onTab("announcements")}>
                  <span className="tc-line-title">{a.important && <b className="tc-hot">Важно · </b>}{a.title}</span>
                  {a.body && <span className="tc-line-sub">{short(a.body, 70)}</span>}
                </button>
                {chatBtn("ann", a.id, a.title)}
              </div>
            ))}
          </WorkCard>

          {/* Отсутствия детей: кто не придёт сегодня и о ком предупредили
              заранее — по отметкам родителей (фича 06.10.2026). Карточка
              самодостаточная: сама грузит данные и обновляется раз в минуту. */}
          <TeacherAbsenceCard />
        </div>

        <div className="tc-col">
          {/* Мини-мессенджер (ТЗ 23.10.2026): мятная шапка, фильтры
              «Все/Непрочитанные», до трёх переписок, footer с кнопкой
              «Написать семье». Диалоги (выбор семьи, чат) остались здесь,
              в кабинете — карточка только зовёт их колбэками. */}
          <ParentMessagesCard
            familyMessages={familyMessages}
            limit={3}
            onOpenChat={(n) => setChatFamily({ n, child: familyLabel(n) })}
            onNewChat={() => setPickOpen(true)}
            onAllLink={() => onTab("messages")}
            onRetry={onReloadMessages}
          />

          {/* НОВЫЙ блок (ТЗ §10): все именинники текущего месяца, включая
              уже прошедших — прошедшие приглушены, список не обрезается.
              Клик по строке ведёт на вкладку «Класс» (список на весь год). */}
          <WorkCard
            icon={<HeadIcon src="/icons/icon-cake.webp" />}
            title={`Именинники ${MONTHS_GEN[curMonth]}`}
            link="Весь класс"
            onLink={() => onTab("class")}
            anchor="tc-card-bd"
            delay="d3"
          >
            {!monthBd.length && (
              <Empty
                icon={<EmptyCalendar />}
                title="В этом месяце именинников нет."
                plain
              />
            )}
            {monthBd.map((k) => {
              const past = k.bd < todayDay;
              const isToday = k.bd === todayDay;
              return (
                <button
                  className={"tc-line tc-bd-line" + (past ? " past" : "") + (isToday ? " now" : "")}
                  key={k.id}
                  onClick={() => onTab("class")}
                  title="Открыть список класса"
                >
                  {/* Референс §10: будущие строки — розовые плашки с мини-тортиком */}
                  {!past && <img src="/icons/icon-cake.webp" className="tc-bd-ico" alt="" />}
                  <span className="tc-bd-date">{k.bd} {MONTHS_GEN[curMonth]}</span>
                  <span className="tc-line-title">
                    {bdName(k)}
                    {isToday && <b className="tc-hot"> — сегодня!</b>}
                  </span>
                  {k.turns != null && (
                    <span className="tc-bd-age">
                      {past || isToday ? "исполнилось" : "исполнится"} {k.turns}
                    </span>
                  )}
                </button>
              );
            })}
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
          <HomeworkForm author={author} onDone={close} toast={toast} defaultDate={pickedDay} />
        </Modal>
      )}
      {form === "event" && (
        <Modal title="Событие класса" sub="Поездка, праздник, собрание" onClose={close}>
          <EventForm author={author} onDone={close} toast={toast} defaultDate={evDate} />
        </Modal>
      )}

      <FamilyPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Какой семье написать?"
        onPick={(f) => {
          // Близнецы: любой из детей ведёт в общую ветку семьи
          setChatFamily({ n: canonicalN(f.n), child: familyLabel(f.n) });
          setPickOpen(false);
        }}
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

      <PostChatModal
        open={!!postChat}
        postKind={postChat?.kind}
        postId={postChat?.id}
        title={postChat?.title}
        comments={postComments}
        closedList={chatClosed}
        authorName={author}
        onSent={onReloadComments}
        onClose={() => { setPostChat(null); onReloadComments?.(); }}
        toast={toast}
      />
    </section>
  );
}
