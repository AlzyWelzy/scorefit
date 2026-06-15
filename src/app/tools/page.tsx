import type { Metadata } from "next";
import { PlateCalculator } from "@/components/PlateCalculator";
import { RestTimer } from "@/components/RestTimer";
import { TodayCardMount } from "@/components/TodayCardMount";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Training tools",
  description: "Plate calculator, rest timer, and today's session — quick tools for the gym floor.",
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <Reveal>
        <span className="eyebrow">Gym floor</span>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Training tools</h1>
        <p className="mt-3 max-w-xl text-muted">
          Quick utilities for while you train — load a bar, time your rest, jump into today&apos;s session.
        </p>
      </Reveal>

      <div className="mt-8 space-y-5">
        <Reveal>
          <TodayCardMount />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal>
            <PlateCalculator />
          </Reveal>
          <Reveal delay={0.05}>
            <RestTimer />
          </Reveal>
        </div>
      </div>
    </div>
  );
}
