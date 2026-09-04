import "./globals.css";

export const metadata = {
  title: "Наш 1 «Г» — школа №227",
  description: "Онлайн-касса родительского комитета 1 «Г»: сборы, расходы, чеки, голосования.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800&family=Nunito:wght@800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
