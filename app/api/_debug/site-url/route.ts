/**
 * TEMPORARY DEBUG ROUTE — DELETE BEFORE SHIPPING TO PRODUCTION
 *
 * Usage: curl https://neuralreach.de/api/_debug/site-url
 *
 * Returns the env vars that control the Stripe checkout redirect URLs so the
 * founder can confirm NEXT_PUBLIC_SITE_URL is set correctly in Vercel.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  return NextResponse.json({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "(not set)",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
    NODE_ENV: process.env.NODE_ENV ?? "(not set)",
    request_origin: origin ?? "(no origin header)",
    request_host: host ?? "(no host header)",
    resolvedAppUrl:
      (origin && !origin.includes("localhost") ? origin : null) ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
        ? null
        : process.env.NEXT_PUBLIC_APP_URL) ??
      "https://neuralreach.de",
  });
}
