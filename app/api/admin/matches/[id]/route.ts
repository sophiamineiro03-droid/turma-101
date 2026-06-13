import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { handleApiError, isValidScore, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MatchStatus } from "@/lib/types";

const VALID_STATUSES: MatchStatus[] = ["open", "locked", "finished"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return jsonError("Acesso administrativo necessário.", 401);
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = String(body.status || "") as MatchStatus;
    const actualHomeScore =
      body.actualHomeScore === "" || body.actualHomeScore === null
        ? null
        : Number(body.actualHomeScore);
    const actualAwayScore =
      body.actualAwayScore === "" || body.actualAwayScore === null
        ? null
        : Number(body.actualAwayScore);

    if (!VALID_STATUSES.includes(status)) {
      return jsonError("Status do jogo inválido.");
    }

    if (status === "finished" && (!isValidScore(actualHomeScore) || !isValidScore(actualAwayScore))) {
      return jsonError("Para finalizar o jogo, informe o placar final de 0 a 20.");
    }

    const updatePayload =
      status === "finished"
        ? {
            status,
            actual_home_score: actualHomeScore,
            actual_away_score: actualAwayScore
          }
        : {
            status,
            actual_home_score: null,
            actual_away_score: null
          };

    const supabase = getSupabaseAdmin();
    const updateResult = await supabase
      .from("matches")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (updateResult.error) throw updateResult.error;

    return NextResponse.json({ match: updateResult.data });
  } catch (error) {
    return handleApiError(error);
  }
}
