import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guard Bot — Панель управления",
  description: "Telegram бот модерации групп — Dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#0d1117] text-white antialiased">{children}</body>
    </html>
  );
}
