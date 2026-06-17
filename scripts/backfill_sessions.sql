-- One-time backfill of workout_sessions from historical completed workout_logs.
--
-- WHEN: run ONCE, after migration 0001_productive_vapor.sql is applied.
-- HOW:  psql "$DATABASE_URL" -f scripts/backfill_sessions.sql
-- SAFE: idempotent — ON CONFLICT DO NOTHING, so re-running won't duplicate or
--       overwrite sessions already created by live logging.
--
-- CAVEATS (these rows are flagged backfilled = true):
--   * session_date is approximated as the UTC date of the earliest completed set
--     for that program-day. The real local date is unknown for historical logs
--     (users.timezone didn't exist yet), so forward-collected sessions are
--     authoritative; backfilled ones are best-effort and must not award streaks.
--   * prescribed_sets is left 0 here; it's recomputed on the next live write to
--     that day, and the consistency layer derives the prescribed count from the
--     program data regardless, so 0 is a safe placeholder.
--   * ids use gen_random_uuid() (Postgres core, no pgcrypto needed), so these
--     historical rows are NOT time-sortable ULIDs — acceptable, as they predate
--     the ULID switch and are flagged backfilled. New rows get ULIDs via the app.

INSERT INTO workout_sessions (
  id, user_id, program, week, day_slug, session_date,
  distinct_exercises, completed_sets, prescribed_sets, tonnage, best_e1rm,
  qualifies, backfilled, first_at, last_at
)
SELECT
  gen_random_uuid(),
  user_id,
  program,
  week,
  day_slug,
  (min(updated_at) AT TIME ZONE 'UTC')::date            AS session_date,
  count(DISTINCT exercise_slug)                          AS distinct_exercises,
  count(*)                                               AS completed_sets,
  0                                                      AS prescribed_sets,
  coalesce(sum(weight * reps)
    FILTER (WHERE weight IS NOT NULL AND reps IS NOT NULL), 0) AS tonnage,
  max(weight * (1 + reps / 30.0))
    FILTER (WHERE weight > 0 AND reps > 0)               AS best_e1rm,  -- Epley, matches src/lib/strength.ts
  (count(*) >= 3 OR count(DISTINCT exercise_slug) >= 2)  AS qualifies,  -- honesty floor
  true                                                   AS backfilled,
  min(updated_at)                                        AS first_at,
  max(updated_at)                                        AS last_at
FROM workout_logs
WHERE completed = true
GROUP BY user_id, program, week, day_slug
ON CONFLICT (user_id, program, week, day_slug) DO NOTHING;
