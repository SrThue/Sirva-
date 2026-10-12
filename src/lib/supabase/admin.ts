import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Ignora RLS. Somente servidor; nunca importar em código de cliente. */
export function criarClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
