'use client';

/* Скрытая страница-примерка шрифтов: /fonts
   Три дружелюбные пары на одинаковых мини-экранах в текущей палитре. */

const PAIRS = [
  {
    id: 'A',
    name: 'Пара А — «Пухлая»',
    note: 'Baloo 2 + Nunito. Самая игривая: пухлые заголовки как у Duolingo, мягкий текст.',
    display: "'Baloo 2'",
    text: "'Nunito'",
    displayWeight: 700,
  },
  {
    id: 'B',
    name: 'Пара Б — «Мягкая округлая»',
    note: 'M PLUS Rounded 1c + Rubik. Округлая и спокойная: дружелюбно, но взросло.',
    display: "'M PLUS Rounded 1c'",
    text: "'Rubik'",
    displayWeight: 800,
  },
  {
    id: 'C',
    name: 'Пара В — «Геометричная»',
    note: 'Comfortaa + Onest. Округлая геометрия: аккуратно, современно, чуть строже.',
    display: "'Comfortaa'",
    text: "'Onest'",
    displayWeight: 700,
  },
];

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@500;600;700;800&family=M+PLUS+Rounded+1c:wght@500;700;800&family=Rubik:wght@400;500;600;700&family=Comfortaa:wght@500;600;700&family=Onest:wght@400;500;600;700&display=swap';

function Icon({ d, bg, color }) {
  return (
    <span
      style={{
        width: 36, height: 36, borderRadius: '50%', background: bg, color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
    </span>
  );
}

const icWallet = (
  <>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </>
);
const icBook = (
  <>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </>
);
const icGift = (
  <>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </>
);
const icBall = (
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </>
);

function Sample({ pair }) {
  const disp = { fontFamily: `${pair.display}, sans-serif`, fontWeight: pair.displayWeight };
  const text = { fontFamily: `${pair.text}, sans-serif` };
  const card = {
    background: '#FFFDFA', borderRadius: 24, padding: '20px 22px',
    boxShadow: '0 10px 30px rgba(23,23,23,.06)',
  };
  return (
    <section style={{ maxWidth: 560, margin: '0 auto 46px' }}>
      <div style={{ ...card, marginBottom: 14, background: '#DFE5FA' }}>
        <div style={{ ...disp, fontSize: 22, color: '#2E49A8' }}>{pair.name}</div>
        <p style={{ ...text, fontSize: 14, color: '#40456B', marginTop: 6 }}>{pair.note}</p>
      </div>

      {/* Касса */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <Icon d={icWallet} bg="#F9EDC4" color="#8a6d1a" />
          <h2 style={{ ...disp, fontSize: 24, letterSpacing: '-.01em' }}>Касса класса</h2>
        </div>
        <div style={{ ...disp, fontSize: 44, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>
          1 373,50 <span style={{ fontSize: 22, color: '#F09A4C' }}>BYN</span>
        </div>
        <p style={{ ...text, fontSize: 14.5, color: '#7A766D', margin: '6px 0 16px' }}>
          Сдали 24 семьи из 27 · осталось собрать 105 BYN
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #ECE5D6' }}>
          <Icon d={icGift} bg="#FBDCE9" color="#B03A68" />
          <div style={{ flex: 1 }}>
            <div style={{ ...text, fontWeight: 700, fontSize: 15 }}>Подарки на Новый год</div>
            <div style={{ ...text, fontSize: 13, color: '#7A766D' }}>8 сентября · Кристина М.</div>
          </div>
          <div style={{ ...disp, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>−216,00</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #ECE5D6' }}>
          <Icon d={icBook} bg="#DFE5FA" color="#2E49A8" />
          <div style={{ flex: 1 }}>
            <div style={{ ...text, fontWeight: 700, fontSize: 15 }}>Рабочие тетради</div>
            <div style={{ ...text, fontSize: 13, color: '#7A766D' }}>2 сентября · Кристина М.</div>
          </div>
          <div style={{ ...disp, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>−340,20</div>
        </div>
      </div>

      {/* Расписание */}
      <div style={{ ...card, marginBottom: 14 }}>
        <h3 style={{ ...disp, fontSize: 19, marginBottom: 10 }}>Уроки завтра · четверг</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
          <Icon d={icBall} bg="#FBE4CB" color="#B05E12" />
          <div style={{ flex: 1 }}>
            <div style={{ ...text, fontWeight: 700, fontSize: 15 }}>Физкультура · 2-й урок</div>
            <div style={{ ...text, fontSize: 13, color: '#D9534F', fontWeight: 600 }}>
              Спортивная форма и обувь
            </div>
          </div>
          <div style={{ ...text, fontSize: 13.5, color: '#7A766D', fontVariantNumeric: 'tabular-nums' }}>
            9:00–9:45
          </div>
        </div>
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...text, fontWeight: 700, fontSize: 15, background: '#171717', color: '#fff', border: 'none', borderRadius: 999, padding: '14px 26px' }}>
          Добавить расход
        </button>
        <button style={{ ...text, fontWeight: 700, fontSize: 15, background: 'transparent', color: '#171717', border: '2px solid #171717', borderRadius: 999, padding: '12px 24px' }}>
          Подробнее
        </button>
      </div>
    </section>
  );
}

export default function FontsPreview() {
  return (
    <main style={{ background: '#F6F1E7', minHeight: '100vh', padding: '34px 16px 60px' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS_HREF} />
      <div style={{ maxWidth: 560, margin: '0 auto 30px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 26 }}>
          Примерка шрифтов
        </h1>
        <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14.5, color: '#7A766D', marginTop: 6 }}>
          Один и тот же экран в трёх парах. Листайте и выбирайте: А, Б или В.
        </p>
      </div>
      {PAIRS.map((p) => <Sample key={p.id} pair={p} />)}
    </main>
  );
}
