import { NextRequest, NextResponse } from "next/server";
import { handleApiError, isValidScore, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MatchRecord, PredictionRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const participantId = String(body.participantId || "");
    const token = String(body.token || "");
    const matchId = Number(body.matchId);
    const homeScore = Number(body.homeScore);
    const awayScore = Number(body.awayScore);

    if (!participantId || !token) {
      return jsonError("Faca sua inscricao antes de salvar palpites.", 401);
    }

    if (!Number.isInteger(matchId)) {
      return jsonError("Jogo invalido.");
    }

    if (!isValidScore(homeScore) || !isValidScore(awayScore)) {
      return jsonError("Use placares de 0 a 20.");
    }

    const supabase = getSupabaseAdmin();

    const participantResult = await supabase
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .eq("access_token", token)
      .single();

    if (participantResult.error || !participantResult.data) {
      return jsonError("Sessao invalida. Faca a inscricao novamente neste dispositivo.", 401);
    }

    const matchResult = await supabase.from("matches").select("*").eq("id", matchId).single();

    if (matchResult.error || !matchResult.data) {
      return jsonError("Jogo nao encontrado.", 404);
    }

    const match = matchResult.data as MatchRecord;

    if (match.status !== "open") {
      return jsonError("Os palpites deste jogo ja foram encerrados.", 409);
    }

    const upsertResult = await supabase
      .from("predictions")
      .upsert(
        {
          participant_id: participantId,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString()
        },
        { onConflict: "participant_id,match_id" }
      )
      .select("*")
      .single();

    if (upsertResult.error) throw upsertResult.error;

    return NextResponse.json({ prediction: upsertResult.data as PredictionRecord });
  } catch (error) {
    return handleApiError(error);
  }
}
