import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { handleApiError, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PixStatus } from "@/lib/types";

const VALID_STATUSES: PixStatus[] = ["pending", "confirmed", "rejected"];

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
    const pixStatus = String(body.pixStatus || "") as PixStatus;

    if (!VALID_STATUSES.includes(pixStatus)) {
      return jsonError("Status de Pix inválido.");
    }

    const supabase = getSupabaseAdmin();
    const updateResult = await supabase
      .from("participants")
      .update({
        pix_status: pixStatus,
        confirmed_at: pixStatus === "confirmed" ? new Date().toISOString() : null
      })
      .eq("id", id)
      .select("id,name,email,pix_status,created_at,confirmed_at")
      .single();

    if (updateResult.error) throw updateResult.error;

    return NextResponse.json({ participant: updateResult.data });
  } catch (error) {
    return handleApiError(error);
  }
}
