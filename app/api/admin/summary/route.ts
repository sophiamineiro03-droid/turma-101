import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { handleApiError, jsonError } from "@/lib/api";
import { buildLeaderboard, buildPrizeWinners } from "@/lib/scoring";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MatchRecord, ParticipantRecord, PredictionRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  if (!verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return jsonError("Acesso administrativo necessario.", 401);
  }

  try {
    const supabase = getSupabaseAdmin();
    const [matchesResult, participantsResult, predictionsResult] = await Promise.all([
      supabase.from("matches").select("*").order("id"),
      supabase
        .from("participants")
        .select("id,name,email,pix_status,created_at,confirmed_at")
        .order("created_at", { ascending: true }),
      supabase.from("predictions").select("*")
    ]);

    if (matchesResult.error) throw matchesResult.error;
    if (participantsResult.error) throw participantsResult.error;
    if (predictionsResult.error) throw predictionsResult.error;

    const matches = (matchesResult.data || []) as MatchRecord[];
    const participants = (participantsResult.data || []) as ParticipantRecord[];
    const predictions = (predictionsResult.data || []) as PredictionRecord[];

    return NextResponse.json({
      matches,
      participants,
      predictions,
      leaderboard: buildLeaderboard(participants, predictions, matches),
      prizeWinners: buildPrizeWinners(participants, predictions, matches),
      stats: {
        participants: participants.length,
        confirmed: participants.filter((participant) => participant.pix_status === "confirmed")
          .length,
        pending: participants.filter((participant) => participant.pix_status === "pending").length,
        predictions: predictions.length
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
