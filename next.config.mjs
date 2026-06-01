/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enables instrumentation.ts — called once on server startup.
    // Used to initialize Sentry when SENTRY_DSN is configured.
    // Experimental in Next.js 14.2 but safe to enable; no-op when
    // instrumentation.ts is absent.
    instrumentationHook: true,
  },
};

export default nextConfig;
