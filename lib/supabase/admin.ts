import { createClient } from "@supabase/supabase-js";

// Admin client — server only, uses service role key. Never expose to browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
