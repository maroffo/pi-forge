# Pi Forge Release Recovery

Inspect first. Never repeat a tag push or npm publication merely because the first command did not return a clear success message.

| Reconcile state | Meaning | Smallest safe next step |
|---|---|---|
| `consistent` | Local tag, remote tag, registry version, and `latest` agree | Run or complete `verify`; do not repeat publication |
| `local-only-tag` | Tag exists locally but not remotely or in npm | Verify the annotated tag target, then request separate authorization for one tag push |
| `remote-only-tag` | Remote tag exists without the expected local tag or npm version | Fetch and inspect the remote tag; do not recreate or force-push it |
| `registry-only-publication` | npm version exists without corresponding tag evidence | Treat as an incident; preserve evidence and inspect package provenance before any correction |
| `dist-tag-drift` | Version exists but `latest` points elsewhere | Determine whether the new or prior version is intended before requesting one exact dist-tag mutation |
| `unavailable` | One or more authoritative queries failed | Restore CLI, auth, or network evidence; do not mutate or retry |
| `inconsistent` | State does not match a supported transition | Stop and inspect each local, remote, and registry fact independently |

## Bad published version

1. Preserve the release tag and registry evidence.
2. Verify whether only `latest` is wrong or the immutable package contents are defective.
3. If only the dist-tag is wrong, propose the exact prior known-good target. Changing it requires explicit authorization.
4. If the package is defective, prefer deprecating that exact version and publishing a corrected patch after the complete release workflow. Both actions require separate authorization.
5. Never automatically unpublish. npm policy, downstream installs, and provenance require a specific human decision.
6. Never delete, recreate, or force-push the release tag to make history resemble the desired state.

## Unknown publication result

Query the exact version and dist-tags before doing anything else. npm versions are immutable: if another actor published the same version after preflight, a publication conflict is evidence to reconcile, not a reason to retry or override.
