import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // We need to mutate supabaseResponse so cookie setters can attach to the
  // correct response. IMPORTANT: always return supabaseResponse, not a new
  // NextResponse, so cookies are forwarded correctly.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>
        ) {
          // Attach updated cookies to both the request and the response so
          // downstream server components see the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session token on every request. Use getUser() (not
  // getSession()) so stale cookie data is never trusted.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard /dashboard/** and /onboarding — redirect unauthenticated visitors to /login
  const protectedPath =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  if (!user && protectedPath) {
    const url = request.nextUrl.clone();
    const fullPath =
      request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(fullPath)}`;
    return NextResponse.redirect(url);
  }

  // Allow: /login, /, /pricing, /leaderboard, /api/*, /auth/*
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
