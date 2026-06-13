import { NextRequest, NextResponse } from "next/server";
import { jsonError, handleApiError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PrivateParticipantRecord, PredictionRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const participantId = request.nextUrl.searchParams.get("participantId");
    const token = request.nextUrl.searchParams.get("token");

    if (!participantId || !token) {
      return jsonError("Participante nao encontrado neste dispositivo.", 401);
    }

    const supabase = getSupabaseAdmin();
    const participantResult = await supabase
      .from("participants")
      .select("id,name,email,pix_status,access_token,created_at,confirmed_at")
      .eq("id", participantId)
      .eq("access_token", token)
      .single();

    if (participantResult.error || !participantResult.data) {
      return jsonError("Sessao do participante invalida.", 401);
    }

    const predictionsResult = await supabase
      .from("predictions")
      .select("*")
      .eq("participant_id", participantId);

    if (predictionsResult.error) throw predictionsResult.error;

    const participant = participantResult.data as PrivateParticipantRecord;

    return NextResponse.json({
      participant: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        pixStatus: participant.pix_status,
        accessToken: participant.access_token,
        createdAt: participant.created_at,
        confirmedAt: participant.confirmed_at
      },
      predictions: (predictionsResult.data || []) as PredictionRecord[]
    });
  } catch (error) {
    return handleApiError(error);
  }
}
