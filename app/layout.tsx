import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolao da Turma 101",
  description: "Inscricoes, palpites, Pix confirmado e classificacao do Bolao da Turma 101."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
