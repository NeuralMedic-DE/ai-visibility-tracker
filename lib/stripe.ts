import Stripe from "stripe";

// Server-side Stripe instance — never import this in browser code
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export const PLANS = {
  starter: {
    name: "Starter",
    price: 39,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    features: [
      "25 AI prompts per week",
      "4 LLMs tracked (ChatGPT, Claude, Perplexity, Google AIO)",
      "1 brand monitored",
      "Weekly email report",
      "30-day history",
    ],
  },
  pro: {
    name: "Pro",
    price: 89,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    features: [
      "100 AI prompts per week",
      "4 LLMs tracked",
      "Up to 4 brands (yours + 3 competitors)",
      "Weekly + on-demand reports",
      "Full history + trend charts",
      "Schema & content fix recommendations",
      "Priority support",
    ],
  },
} as const;
