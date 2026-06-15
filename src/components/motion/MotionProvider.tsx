"use client";
import { MotionConfig } from "motion/react";

// Auto-disables transform/layout animations for prefers-reduced-motion users.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
