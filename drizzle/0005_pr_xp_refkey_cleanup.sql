-- Data migration (no schema change): drop orphaned PR-bonus XP rows left by the old
-- refKey scheme. PR XP used to be keyed `pr:<exerciseSlug>` (one row per exercise);
-- enforcing the 7-day cooldown re-keyed it per occurrence as `pr:<exerciseSlug>:<date>`.
-- The old rows are never upserted again, so without this they'd linger as stale XP that
-- can't reverse. New rows always carry a trailing `:YYYY-MM-DD`, so we delete only the
-- `pr` rows that lack that date suffix. Idempotent; safe on an empty/fresh table.
DELETE FROM "xp_events"
WHERE "source" = 'pr'
  AND "ref_key" !~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$';
