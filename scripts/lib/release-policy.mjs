// ABOUTME: Defines pure Pi Forge release phase validation and ordinary release-command classification.
// ABOUTME: Keeps registry and Git mutations outside the non-publishing preflight helper.

import { basename } from "node:path";

export const RELEASE_PHASES = Object.freeze(["prepare", "tag", "publish", "verify", "reconcile"]);
export const RELEASE_WORKFLOWS = Object.freeze(["CI", "pi-subagents upgrade compatibility"]);
export const RELEASE_PACKAGE = "@maroffo/pi-forge";

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isStableVersion(value) {
  return typeof value === "string" && STABLE_VERSION.test(value);
}

export function parseReleaseArguments(argv) {
  if (
    argv.length !== 4
    || argv[0] !== "--phase"
    || !RELEASE_PHASES.includes(argv[1])
    || argv[2] !== "--version"
    || !isStableVersion(argv[3])
  ) {
    throw new Error("Usage: check-release.mjs --phase <prepare|tag|publish|verify|reconcile> --version <MAJOR.MINOR.PATCH>");
  }
  return { phase: argv[1], version: argv[3] };
}

function check(name, status, detail) {
  return { name, status, detail };
}

function known(state) {
  return state?.status === "known";
}

function stateCheck(name, state, predicate, passDetail, failDetail) {
  if (!known(state)) return check(name, "indeterminate", state?.detail ?? "evidence unavailable");
  return predicate(state.value)
    ? check(name, "pass", passDetail)
    : check(name, "fail", typeof failDetail === "function" ? failDetail(state.value) : failDetail);
}

function exactVersionChecks(version, snapshot) {
  return [
    stateCheck("package-version", snapshot.versions?.package, (value) => value === version, `package.json is ${version}`, (value) => `package.json is ${value ?? "missing"}`),
    stateCheck("lock-version", snapshot.versions?.lock, (value) => value === version, `package-lock.json top level is ${version}`, (value) => `package-lock.json top level is ${value ?? "missing"}`),
    stateCheck("lock-root-version", snapshot.versions?.lockRoot, (value) => value === version, `package-lock root is ${version}`, (value) => `package-lock root is ${value ?? "missing"}`),
    stateCheck("readme-version", snapshot.versions?.readme, (value) => value === version, `README install version is ${version}`, (value) => `README install version is ${value ?? "missing or ambiguous"}`),
  ];
}

function registryAbsent(snapshot) {
  return stateCheck(
    "registry-version-absent",
    snapshot.registry?.version,
    (value) => value.exists === false,
    "version is absent from npm",
    (value) => `registry version state is ${value.exists ? "present" : "unexpected"}`,
  );
}

function registryPresent(version, snapshot) {
  return stateCheck(
    "registry-version-present",
    snapshot.registry?.version,
    (value) => value.exists === true && value.version === version,
    `npm exposes ${version}`,
    (value) => value.exists ? `npm exposes ${value.version ?? "an unexpected version"}` : "version is absent from npm",
  );
}

function gitBaseChecks(snapshot) {
  const head = snapshot.git?.head;
  return [
    stateCheck("clean-tree", snapshot.git?.clean, (value) => value === true, "worktree and index are clean", "worktree or index is dirty"),
    stateCheck("main-branch", snapshot.git?.branch, (value) => value === "main", "current branch is main", (value) => `current branch is ${value ?? "unknown"}`),
    !known(head) || !known(snapshot.git?.originMain)
      ? check("main-synchronized", "indeterminate", head?.detail ?? snapshot.git?.originMain?.detail ?? "HEAD or origin/main unavailable")
      : head.value === snapshot.git.originMain.value
        ? check("main-synchronized", "pass", "HEAD equals origin/main")
        : check("main-synchronized", "fail", "HEAD does not equal origin/main"),
  ];
}

function absentTagChecks(snapshot) {
  return [
    stateCheck("local-tag-absent", snapshot.tags?.local, (value) => value.exists === false, "local tag is absent", "local tag already exists"),
    stateCheck("remote-tag-absent", snapshot.tags?.remote, (value) => value.exists === false, "remote tag is absent", "remote tag already exists"),
  ];
}

function exactTagChecks(snapshot) {
  const head = snapshot.git?.head;
  const tagCheck = (name, state) => {
    if (!known(head) || !known(state)) return check(name, "indeterminate", head?.detail ?? state?.detail ?? "tag or HEAD unavailable");
    const value = state.value;
    if (!value.exists) return check(name, "fail", `${name.includes("local") ? "local" : "remote"} tag is absent`);
    if (!value.annotated) return check(name, "fail", "tag is not annotated");
    return value.target === head.value
      ? check(name, "pass", "annotated tag dereferences to HEAD")
      : check(name, "fail", "annotated tag does not dereference to HEAD");
  };
  return [tagCheck("local-tag-exact", snapshot.tags?.local), tagCheck("remote-tag-exact", snapshot.tags?.remote)];
}

