import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * /auth/callback
 *
 * Supabase sends users here after they click a magic link.
 * We exchange the one-time `code` for a real session, set the session
 * cookies, and redirect the user to their intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default to /dashboard; ?next= can override (sent by middleware redirect)
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            cookiesToSet: Array<{
              name: string;
              value: string;
              options: CookieOptions;
            }>
          ) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignored — we're in a Route Handler which can set cookies,
              // but the try-catch keeps parity with the server.ts helper.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Validate that `next` is a relative path to prevent open-redirect
      const destination = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  // Code missing or exchange failed — back to login with error flag
  return NextResponse.redirect(
    new URL("/login?error=auth_error", origin)
  );
}
