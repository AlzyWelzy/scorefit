# Data generation — `parse_data.py`

`parse_data.py` parses the original **Bodybuilding Transformation System** markdown
(`source.md`) into the structured TypeScript data the app reads from `src/data/`:

| Output (`src/data/`) | Built from (in `source.md`) |
| --- | --- |
| `beginner.ts` | `# PART 1 …` |
| `intermediate.ts` | `# PART 2 …` |
| `exerciseLibrary.ts` | unique exercises across PART 1 + PART 2 |
| `guidebook.ts` | `# PART 3 …` (each `## ` heading → one section) |
| `appendix.ts` | `# APPENDIX …` |

Run (manual only — not wired into `package.json` or CI):

```bash
python3 scripts/parse_data.py path/to/source.md
```

## ⚠️ `source.md` is not in the repo

The original `source.md` was never committed. As a result the generated files —
**especially `src/data/guidebook.ts`** — are now maintained **by hand** and are the
source of truth. Their headers have been updated to reflect this.

### Hand-added guidebook sections (not reproducible by the generator)

These three sections were authored directly in `src/data/guidebook.ts` and have **no
counterpart in any `source.md`**:

1. **Warming Up Properly** — `warming-up-properly` (after “Understanding the Program”)
2. **Sleep & Recovery** — `sleep-and-recovery` (after “Bodybuilding Supplements”)
3. **Glossary — Key Terms** — `glossary-key-terms` (before “References”)

Plus inline cross-links added into existing sections (RPE → principles, warm-up
sets → warming-up, deload → sleep-and-recovery, principles intro → glossary).

### If `source.md` is ever recovered

Running the generator will **overwrite `guidebook.ts` and drop the three sections
above**. To regenerate safely:

1. Add the three sections to PART 3 of `source.md` as `## ` headings (the generator
   slugs the title the same way `slug()` does, so the slugs above will be reproduced).
2. Re-add the inline cross-links in the relevant sections.
3. Then run the generator and diff against the committed `guidebook.ts` to confirm
   nothing else changed.

Keep the guidebook `sections` array an **even count** so the two-column index grid
at `/guidebook` stays visually balanced (no orphan card in the last row).