function ciChecks(snapshot) {
  if (!known(snapshot.ci)) return RELEASE_WORKFLOWS.map((workflow) => check(`ci-${workflow}`, "indeterminate", snapshot.ci?.detail ?? "GitHub run evidence unavailable"));
  const head = snapshot.git?.head;
  if (!known(head)) return RELEASE_WORKFLOWS.map((workflow) => check(`ci-${workflow}`, "indeterminate", head?.detail ?? "HEAD unavailable"));
  return RELEASE_WORKFLOWS.map((workflow) => {
    const matches = snapshot.ci.value.filter((run) => run.workflowName === workflow && run.headSha === head.value);
    if (matches.length === 0) return check(`ci-${workflow}`, "fail", `no exact-HEAD ${workflow} run was found`);
    if (matches.some((run) => typeof run.createdAt !== "string" || Number.isNaN(Date.parse(run.createdAt)))) {
      return check(`ci-${workflow}`, "indeterminate", `${workflow} exact-HEAD run timestamps are unavailable or malformed`);
    }
    const latest = [...matches].sort((left, right) => {
      const time = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return time || Number(right.databaseId ?? 0) - Number(left.databaseId ?? 0);
    })[0];
    return latest.status === "completed" && latest.conclusion === "success"
      ? check(`ci-${workflow}`, "pass", `latest exact-HEAD ${workflow} run is green`)
      : check(`ci-${workflow}`, "fail", `latest exact-HEAD ${workflow} state is ${latest.status}/${latest.conclusion ?? "unknown"}`);
  });
}

function verificationChecks(snapshot, names = ["e2e", "upgrade", "audit"]) {
  return names.map((name) => stateCheck(
    `verification-${name}`,
    snapshot.verification?.[name],
    (value) => value === true,
    `${name} verification passed in this preflight`,
    `${name} verification did not pass`,
  ));
}

function packChecks(version, state, prefix) {
  return [
    stateCheck(`${prefix}-identity`, state, (value) => value.name === RELEASE_PACKAGE && value.version === version, `${prefix} identity is ${RELEASE_PACKAGE}@${version}`, `${prefix} name or version differs`),
    stateCheck(`${prefix}-integrity`, state, (value) => typeof value.integrity === "string" && value.integrity.length > 0, `${prefix} integrity is present`, `${prefix} integrity is missing`),
    stateCheck(`${prefix}-roster`, state, (value) => value.rosterValid === true && value.hasProjectPi === false, `${prefix} roster is valid and excludes .pi`, `${prefix} roster is invalid or includes project-only .pi resources`),
  ];
}

function exactTagValue(value, head) {
  return value.exists === true && value.annotated === true && value.target === head;
}

export function classifyReconcileState(snapshot, version) {
  const required = [snapshot.git?.head, snapshot.tags?.local, snapshot.tags?.remote, snapshot.registry?.version, snapshot.registry?.distTags];
  if (required.some((state) => !known(state))) return { status: "indeterminate", state: "unavailable" };
  const head = snapshot.git.head.value;
  const localValue = snapshot.tags.local.value;
  const remoteValue = snapshot.tags.remote.value;
  const registryValue = snapshot.registry.version.value;
  const local = localValue.exists;
  const remote = remoteValue.exists;
  const registry = registryValue.exists;
  const latest = snapshot.registry.distTags.value.latest === version;
  if (
    local
    && remote
    && registry
    && latest
    && registryValue.version === version
    && exactTagValue(localValue, head)
    && exactTagValue(remoteValue, head)
  ) return { status: "pass", state: "consistent" };
  if (local && !remote && !registry) return { status: "fail", state: "local-only-tag" };
  if (!local && remote && !registry) return { status: "fail", state: "remote-only-tag" };
  if (!local && !remote && registry) return { status: "fail", state: "registry-only-publication" };
  if (registry && !latest) return { status: "fail", state: "dist-tag-drift" };
  return { status: "fail", state: "inconsistent" };
}

