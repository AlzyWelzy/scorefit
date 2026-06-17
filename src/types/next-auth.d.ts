import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      unit: "kg" | "lb";
      // IANA timezone for bucketing sessions/streaks into the user's local day.
      timezone: string;
      // Whether the user's email is verified. Named `verified` (not
      // `emailVerified`) to avoid colliding with the Date-typed adapter field.
      verified: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    unit?: "kg" | "lb";
    tz?: string;
    verified?: boolean;
  }
}
