import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

const BASE_URL = "https://www.neuralreach.de";

// Derive run_date from leaderboard.json for accurate lastModified dates
function getRunDate(): Date {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "leaderboard.json"),
      "utf-8"
    );
    const data = JSON.parse(raw) as { run_date: string };
    return new Date(data.run_date + "T00:00:00Z");
  } catch {
    return new Date("2026-05-30T00:00:00Z");
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const runDate = getRunDate();

  const brandsDir = path.join(process.cwd(), "data", "brands");
  const slugs = fs
    .readdirSync(brandsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: runDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: runDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: runDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/methodology`,
      lastModified: runDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const brandPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE_URL}/leaderboard/${slug}`,
    lastModified: runDate,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...brandPages];
}
