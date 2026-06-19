import type { MetadataRoute } from "next";
import { exerciseLibrary, guidebook, PROGRAM_IDS, getProgramOrThrow } from "@/lib/data";

const BASE = "https://scorefit.net";
// Content provenance: prefer a deploy-stamped date (set BUILD_DATE / Vercel's
// VERCEL_GIT_COMMIT_* at build, or a content-revision date) so lastModified reflects
// real publishes, not a frozen literal. Falls back to a stable date if unset, and
// guards against an unparseable value so the sitemap never throws.
const provenance = process.env.BUILD_DATE || process.env.CONTENT_REVISION_DATE;
const parsed = provenance ? new Date(provenance) : null;
const LAST_MODIFIED = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date("2026-01-01");

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
