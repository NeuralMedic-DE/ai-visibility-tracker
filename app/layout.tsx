import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = "https://www.neuralreach.de";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "NeuralReach: AI Search Visibility for B2B SaaS",
    template: "%s | NeuralReach",
  },
  description:
    "Track how your brand appears in ChatGPT, Claude, Perplexity, and Google AI Overviews. Weekly GEO/AEO reports + actionable schema fixes for B2B SaaS founders.",
  applicationName: "NeuralReach",
  authors: [{ name: "Jonas Heinzmann", url: "https://neuralreach.de" }],
  creator: "NeuralMedic",
  publisher: "NeuralMedic",
  keywords: [
    "AI search visibility",
    "AI visibility tracker",
    "GEO",
    "generative engine optimization",
    "AEO",
    "answer engine optimization",
    "ChatGPT visibility",
    "Claude visibility",
    "Perplexity visibility",
    "Google AI Overviews",
    "Google AIO",
    "B2B SaaS marketing",
    "brand monitoring",
    "LLM brand tracking",
    "AI search ranking",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NeuralReach: AI Search Visibility for B2B SaaS",
    description:
      "Know exactly how ChatGPT, Claude, Perplexity, and Google AI Overviews describe your brand and your competitors.",
    url: BASE_URL,
    siteName: "NeuralReach",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuralReach: AI Search Visibility for B2B SaaS",
    description:
      "Know exactly how ChatGPT, Claude, Perplexity, and Google AI Overviews describe your brand.",
    creator: "@neuralreach",
    site: "@neuralreach",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

// Drives <meta name="theme-color"> + <meta name="viewport"> (Next.js 14+ split
// these out of the metadata object).
export const viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
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
