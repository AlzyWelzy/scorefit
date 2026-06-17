import { monotonicFactory, ulidToUUID, uuidToULID } from "ulidx";

// ScoreFit primary keys are ULIDs (time-ordered, lexicographically sortable),
// but stored in native Postgres `uuid` columns — a ULID is 128 bits, so it
// renders losslessly into the 36-char UUID string. We get insertion locality and
// creation-time ordering on the index while keeping uuid's 16-byte storage and
// native indexing. The 26-char Crockford ULID form is available via toUlid() for
// any place a compact, human-facing id is wanted (URLs, logs).
//
// monotonicFactory() guarantees that ids minted within the same millisecond still
// sort by creation order (it increments the random component instead of reseeding).
const ulid = monotonicFactory();

/**
 * Generate a new primary-key id: a fresh ULID rendered as a canonical UUID string,
 * suitable as the value for a Drizzle `uuid(...)` column. Used as the `$defaultFn`
 * for every table's `id`, so all inserts through Drizzle get a sortable key.
 */
export function newId(): string {
  return ulidToUUID(ulid());
}

/** Render a stored uuid id as its 26-char Crockford ULID form (display / URLs). */
export function toUlid(id: string): string {
  return uuidToULID(id);
}

/** Inverse of toUlid: parse a 26-char ULID back into the stored uuid form. */
export function fromUlid(id: string): string {
  return ulidToUUID(id);
}
