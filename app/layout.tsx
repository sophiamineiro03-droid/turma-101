import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolão da Turma 101",
  description: "Inscrições, palpites, Pix confirmado e classificação do Bolão da Turma 101.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
