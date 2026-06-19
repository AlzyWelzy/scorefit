import type { MetadataRoute } from "next";
import { exerciseLibrary, guidebook, PROGRAM_IDS, getProgramOrThrow } from "@/lib/data";

const BASE = "https://scorefit.net";
// A single stable date so the sitemap doesn't churn on every build.
const LAST_MODIFIED = new Date("2026-01-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/programs", "/exercises", "/guidebook", "/tools"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.8,
  }));

  const programPages: MetadataRoute.Sitemap = [];
  for (const program of PROGRAM_IDS) {
    programPages.push({
      url: `${BASE}/programs/${program}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.9,
    });
    for (const week of getProgramOrThrow(program).weeks) {
      programPages.push({
        url: `${BASE}/programs/${program}/week/${week.number}`,
        lastModified: LAST_MODIFIED,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  const exercisePages = exerciseLibrary.map((e) => ({
    url: `${BASE}/exercises/${e.slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  const guidePages = guidebook.sections.map((s) => ({
    url: `${BASE}/guidebook/${s.slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...programPages, ...exercisePages, ...guidePages];
}
