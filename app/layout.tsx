import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MED-UFPI · Bolão Copa do Mundo 2026",
  description: "Inscrições, palpites, Pix confirmado e classificação do bolão da turma de medicina da UFPI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
