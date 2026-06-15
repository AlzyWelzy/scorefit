import type { MetadataRoute } from "next";
import { exerciseLibrary, guidebook } from "@/lib/data";

const BASE = "https://scorefit.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/programs", "/exercises", "/guidebook"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.8,
  }));

  const programPages: MetadataRoute.Sitemap = [];
  for (const program of ["beginner", "intermediate"]) {
    programPages.push({ url: `${BASE}/programs/${program}`, changeFrequency: "monthly", priority: 0.9 });
    for (let w = 1; w <= 12; w++) {
      programPages.push({ url: `${BASE}/programs/${program}/week/${w}`, changeFrequency: "monthly", priority: 0.6 });
    }
  }

  const exercisePages = exerciseLibrary.map((e) => ({
    url: `${BASE}/exercises/${e.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  const guidePages = guidebook.sections.map((s) => ({
    url: `${BASE}/guidebook/${s.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...programPages, ...exercisePages, ...guidePages];
}
