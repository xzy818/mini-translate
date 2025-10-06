#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Split bmad-method/AGENTS.md into 3 parts on '### ' section boundaries.
Guarantees:
- Never split a level-3 section (### ...) across files
- Preserve order and content
- Ensure each output ends with a newline and has balanced code fences

Outputs:
- bmad-agents-split/AGENTS.part1.md
- bmad-agents-split/AGENTS.part2.md
- bmad-agents-split/AGENTS.part3.md
"""

from __future__ import annotations

import os

SRC = "bmad-method/AGENTS.md"
OUT_DIR = "bmad-agents-split"


def read_lines(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        return f.read().splitlines()


def write_text(path: str, text: str) -> None:
    if not text.endswith("\n"):
        text += "\n"
    # Balance code fences if odd number of ``` present
    if text.count("```") % 2 != 0:
        text += "```\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main() -> None:
    if not os.path.exists(SRC):
        raise SystemExit(f"Source not found: {SRC}")
    os.makedirs(OUT_DIR, exist_ok=True)

    lines = read_lines(SRC)

    # Find level-3 headings as safe split boundaries
    heads = [i for i, l in enumerate(lines) if l.startswith("### ")]

    # Build blocks of complete sections; keep preface (before first ###) as block 0 if present
    blocks: list[str] = []
    if heads:
        if heads[0] > 0:
            blocks.append("\n".join(lines[: heads[0]]))
        for idx, start in enumerate(heads):
            end = heads[idx + 1] if idx + 1 < len(heads) else len(lines)
            blocks.append("\n".join(lines[start:end]))
    else:
        blocks.append("\n".join(lines))

    # Sizes in bytes to balance approximately
    sizes = [len(b.encode("utf-8")) for b in blocks]
    total = sum(sizes)
    target = (total + 2) // 3

    parts: list[list[str]] = [[], [], []]
    part_sizes = [0, 0, 0]
    p = 0
    for b, sz in zip(blocks, sizes):
        remaining_parts = 3 - p - 1
        # Move to next part if current would overflow and there are remaining parts
        if part_sizes[p] + sz > target and remaining_parts > 0 and parts[p]:
            p += 1
        parts[p].append(b)
        part_sizes[p] += sz

    for i in range(3):
        out = "\n".join(parts[i])
        write_text(os.path.join(OUT_DIR, f"AGENTS.part{i+1}.md"), out)

    print({"total": total, "part_sizes": part_sizes})


if __name__ == "__main__":
    main()

