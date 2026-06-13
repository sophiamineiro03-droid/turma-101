import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminToken,
  isAdminConfigured,
  verifyAdminPassword
} from "@/lib/admin-auth";
import { jsonError } from "@/lib/api";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = String(body.password || "");

  if (!isAdminConfigured()) {
    return jsonError("Configure ADMIN_PASSWORD com pelo menos 8 caracteres.", 503);
  }

  if (!verifyAdminPassword(password)) {
    return jsonError("Senha de administrador incorreta.", 401);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