export function validateReleaseSnapshot(phase, version, snapshot) {
  if (!RELEASE_PHASES.includes(phase) || !isStableVersion(version)) throw new Error("invalid release phase or version");
  let checks = exactVersionChecks(version, snapshot);
  if (phase === "prepare") checks.push(...absentTagChecks(snapshot), registryAbsent(snapshot));
  if (phase === "tag") {
    checks.push(...gitBaseChecks(snapshot), ...absentTagChecks(snapshot), registryAbsent(snapshot), ...ciChecks(snapshot), ...verificationChecks(snapshot));
  }
  if (phase === "publish") {
    checks.push(
      ...gitBaseChecks(snapshot),
      ...exactTagChecks(snapshot),
      registryAbsent(snapshot),
      ...ciChecks(snapshot),
      ...verificationChecks(snapshot),
      ...packChecks(version, snapshot.pack?.local, "local-pack"),
    );
  }
  if (phase === "verify") {
    checks.push(...gitBaseChecks(snapshot), ...exactTagChecks(snapshot), registryPresent(version, snapshot));
    checks.push(stateCheck("latest-dist-tag", snapshot.registry?.distTags, (value) => value.latest === version, `latest points to ${version}`, (value) => `latest points to ${value.latest ?? "nothing"}`));
    checks.push(
      ...packChecks(version, snapshot.pack?.local, "local-pack"),
      ...packChecks(version, snapshot.pack?.registry, "registry-pack"),
      !known(snapshot.pack?.local) || !known(snapshot.pack?.registry)
        ? check("pack-integrity-match", "indeterminate", snapshot.pack?.local?.detail ?? snapshot.pack?.registry?.detail ?? "pack evidence unavailable")
        : snapshot.pack.local.value.integrity === snapshot.pack.registry.value.integrity
          ? check("pack-integrity-match", "pass", "local and registry tarball integrity match")
          : check("pack-integrity-match", "fail", "local and registry tarball integrity differ"),
      ...verificationChecks(snapshot, ["runtime"]),
    );
  }
  let reconcile;
  if (phase === "reconcile") {
    reconcile = classifyReconcileState(snapshot, version);
    checks.push(check("release-state", reconcile.status, reconcile.state));
  }
  const verdict = checks.some((item) => item.status === "fail")
    ? "fail"
    : checks.some((item) => item.status === "indeterminate")
      ? "indeterminate"
      : "pass";
  return { schemaVersion: 1, phase, version, verdict, checks, ...(reconcile ? { reconcile: reconcile.state } : {}) };
}

function shellSegments(command) {
  const output = [];
  let words = [];
  let word = "";
  let quote = "";
  let escaped = false;
  const pushWord = () => { if (word) words.push(word); word = ""; };
  const pushSegment = () => { pushWord(); if (words.length) output.push(words); words = []; };
  for (const char of command) {
    if (escaped) { word += char; escaped = false; continue; }
    if (char === "\\" && quote !== "'") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; else word += char; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (/\s/.test(char)) { pushWord(); if (char === "\n") pushSegment(); continue; }
    if (";|&()".includes(char)) { pushSegment(); continue; }
    word += char;
  }
  pushSegment();
  return output;
}

function unwrap(words) {
  let index = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index] ?? "")) index += 1;
  while (["command", "builtin", "nohup"].includes(basename(words[index] ?? "").toLowerCase())) index += 1;
  if (basename(words[index] ?? "").toLowerCase() === "env") {
    index += 1;
    while ((words[index] ?? "").startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index] ?? "")) index += 1;
  }
  return index;
}

function gitTagAction(words, index) {
  let cursor = index + 1;
  while (cursor < words.length) {
    const token = words[cursor];
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(token)) { cursor += 2; continue; }
    if (token.startsWith("-")) { cursor += 1; continue; }
    break;
  }
  if ((words[cursor] ?? "").toLowerCase() !== "tag") return undefined;
  const args = words.slice(cursor + 1);
  if (args.length === 0) return undefined;
  if (args.some((arg) => arg === "-d" || arg === "--delete" || arg.startsWith("--delete="))) return undefined;
  const readOnly = new Set(["-l", "--list", "-n", "--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "-v", "--verify", "--column", "--sort", "--format"]);
  const first = args[0];
  if (/^-n\d*$/.test(first) || readOnly.has(first) || [...readOnly].some((option) => first.startsWith(`${option}=`))) return undefined;
  if (args.some((arg) => arg === "-f" || arg === "--force")) return "git-tag-force";
  return "git-tag-create";
}

export function classifyReleaseCommand(command, depth = 0) {
  if (typeof command !== "string" || !command.trim() || depth > 2) return [];
  const actions = [];
  for (const words of shellSegments(command)) {
    const index = unwrap(words);
    const executable = basename(words[index] ?? "").toLowerCase();
    if (["bash", "sh", "zsh"].includes(executable)) {
      const commandIndex = words.findIndex((word, position) => position > index && word === "-c");
      if (commandIndex >= 0 && words[commandIndex + 1]) actions.push(...classifyReleaseCommand(words.slice(commandIndex + 1).join(" "), depth + 1));
      continue;
    }
    if (executable === "npm") {
      let cursor = index + 1;
      while ((words[cursor] ?? "").startsWith("-")) cursor += 1;
      if ((words[cursor] ?? "").toLowerCase() === "publish") actions.push("npm-publish");
      continue;
    }
    if (executable === "git") {
      const action = gitTagAction(words, index);
      if (action) actions.push(action);
    }
  }
  return [...new Set(actions)];
}
