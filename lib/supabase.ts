import { createClient } from "@supabase/supabase-js";

class MissingSupabaseConfigError extends Error {
  constructor() {
    super("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
    this.name = "MissingSupabaseConfigError";
  }
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new MissingSupabaseConfigError();
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function isMissingSupabaseConfigError(error: unknown) {
  return error instanceof MissingSupabaseConfigError;
}
