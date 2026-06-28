import { weekdayDayMapsByWeek } from "@/lib/today";
import { TodayCard } from "./TodayCard";

// Stays a synchronous (statically-prerenderable) component — it ships every week's
// day map for both programs, and the client TodayCard picks the user's current week.
export function TodayCardMount() {
  const mapsByWeek = {
    beginner: weekdayDayMapsByWeek("beginner"),
    intermediate: weekdayDayMapsByWeek("intermediate"),
  };
  return <TodayCard mapsByWeek={mapsByWeek} />;
}
