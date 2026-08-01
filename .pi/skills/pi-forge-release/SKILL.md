---
name: pi-forge-release
description: Maintainer-only Pi Forge npm release preflight, tagging, publication, verification, reconciliation, and recovery. Use only inside the trusted Pi Forge source repository when preparing or inspecting an exact stable release. Never treats preflight as authorization for Git or registry mutation.
---

# Pi Forge Release

Release one stable `MAJOR.MINOR.PATCH` version through explicit, observable phases. The helper runs fixed Pi Forge verification commands and read-only Git, GitHub, and npm queries. It never creates or pushes tags, publishes, changes dist-tags, deprecates, unpublishes, commits, or edits version files.

## Boundaries

- Treat `prepare`, local tag creation, tag push, and npm publication as separate actions.
- Obtain explicit authorization for local tag creation, tag push, and `npm publish` independently.
- Never use `git add -A`, commit directly on `main`, recreate or force-push a tag, retry an uncertain network mutation, or automate unpublish.
- `.pi/extensions/pi-forge-release-guard.ts` confirms ordinary Bash-tool tag creation and npm publication. It is defense in depth, not evidence that preflight passed and not a shell security boundary.
- Fixed project verification and local pack commands run only after read-only Git, tag, registry, and exact-HEAD CI prerequisites pass. They receive a temporary HOME and no inherited release/provider credentials. The helper then re-reads every release invariant and fails if project code changed state.
- The guard does not cover aliases, custom tools, the user's `!` shell, external terminals, or deliberately obfuscated commands.

## Preflight command

Run from the trusted Pi Forge repository:

```bash
node scripts/check-release.mjs --phase <phase> --version <MAJOR.MINOR.PATCH>
```

Exit 0 is `pass`, exit 1 is `fail`, and exit 2 is `indeterminate`. Only `pass` can advance a phase. Missing tools, credentials, network evidence, exact-head CI, malformed output, timeout, or signals never become a pass. A static failure stops before project scripts execute; after scripts run, the helper recollects Git, tag, registry, and CI state before returning its verdict.

## 1. Prepare

1. Choose a stable version from the actual compatibility change.
2. Update `package.json`, both package-lock version fields, and the README install command through normal reviewed edits. Do not create a Git tag.
3. Run `prepare`. It requires all four version surfaces to match and the version to be absent from npm.
4. Run normal implementation verification and review. Commit, merge, and push only through their separately authorized workflows.

The helper expects release preparation edits to exist already. It does not make them.

## 2. Tag

Run `tag` only from clean synchronized `main`. It requires:

- exact `HEAD == origin/main`;
- both `CI` and `pi-subagents upgrade compatibility` completed successfully for exact HEAD;
- fresh E2E, pinned `pi-subagents` upgrade, and audit checks in this preflight;
- absent local and remote `v<version>` tags;
- registry version still absent.

After a pass, ask for explicit authorization to create one annotated local tag. Reconcile before any retry if tag creation returns an uncertain result. Then ask separately before pushing that exact tag.

## 3. Publish

Run `publish` after the annotated local and remote tags both dereference to exact HEAD. It reruns exact-head CI, E2E, upgrade, audit, registry absence, and local dry-run pack identity, integrity, roster, and `.pi/` exclusion.

After a pass, disclose the exact command and ask for publication authorization. Run one ordinary `npm publish --access public --tag latest` attempt. If output is interrupted, times out, or is ambiguous, do not retry. Run `reconcile` first.

## 4. Verify

Run `verify` after publication. It requires:

- registry version present;
- npm `latest` equal to the version;
- annotated local and remote tags dereferencing to exact HEAD;
- registry tarball identity, integrity, required roster, and no project-only `.pi/` resources;
- isolated runtime discovery through the fixed runtime verification command.

A failed verification is a release incident, not permission to recreate a tag or republish the same immutable version.

## 5. Reconcile and recover

Run `reconcile` after any uncertain tag push or publication result. It classifies consistent, local-only tag, remote-only tag, registry-only publication, dist-tag drift, unavailable, and other inconsistent states without changing them.

Read [recovery](references/recovery.md) before proposing a corrective action. Every dist-tag change, deprecation, patch publication, or other remote mutation needs its own explicit authorization.

## Evidence report

For every phase report:

- requested version and exact HEAD;
- preflight verdict and every failed or indeterminate check;
- commands actually run;
- external state observed, not inferred;
- authorization still required;
- recovery or next phase, if any.
