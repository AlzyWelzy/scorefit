#!/usr/bin/env python3
"""Parse the Bodybuilding Transformation System markdown into structured JSON for the ScoreFit Next.js app."""
import re, json, os, hashlib

import sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "source.md"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data")
os.makedirs(OUT, exist_ok=True)

with open(SRC, encoding="utf-8") as f:
    lines = f.read().split("\n")

def slug(s):
    s = s.lower()
    s = re.sub(r"[°/]", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

# ---- locate part boundaries ----
idx = {i: l for i, l in enumerate(lines)}
def find(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    return -1

p1 = find(lambda l: l.startswith("# PART 1"))
p2 = find(lambda l: l.startswith("# PART 2"))
p3 = find(lambda l: l.startswith("# PART 3"))
appendix = find(lambda l: l.startswith("# APPENDIX"))

# ---- parse a program (range of lines) into weeks/days/exercises ----
def parse_exercise(block):
    """block: list of lines for one ### exercise"""
    name = block[0][4:].strip()
    ex = {"name": name, "slug": slug(name)}
    fields = "\n".join(block[1:])
    def grab(pattern):
        m = re.search(pattern, fields)
        return m.group(1).strip() if m else None
    ex["demo"] = grab(r"\*\*Demo video:\*\*\s*(\S+)")
    ex["workingSets"] = grab(r"\*\*Working sets:\*\*\s*([^|]+)")
    ex["reps"] = grab(r"\*\*Reps:\*\*\s*([^|]+)")
    ex["warmupSets"] = grab(r"\*\*Warm-up sets:\*\*\s*([^\n]+)")
    ex["earlyRPE"] = grab(r"\*\*Early-Set RPE:\*\*\s*([^|]+)")
    ex["lastRPE"] = grab(r"\*\*Last-Set RPE:\*\*\s*([^|]+)")
    ex["rest"] = grab(r"\*\*Rest:\*\*\s*([^\n]+)")
    ex["technique"] = grab(r"\*\*Last-set intensity technique:\*\*\s*([^\n]+)")
    ex["sub1"] = grab(r"\*\*Substitution 1:\*\*\s*([^|]+)")
    ex["sub2"] = grab(r"\*\*Substitution 2:\*\*\s*([^\n]+)")
    ex["notes"] = grab(r"\*\*Notes:\*\*\s*([^\n]+)")
    # clean trailing whitespace on each
    for k, v in ex.items():
        if isinstance(v, str):
            ex[k] = v.strip()
    return ex

def parse_program(start, end, program_id, program_name):
    seg = lines[start:end]
    # find intro block (before first WEEK)
    week_starts = [i for i, l in enumerate(seg) if l.startswith("# WEEK")]
    intro = "\n".join(seg[:week_starts[0]]).strip() if week_starts else ""
    weeks = []
    for wi, ws in enumerate(week_starts):
        we = week_starts[wi + 1] if wi + 1 < len(week_starts) else len(seg)
        wblock = seg[ws:we]
        m = re.match(r"# WEEK (\d+)\s*—\s*(.+)", wblock[0])
        wnum = int(m.group(1)); wblock_name = m.group(2).strip()
        # week subtitle (italic line) optional
        subtitle = None
        for l in wblock[1:6]:
            if l.startswith("*") and l.endswith("*") and len(l) > 2:
                subtitle = l.strip("*").strip(); break
        # days: lines starting with "## "
        day_idx = [i for i, l in enumerate(wblock) if l.startswith("## ")]
        days = []
        for di, ds in enumerate(day_idx):
            de = day_idx[di + 1] if di + 1 < len(day_idx) else len(wblock)
            dblock = wblock[ds:de]
            dtitle = dblock[0][3:].strip()
            # exercises: ### blocks
            ex_idx = [i for i, l in enumerate(dblock) if l.startswith("### ")]
            exercises = []
            for ei, es in enumerate(ex_idx):
                ee = ex_idx[ei + 1] if ei + 1 < len(ex_idx) else len(dblock)
                exercises.append(parse_exercise(dblock[es:ee]))
            days.append({"title": dtitle, "slug": slug(dtitle), "exercises": exercises})
        weeks.append({
            "number": wnum,
            "block": wblock_name,
            "subtitle": subtitle,
            "days": days,
        })
    return {"id": program_id, "name": program_name, "intro": intro, "weeks": weeks}

beginner = parse_program(p1, p2, "beginner", "Beginner Program")
intermediate = parse_program(p2, p3, "intermediate", "Intermediate / Advanced Program")

# ---- build a unique exercise library across both programs ----
library = {}
for prog in (beginner, intermediate):
    for w in prog["weeks"]:
        for d in w["days"]:
            for ex in d["exercises"]:
                s = ex["slug"]
                if s not in library:
                    library[s] = {
                        "name": ex["name"], "slug": s, "demo": ex.get("demo"),
                        "notes": ex.get("notes"), "sub1": ex.get("sub1"), "sub2": ex.get("sub2"),
                        "technique": ex.get("technique"),
                        "appearsIn": [],
                    }
                library[s]["appearsIn"].append({
                    "program": prog["id"], "week": w["number"],
                    "day": d["title"], "reps": ex.get("reps"),
                    "workingSets": ex.get("workingSets"), "lastRPE": ex.get("lastRPE"),
                })
library_list = sorted(library.values(), key=lambda x: x["name"])

# ---- guidebook: capture full text of part 3 (minus appendix) as sections ----
gb = lines[p3:appendix]
# split into ## sections, keep ### subsections inside as markdown
guide_sections = []
sec_idx = [i for i, l in enumerate(gb) if l.startswith("## ")]
intro_gb = "\n".join(gb[1:sec_idx[0]]).strip() if sec_idx else ""
for si, ss in enumerate(sec_idx):
    se = sec_idx[si + 1] if si + 1 < len(sec_idx) else len(gb)
    block = gb[ss:se]
    title = block[0][3:].strip()
    body = "\n".join(block[1:]).strip()
    guide_sections.append({"title": title, "slug": slug(title), "body": body})

guidebook = {"intro": intro_gb, "sections": guide_sections}

# ---- appendix (figures) ----
appendix_text = "\n".join(lines[appendix:]).strip()

# ---- write files ----
def write(name, obj, satisfies=None):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED from source markdown. Do not edit by hand.\n")
        # Program data is validated against its shared interface at definition time
        # (compile-time shape check); other files stay `as const`.
        if satisfies:
            f.write(f'import type {{ {satisfies} }} from "@/lib/programTypes";\n\n')
        tsname = name.replace(".ts", "")
        f.write(f"export const {tsname} = ")
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write(f" satisfies {satisfies};\n" if satisfies else " as const;\n")

write("beginner.ts", beginner, satisfies="Program")
write("intermediate.ts", intermediate, satisfies="Program")
write("exerciseLibrary.ts", library_list)
write("guidebook.ts", guidebook)
write("appendix.ts", {"text": appendix_text})

# stats
print("Beginner weeks:", len(beginner["weeks"]))
print("Intermediate weeks:", len(intermediate["weeks"]))
print("Unique exercises:", len(library_list))
print("Guidebook sections:", len(guide_sections))
tot = sum(len(d["exercises"]) for prog in (beginner, intermediate) for w in prog["weeks"] for d in w["days"])
print("Total exercise instances:", tot)
print("Sample exercise names:", [e["name"] for e in library_list[:8]])
