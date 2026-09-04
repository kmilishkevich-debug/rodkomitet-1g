import "./globals.css";

export const metadata = {
  title: "Касса класса — родительский комитет",
  description: "Онлайн-касса родительского комитета 1 «Г»: сборы, расходы, чеки, голосования.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@500;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
