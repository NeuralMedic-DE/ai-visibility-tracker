/**
 * lib/customer.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Server-only helper: resolves a Supabase auth user to a customers row.
 *
 * Strategy:
 *   1. Fast path  — look up by user_id (set at checkout for all new signups)
 *   2. Lazy-link  — for legacy rows that pre-date register-first flow:
 *                   find by lowercased email, write user_id, return the row
 *   3. Not found  — return null (user has no subscription yet)
 *
 * All reads/writes use the admin client (service_role) so this never
 * touches RLS; it is safe to call from any server context (Server Component
 * or API Route Handler).
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ── Shared type ───────────────────────────────────────────────────────────────

export type CustomerRow = {
  id: string;
  email: string;
  user_id: string | null;
  plan: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  welcome_email_id: string | null;
  created_at: string;
  updated_at: string;
};

const ALL_FIELDS =
  "id, email, user_id, plan, subscription_status, trial_ends_at, current_period_end, welcome_email_id, created_at, updated_at";

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Resolve a Supabase auth user to their customers row.
 *
 * @param userId  auth.users.id — immutable UUID from supabase.auth.getUser()
 * @param email   user's email — used as fallback for legacy rows
 * @param fields  optional Supabase select string (defaults to all columns)
 * @returns       CustomerRow or null
 */
export async function getCustomerByUser(
  userId: string,
  email: string,
  fields: string = ALL_FIELDS
): Promise<CustomerRow | null> {
  const admin = createAdminClient();

  // ── 1. Fast path: look up by immutable user_id ─────────────────────────────
  const { data: byUserId, error: uidErr } = await admin
    .from("customers")
    .select(fields)
    .eq("user_id", userId)
    .maybeSingle();

  if (uidErr) {
    console.error("[customer] user_id lookup error:", uidErr.message);
  }
  if (byUserId) return byUserId as unknown as CustomerRow;

  // ── 2. Fallback: look up by lowercased email (legacy rows) ─────────────────
  const { data: byEmail, error: emailErr } = await admin
    .from("customers")
    .select(fields)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (emailErr) {
    console.error("[customer] email lookup error:", emailErr.message);
  }
  if (!byEmail) return null;

  // ── 3. Lazy-link: bind user_id to the legacy row (runs once per customer) ──
  if (!(byEmail as unknown as CustomerRow).user_id) {
    const { error: bindErr } = await admin
      .from("customers")
      .update({ user_id: userId })
      .eq("id", (byEmail as unknown as CustomerRow).id);

    if (bindErr) {
      // Non-fatal: row is still returned, user_id link will retry next request
      console.warn(
        "[customer] Could not lazy-link user_id to legacy row:",
        bindErr.message
      );
    } else {
      console.info(
        `[customer] Lazy-linked user_id ${userId} to customer ${(byEmail as unknown as CustomerRow).id}`
      );
    }
  }

  return byEmail as unknown as CustomerRow;
}
