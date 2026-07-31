---
name: pi-forge-handbook
description: Source-grounded maintainer map for locating Pi Forge Expert Panel and protected-agent policy implementation sites. Use only when changing or auditing those workflows inside the trusted Pi Forge repository, not for ordinary package use or unrelated projects.
---

# Pi Forge Behavior Map

This project-only skill is a two-workflow localization pilot. It is a location index, not source authority and not a claim of whole-harness coverage.

## Entry gate

1. Run `npm run check:behavior-map` from the Pi Forge repository. Stop if structure fails.
2. Run `npm run check:behavior-map:freshness`. A stale result is an advisory review signal, not proof that prose is wrong.
3. Read [the direct index](references/index.md). Open [the overview](references/overview.md) only when whole-system orientation is necessary.
4. Read only the behavior cards and register entries named by the index for the requested change.

If freshness reports a behavior as stale, freeze that card for localization. Search and read the repository directly, verify every implementation site, and report the stale map rather than relying on its prose. Never refresh fingerprints automatically.

## Source verification

For every locator surfaced by a card:

- open the current file and verify the named declaration, heading, skill, JSON value, or artifact;
- follow only decision-relevant imports, generators, consumers, and tests;
- treat generated provenance as navigation to the canonical inputs, not authorization to edit generated outputs directly;
- use current source citations in plans and reviews;
- record map misses, incidental matches, and stale false positives.

The checker proves structural consistency and lexical pilot coverage only. It cannot prove semantic completeness or prose correctness.

## Maintenance boundary

After a source change, update a behavior card only when current evidence changes its navigation or contract. A maintainer may run `npm run refresh:behavior-map` only after reviewing the affected cards and structural output. The refresh records file state; it does not attest semantic correctness.

Do not promote this map into public package skills, mandatory planning, model-generated prose, or automatic resynchronization without a separately approved plan backed by at least three real planning uses.
