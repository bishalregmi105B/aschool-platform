"""One-off repair script for the initial migration's create order.

Reorders op.create_table blocks topologically by FK dependencies and breaks
dependency cycles by deferring the FK to a create_foreign_key call at the
end of upgrade(). Rebuilds downgrade() as the exact reverse. Run once; the
output replaces c1f55f2f9905_initial.py in place (backup kept as .bak).
"""
import re
import shutil

PATH = "migrations/versions/c1f55f2f9905_initial.py"

shutil.copy(PATH, PATH + ".bak")
src = open(PATH).read()
lines = src.split("\n")

up_start = next(i for i, l in enumerate(lines) if l.startswith("def upgrade"))
down_start = next(i for i, l in enumerate(lines) if l.startswith("def downgrade"))

# ── locate create_table starts ────────────────────────────────────────────
creates = []
for i in range(up_start + 1, down_start):
    m = re.match(r"\s*op\.create_table\('([^']+)'", lines[i])
    if m:
        creates.append((i, m.group(1)))

def block_close(start):
    """Line index of the '    )' that closes the op.create_table call."""
    i = start
    while lines[i] != "    )":
        i += 1
    return i

# ── segment upgrade() body ────────────────────────────────────────────────
header = lines[up_start + 1 : creates[0][0]]
blocks = {}  # name -> [lines of its create_table call ONLY]
absorbed = set()
covered = set()
for idx, (start, name) in enumerate(creates):
    end = block_close(start)
    blocks[name] = lines[start : end + 1]
    covered.update(range(start, end + 1))
    # absorb the index (and deferred-FK) lines that follow the block
    nxt = creates[idx + 1][0] if idx + 1 < len(creates) else down_start
    i = end + 1
    while i < nxt and re.match(
        r"\s*op\.(create_index|create_foreign_key)", lines[i]
    ):
        blocks[name].append(lines[i])
        absorbed.add(i)
        i += 1

trailing = [
    (i, lines[i])
    for i in range(up_start + 1, down_start)
    if i not in covered and i not in absorbed
]

# ── FK dependency graph ───────────────────────────────────────────────────
fk_re = re.compile(r"sa\.ForeignKeyConstraint\(\s*\[[^\]]+\]\s*,\s*\['([^.\s']+)[.\s']")
dep = {}
for name in order if (order := list(blocks)) else []:
    text = "\n".join(blocks[name])
    deps = set()
    for m in fk_re.finditer(text):
        tgt = m.group(1)
        if tgt in blocks and tgt != name:
            deps.add(tgt)
    dep[name] = deps

# ── toposort with cycle breaking ──────────────────────────────────────────
placed = set()
deferred = []  # (table, target) — FK deferred to end of upgrade()
sorted_order = []
remaining = list(blocks)
while remaining:
    ready = [n for n in remaining if dep[n] <= placed]
    if not ready:
        victim = remaining[0]
        inside = dep[victim] - placed
        tgt = sorted(inside)[0]
        deferred.append((victim, tgt))
        dep[victim] = dep[victim] - {tgt}
        continue
    for n in ready:
        sorted_order.append(n)
        placed.add(n)
    remaining = [n for n in remaining if n not in placed]

print("order ok:", len(sorted_order) == len(blocks), "| deferred:", deferred)

# ── rewrite upgrade() ─────────────────────────────────────────────────────
out = []
out.extend(header)
for name in sorted_order:
    block = blocks[name]
    if name in {v for v, _ in deferred}:
        stripped = []
        for tgt in [t for v, t in deferred if v == name]:
            pat = re.compile(
                r"    sa\.ForeignKeyConstraint\(\s*\['[^\]]+'\]\s*,\s*\['"
                + tgt + r"\.[^\s']+'\][^\n]*\n"
            )
            block = pat.sub("", "\n".join(block)).split("\n")
        out.extend(block)
    else:
        out.extend(block)
out.append("")
out.append("    # ── Deferred FKs: cycles broken for create-order ──")
for victim, tgt in deferred:
    text = "\n".join(blocks[victim])
    m = re.search(
        r"sa\.ForeignKeyConstraint\(\s*\['([^\]]+)'\]\s*,\s*\['"
        + tgt + r"\.([^\s']+)'\]", text,
    )
    col, tcol = m.group(1), m.group(2)
    fk_name = f"fk_{victim}_{col.replace(', ', '_')}_{tgt}"
    out.append(
        f"    op.create_foreign_key({fk_name!r}, {victim!r}, {tgt!r}, [{col!r}], [{tcol!r}])"
    )
for _, l in trailing:
    out.append(l)
out.append("")

# ── rewrite downgrade() as exact reverse ──────────────────────────────────
down = ["    # ### rebuilt: exact reverse of upgrade() ###"]
for victim, tgt in deferred:
    text = "\n".join(blocks[victim])
    m = re.search(
        r"sa\.ForeignKeyConstraint\(\s*\['([^\]]+)'\]\s*,\s*\['"
        + tgt + r"\.([^\s']+)'\]", text,
    )
    col = m.group(1)
    fk_name = f"fk_{victim}_{col.replace(', ', '_')}_{tgt}"
    down.append(
        f"    op.drop_constraint({fk_name!r}, {victim!r}, type_='foreignkey')"
    )
for name in reversed(sorted_order):
    down.append(f"    op.drop_table({name!r})")
down.append("")

new_body = (
    lines[:up_start] + ["def upgrade() -> None:"] + out
    + ["", "def downgrade() -> None:"] + down
)
open(PATH, "w").write("\n".join(new_body) + "\n")
print("written", PATH)
