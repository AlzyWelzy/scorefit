import { weekdayDayMap } from "@/lib/today";
import { TodayCard } from "./TodayCard";

export function TodayCardMount() {
  const maps = {
    beginner: weekdayDayMap("beginner"),
    intermediate: weekdayDayMap("intermediate"),
  };
  return <TodayCard maps={maps} />;
}
