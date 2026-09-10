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
  themeColor: "#F6F1E7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;600;700&family=Onest:wght@400;500;600;700;800&display=swap"
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
