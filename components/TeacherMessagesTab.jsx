"use client";
import { useState } from "react";
import FamilyPicker from "./FamilyPicker";
import TeacherFamilyChat from "./TeacherFamilyChat";
import { canonicalN, familyLabel } from "./data";
import ParentMessagesCard from "./ParentMessagesCard";

// ===== Вкладка «Сообщения» (мобильное меню учителя, 23.10.2026) =====
// Переписка с семьями, вынесенная из кабинета в отдельный раздел: в нижней
// панели телефона есть кнопка «Сообщения», и учителю не нужно листать
// кабинет до карточки. Здесь тот же мини-мессенджер ParentMessagesCard,
// что и на главной (ТЗ 23.10.2026), но БЕЗ обрезки до трёх строк и без
// ссылки «Все переписки» — мы уже в полном списке.

// initialChatN — сразу открыть переписку этой семьи (демо-страница
// использует это для скриншотов: ?chat=12)
export default function TeacherMessagesTab({ authorName, toast, familyMessages, onReloadMessages, initialChatN = null }) {
  const [pickOpen, setPickOpen] = useState(false);
  const [chatFamily, setChatFamily] = useState(
    initialChatN ? { n: canonicalN(initialChatN), child: familyLabel(initialChatN) } : null
  ); // {n, child}

  return (
    <section className="tab active teacher-dashboard" id="tab-messages">
      <ParentMessagesCard
        familyMessages={familyMessages}
        limit={null}
        onOpenChat={(n) => setChatFamily({ n, child: familyLabel(n) })}
        onNewChat={() => setPickOpen(true)}
        onRetry={onReloadMessages}
      />

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
        authorName={authorName || "Учитель"}
        side="teacher"
        onSent={onReloadMessages}
        onClose={() => { setChatFamily(null); onReloadMessages?.(); }}
        toast={toast}
      />
    </section>
  );
}
