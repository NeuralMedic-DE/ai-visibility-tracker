"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Client-side sign-out button.
 * Calls supabase.auth.signOut(), then pushes to /login and forces a
 * hard refresh so the server renders the logged-out state.
 */
export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
    >
      Sign out
    </button>
  );
}
