// Centralized href builders so cross-links stay consistent across the app.
import type { ProgramId } from "@/lib/data";

export const programHref = (program: ProgramId | string) => `/programs/${program}`;

export const weekHref = (program: ProgramId | string, week: number) =>
  `/programs/${program}/week/${week}`;

/** Deep-link to a specific training day within a week (day.slug is the section anchor). */
export const dayHref = (program: ProgramId | string, week: number, daySlug: string) =>
  `${weekHref(program, week)}#${daySlug}`;

export const exerciseHref = (slug: string) => `/exercises/${slug}`;

export const guideHref = (slug: string) => `/guidebook/${slug}`;
