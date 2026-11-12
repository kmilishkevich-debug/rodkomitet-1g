import "./globals.css";
import PwaSetup from "@/components/PwaSetup";

export const metadata = {
  title: "Наш 1 «Г» — школа №227",
  description: "Онлайн-касса родительского комитета 1 «Г»: сборы, расходы, чеки, голосования.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Наш 1 «Г»",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#F6F4FB",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* Редизайн 30.10.2026 (ТЗ §5): заголовки — Manrope, текст — Golos Text.
            Оба шрифта с кириллицей, display=swap. Локальные WOFF2 не кладём,
            чтобы не раздувать репозиторий: CDN Google Fonts уже используется. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Golos+Text:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
