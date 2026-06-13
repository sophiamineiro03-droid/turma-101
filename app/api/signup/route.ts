import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, isValidEmail, jsonError, normalizeEmail } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PrivateParticipantRecord } from "@/lib/types";

function serializeParticipant(participant: PrivateParticipantRecord) {
  return {
    id: participant.id,
    name: participant.name,
    email: participant.email,
    pixStatus: participant.pix_status,
    accessToken: participant.access_token,
    createdAt: participant.created_at,
    confirmedAt: participant.confirmed_at
  };
}

async function findParticipantByEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string
) {
  const result = await supabase
    .from("participants")
    .select("id,name,email,pix_status,access_token,created_at,confirmed_at")
    .eq("email", email)
    .order("created_at", { ascending: true })
    .limit(1);

  if (result.error) throw result.error;

  return (result.data?.[0] || null) as PrivateParticipantRecord | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    const email = normalizeEmail(String(body.email || ""));

    if (name.length < 2) {
      return jsonError("Informe seu nome completo.");
    }

    if (!isValidEmail(email)) {
      return jsonError("Informe um e-mail válido.");
    }

    const supabase = getSupabaseAdmin();
    const existingParticipant = await findParticipantByEmail(supabase, email);

    if (existingParticipant) {
      return NextResponse.json({
        participant: serializeParticipant(existingParticipant)
      });
    }

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
        const participant = await findParticipantByEmail(supabase, email);

        if (participant) {
          return NextResponse.json({
            participant: serializeParticipant(participant)
          });
        }
      }

      throw insertResult.error;
    }

    const participant = insertResult.data as PrivateParticipantRecord;

    return NextResponse.json(
      {
        participant: serializeParticipant(participant)
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
