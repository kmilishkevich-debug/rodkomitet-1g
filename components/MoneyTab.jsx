"use client";
import { useState } from "react";
import FeesTab from "./FeesTab";
import ExpensesTab from "./ExpensesTab";
import HistoryTab from "./HistoryTab";

// Раздел «Деньги»: сборы, расходы и история изменений под одной крышей
const SUBS = [
  { id: "fees", label: "Сборы" },
  { id: "expenses", label: "Расходы" },
  { id: "history", label: "История" },
];

export default function MoneyTab({ sub, onSub, committee, toast, onOpenUpload, liveGroups, onReload, author, family }) {
  // Переход из «Сборов» в «Расходы»: с флагом подсветки группы ГПД
  const [gpdFocus, setGpdFocus] = useState(false);
  const goExpenses = (gpd) => {
    setGpdFocus(!!gpd);
    onSub("expenses");
  };
  return (
    <section id="tab-money">
      <div className="money-subnav reveal d1">
        {SUBS.map((s) => (
          <button
            key={s.id}
            className={sub === s.id ? "active" : ""}
            aria-current={sub === s.id ? "page" : undefined}
            onClick={() => onSub(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "fees" && <FeesTab committee={committee} toast={toast} onOpenUpload={onOpenUpload} author={author} onGoExpenses={goExpenses} family={family} />}
      {sub === "expenses" && <ExpensesTab committee={committee} toast={toast} liveGroups={liveGroups} onReload={onReload} focusGpd={gpdFocus} onFocusDone={() => setGpdFocus(false)} />}
      {sub === "history" && <HistoryTab toast={toast} />}
    </section>
  );
}
