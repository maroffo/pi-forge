# Pi Forge Behavior Map Overview

Pi Forge combines declarative skills, prompts, agents, and chains with TypeScript extensions, JavaScript configuration and generators, package probes, and tests. One runtime behavior can therefore span files that no language call graph connects.

This pilot maps two representative flows:

1. Expert Panel preparation, disclosure, preflight, fan-out, acknowledgement, and synthesis.
2. Protected-agent discovery, capability validation, run attestation, and resume rejection or approval.

The map has three navigation layers:

- `index.md` routes directly from behavior to its card and related registers;
- `behaviors/*.md` describes boundaries, transitions, exceptional paths, canonical inputs, generated outputs, tests, and typed locators;
- `registers.md` traces values and invariants shared across files or stages.

The repository always remains authoritative. Structural validation catches broken addresses and incomplete lexical classification. Whole-file fingerprints only signal that a mapped canonical file changed after the last explicit review. Unmapped workflows remain visible in the index and are localized directly from source.
