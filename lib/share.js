"use client";

// ===== Кнопка «Поделиться» =====
// Собирает готовый текст с ссылкой на публикацию, чтобы кинуть его
// в вайбер-чат класса. На телефоне открывает системное окно
// «Поделиться» (navigator.share), на компьютере копирует в буфер.
//
// Ссылки ведут прямо к публикации:
//   голосование → /?tab=votes&poll=ID   (вкладка прокрутит и подсветит)
//   объявление  → /?tab=announcements&ann=ID
//   сборы       → /?tab=fees            (общая ведомость, без якоря)

export function shareUrl(params) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const q = new URLSearchParams(params).toString();
  return `${origin}/?${q}`;
}

// text — готовое сообщение («Голосование: „…". Проголосуйте…: ссылка»)
// toast — показать подтверждение после копирования
export async function shareText(text, toast) {
  // Телефон: системное окно «Поделиться» — там есть и Viber
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return; // человек сам закрыл окно
      // не получилось — падаем в копирование
    }
  }
  // Компьютер (или share не сработал): копируем в буфер
  try {
    await navigator.clipboard.writeText(text);
    toast?.("Ссылка скопирована — вставьте в Viber");
  } catch {
    // Совсем старый браузер: запасной способ через скрытое поле
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast?.("Ссылка скопирована — вставьте в Viber");
    } catch {
      toast?.("Не получилось скопировать ссылку");
    }
  }
}
