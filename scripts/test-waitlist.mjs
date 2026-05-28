/**
 * test-waitlist.mjs
 * Tests the Supabase waitlist table directly and prints the exact error.
 * Run: node scripts/test-waitlist.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("Testing waitlist table...");
const { data, error } = await supabase
  .from("waitlist")
  .upsert(
    { email: "test@neuralreach.de", brand_interest: "TestBrand", signed_up_at: new Date().toISOString() },
    { onConflict: "email" }
  );

if (error) {
  console.log("❌ Error:", JSON.stringify(error, null, 2));
  console.log("   code:", error.code);
  console.log("   message:", error.message);
  console.log("   details:", error.details);
  console.log("   hint:", error.hint);
} else {
  console.log("✅ Success! Data:", data);
}
