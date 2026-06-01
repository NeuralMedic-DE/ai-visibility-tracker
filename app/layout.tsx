import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = "https://www.neuralreach.de";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "NeuralReach: AI Search Visibility for B2B SaaS",
  description:
    "Track how your brand appears in ChatGPT, Claude, Perplexity, and Google AI Overviews. Weekly GEO/AEO reports + actionable schema fixes for B2B SaaS founders.",
  openGraph: {
    title: "NeuralReach: AI Search Visibility for B2B SaaS",
    description:
      "Know exactly how AI search engines describe your brand and your competitors.",
    url: BASE_URL,
    siteName: "NeuralReach",
    type: "website",
  },
};

// Site-wide Organization schema — renders on every page
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NeuralReach",
  url: BASE_URL,
  description:
    "AI search visibility tracker for B2B SaaS brands. Weekly reports showing how your brand appears in ChatGPT, Claude, Perplexity, and Google AI Overviews.",
  email: "hello@neuralreach.de",
  parentOrganization: {
    "@type": "Organization",
    name: "NeuralMedic",
  },
  sameAs: ["https://neuralreach.de"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
