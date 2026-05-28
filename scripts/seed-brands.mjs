/**
 * seed-brands.mjs
 * Populates the Supabase `brands` table from data/leaderboard_v1.json
 *
 * Usage:
 *   node scripts/seed-brands.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Run AFTER applying supabase/migrations/0001_init.sql
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Load env vars from .env.local ─────────────────────────────────────────────
const envPath = join(ROOT, ".env.local");
const envContents = readFileSync(envPath, "utf-8");
const envVars = Object.fromEntries(
  envContents
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Load leaderboard data ─────────────────────────────────────────────────────
const dataPath = join(ROOT, "data", "leaderboard_v1.json");
const { brands: rawBrands } = JSON.parse(readFileSync(dataPath, "utf-8"));

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const rows = rawBrands.map((b) => ({
  slug:        slugify(b.brand),
  name:        b.brand,
  website:     b.domain,
  category:    b.category,
  description: b.category_long,
  is_seed:     true,
}));

// ── Insert ────────────────────────────────────────────────────────────────────
console.log(`🌱 Seeding ${rows.length} brands into Supabase...`);

const { error } = await supabase
  .from("brands")
  .upsert(rows, { onConflict: "slug" });

if (error) {
  console.error("❌ Seed failed:", error.message);
  if (error.code === "42P01") {
    console.error("   Table 'brands' does not exist. Apply the schema first:");
    console.error("   → supabase/SETUP.md");
  }
  process.exit(1);
}

console.log(`✅ Done! ${rows.length} brands seeded to Supabase.`);
console.log(`   View at: https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/editor?table=brands`);
