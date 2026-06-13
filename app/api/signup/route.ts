import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, isValidEmail, jsonError, normalizeEmail } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PrivateParticipantRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    const email = normalizeEmail(String(body.email || ""));

    if (name.length < 2) {
      return jsonError("Informe seu nome completo.");
    }

    if (!isValidEmail(email)) {
      return jsonError("Informe um e-mail valido.");
    }

    const supabase = getSupabaseAdmin();
    const insertResult = await supabase
      .from("participants")
      .insert({
        name,
        email,
        access_token: randomBytes(32).toString("hex")
      })
      .select("id,name,email,pix_status,access_token,created_at,confirmed_at")
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return jsonError(
          "Este e-mail ja esta inscrito. Use o mesmo dispositivo ou fale com a organizacao para recuperar o acesso.",
          409
        );
      }

      throw insertResult.error;
    }

    const participant = insertResult.data as PrivateParticipantRecord;

    return NextResponse.json(
      {
        participant: {
          id: participant.id,
          name: participant.name,
          email: participant.email,
          pixStatus: participant.pix_status,
          accessToken: participant.access_token,
          createdAt: participant.created_at,
          confirmedAt: participant.confirmed_at
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
