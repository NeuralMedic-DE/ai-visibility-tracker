import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NeuralReach — AI Search Visibility for B2B SaaS",
  description:
    "Track how your brand appears in ChatGPT, Claude, Perplexity, and Google AI Overviews. Weekly reports + actionable fixes for B2B SaaS founders.",
  openGraph: {
    title: "NeuralReach — AI Search Visibility for B2B SaaS",
    description:
      "Know exactly how AI search engines describe your brand — and your competitors.",
    url: "https://neuralreach.de",
    siteName: "NeuralReach",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
