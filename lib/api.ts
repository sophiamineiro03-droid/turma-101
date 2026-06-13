import { NextResponse } from "next/server";
import { isMissingSupabaseConfigError } from "./supabase";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (isMissingSupabaseConfigError(error)) {
    return jsonError(
      "Supabase ainda não foi configurado. Preencha as variáveis de ambiente.",
      503
    );
  }

  const message = error instanceof Error ? error.message : "Erro inesperado.";
  return jsonError(message, 500);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidScore(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 20;
}
