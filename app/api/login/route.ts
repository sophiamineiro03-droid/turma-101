import { NextRequest, NextResponse } from "next/server";
import { handleApiError, isValidEmail, jsonError, normalizeEmail } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));

    if (!isValidEmail(email)) {
      return jsonError("Informe um e-mail válido.");
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("participants")
      .select("id, name, email, access_token, pix_status, created_at, confirmed_at")
      .eq("email", email)
      .single();

    if (error || !data) {
      return jsonError("E-mail não encontrado. Verifique ou faça sua inscrição.", 404);
    }

    return NextResponse.json({
      participant: {
        id: data.id,
        name: data.name,
        email: data.email,
        pixStatus: data.pix_status,
        accessToken: data.access_token,
        createdAt: data.created_at,
        confirmedAt: data.confirmed_at
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
