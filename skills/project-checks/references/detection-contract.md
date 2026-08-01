# Project Checks Detection Contract

## Output states

| Field/state | Meaning | Parent action |
|---|---|---|
| `makefile.status: missing` | No root Makefile name was found | A new file may be proposed only from observed commands |
| `supported` | Existing syntax is accepted by the same conservative policy as `/score` | Preserve existing targets and ordering |
| `unsupported` | Syntax, an imported Makefile, or a duplicate required target is ambiguous | Do not edit or claim score compatibility |
| `ambiguous` | Multiple distinct root Makefiles exist | Stop and ask which file owns the build contract |
| `evidence: observed` | A non-empty project-owned package script exists | Reopen the cited source before proposing it |
| `evidence: conventional` | Marker or dependency suggests a common command | Ask, do not apply or execute automatically |
| `unresolved` | Evidence cannot establish a safe gate | Preserve the gap explicitly |

`safeToPropose` is false when a target exists, Make syntax is unsupported, required targets are duplicated, package-manager evidence conflicts, an unsupported build system is present, or there is no observed command. It authorizes nothing; it only says the inspector found no deterministic blocker to preparing a human-reviewed diff.

## Fixed metadata surface

The inspector checks only these root names:

- Make: `GNUmakefile`, `Makefile`, `makefile`;
- JavaScript/TypeScript: `package.json` and known npm, pnpm, Yarn, or Bun locks;
- Python: `pyproject.toml`, `setup.py`;
- Go: `go.mod`;
- Ruby: `Gemfile`;
- Rust: `Cargo.toml`;
- unsupported build markers: Bazel, Buck2, Maven, and Gradle root markers.

Every metadata file must be a regular non-symlink file no larger than 1MB. The root itself must be a real directory. The inspector does not recurse, read CI, run a package manager, import project code, resolve dependencies, or write output files. This is trusted-project inspection, not containment against a concurrent local process that can rename the project root or its ancestors while inspection runs.

## Evidence limits

JavaScript package scripts named `check`, `lint`, `typecheck`, or `build` are observed check candidates only when a known lockfile or a versioned `packageManager` field establishes npm, pnpm, Yarn, or Bun. Missing, unsupported, or conflicting manager evidence is unresolved rather than defaulting to npm. Only exact `test:e2e` and `e2e` scripts are observed E2E candidates. `test` and `test:integration` are not relabelled as E2E.

An existing Makefile that imports another file is frozen for onboarding. `/score` keeps its historical literal parser behavior, but `project-checks` cannot prove that an imported file does not already define a required target.

Python, Go, Ruby, and Rust markers produce conventional check candidates only. They cannot become Make recipes until the parent verifies project intent and the user approves the exact diff.

A missing E2E candidate is expected for many projects. Do not convert absence into a passing or failing placeholder.
