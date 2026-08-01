// ABOUTME: Validates package resources, generated artifacts, the project Behavior Map, and public-content constraints.
// ABOUTME: Fails on private paths, em dashes, missing files, or accidental runtime AGENTS.md context.

import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PI_SUBAGENTS_VERSION } from "../src/second-opinion-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = [
  ".pi/skills/pi-forge-handbook/SKILL.md",
  ".pi/skills/pi-forge-handbook/references/behaviors/expert-panel.md",
  ".pi/skills/pi-forge-handbook/references/behaviors/protected-agent-policy.md",
  ".pi/skills/pi-forge-handbook/references/fingerprints.json",
  ".pi/skills/pi-forge-handbook/references/index.md",
  ".pi/skills/pi-forge-handbook/references/manifest.json",
  ".pi/skills/pi-forge-handbook/references/overview.md",
  ".pi/skills/pi-forge-handbook/references/registers.md",
  ".pi/extensions/pi-forge-release-guard.ts",
  ".pi/skills/pi-forge-release/SKILL.md",
  ".pi/skills/pi-forge-release/references/recovery.md",
  ".pi/skills/pi-forge-harness-audit/SKILL.md",
  ".pi/skills/pi-forge-harness-audit/references/change-contract-template.md",
  "AGENTS.md.example",
  "agent-skills/pi-forge-implementation-contract/SKILL.md",
  "agent-skills/pi-forge-review-contract/SKILL.md",
  "agent-skills/pi-forge-writing-contract/SKILL.md",
  "agents/architecture-reviewer.md",
  "agents/database-reviewer.md",
  "agents/dependency-reviewer.md",
  "agents/dx-reviewer.md",
  "agents/independent-critic.md",
  "agents/opinion-synthesizer.md",
  "agents/socratic-analyst.md",
  "agents/performance-reviewer.md",
  "agents/security-reviewer.md",
  "agents/software-engineer.md",
  "agents/test-reviewer.md",
  "agents/tech-writer.md",
  "chains/second-opinion.chain.json",
  "prompts/commit.md",
  "prompts/orchestrator.md",
  "prompts/plan-forge.md",
  "prompts/project-checks.md",
  "prompts/pr-review.md",
  "prompts/second-opinion.md",
  "prompts/socratic-analysis.md",
  "scripts/check-behavior-map.mjs",
  "scripts/check-release.mjs",
  "scripts/check-runtime-resources.mjs",
  "scripts/lib/behavior-map.mjs",
  "scripts/lib/release-policy.mjs",
  "skills/orchestrator/SKILL.md",
  "skills/orchestrator/references/review-routing.md",
  "skills/plan-forge/SKILL.md",
  "skills/plan-forge/references/implementation-prompt.md",
  "skills/plan-forge/references/plan-template.md",
  "skills/project-checks/SKILL.md",
  "skills/project-checks/references/detection-contract.md",
  "skills/project-checks/scripts/inspect-project-checks.mjs",
  "skills/pr-review/SKILL.md",
  "skills/pr-review/references/candidate-execution.md",
  "skills/pr-review/references/evidence.md",
  "skills/pr-review/references/output-format.md",
  "skills/refine-requirements/SKILL.md",
  "skills/second-opinion/SKILL.md",
  "skills/socratic-analysis/SKILL.md",
  "skills/session-telemetry/SKILL.md",
  "skills/session-telemetry/scripts/aggregate-session-traces.mjs",
  "skills/session-telemetry/scripts/extract-session-trace.mjs",
  "skills/source-control/SKILL.md",
  "skills/source-control/scripts/commit-gate.sh",
  "extensions/agent-policy.ts",
  "extensions/lifecycle.ts",
  "extensions/second-opinion.ts",
  "extensions/score.ts",
  "extensions/telemetry.ts",
  "scripts/build-reviewers.mjs",
  "scripts/build-tech-writer.mjs",
  "src/agent-policy-config.js",
  "src/lifecycle-policy.js",
  "src/makefile-policy.js",
  "src/session-telemetry.js",
  "src/reviewer-config.js",
  "src/second-opinion-config.js",
  "src/second-opinion-integrity.js",
  "src/tech-writer-config.js",
  "docs/architecture.md",
  "docs/lifecycle.md",
  "docs/pi-subagents-resume-contract.md",
  "docs/telemetry.md",
  "docs/second-opinion.md",
  "docs/socratic-analysis.md",
];
const TEXT_EXTENSIONS = new Set(["", ".example", ".js", ".md", ".json", ".mjs", ".sh", ".ts", ".txt", ".yaml", ".yml"]);
const FORBIDDEN = [
  { pattern: /\/Users\//, label: "absolute macOS user path" },
  { pattern: /Development\/private/, label: "private development path" },
  { pattern: /~\/(?:\.ssh|\.aws|\.gnupg)/, label: "credential-store path" },
  { pattern: /\u2014/, label: "em dash" },
];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    if ([".git", ".pi-subagents", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) output.push(path);
  }
  return output;
}

const errors = [];
for (const path of REQUIRED) {
  await access(join(ROOT, path)).catch(() => errors.push(`missing required file: ${path}`));
}

await access(join(ROOT, "AGENTS.md"))
  .then(() => errors.push("AGENTS.md must not exist in the repository; ship AGENTS.md.example instead"))
  .catch(() => {});

const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const readme = await readFile(join(ROOT, "README.md"), "utf8");
if (packageJson.name !== "@maroffo/pi-forge") errors.push("package name must be @maroffo/pi-forge");
if (!readme.includes(`pi install npm:${packageJson.name}@${packageJson.version}`)) {
  errors.push("README npm install command must match the package name and version");
}
if (packageJson.repository?.url !== "git+https://github.com/maroffo/pi-forge.git") {
  errors.push("package repository must identify the public source repository");
}
if (packageJson.publishConfig?.access !== "public") errors.push("npm publication must remain explicitly public");
if (!packageJson.keywords?.includes("pi-package")) errors.push("package keywords must include pi-package");
if (!packageJson.pi?.extensions?.includes("./extensions")) errors.push("manifest must expose ./extensions");
if (!packageJson.pi?.prompts?.includes("./prompts")) errors.push("manifest must expose ./prompts");
if (!packageJson.pi?.skills?.includes("./skills")) errors.push("manifest must expose ./skills");
if (!packageJson.pi?.subagents?.agents?.includes("./agents")) errors.push("manifest must expose ./agents");
if (!packageJson.pi?.subagents?.chains?.includes("./chains")) errors.push("manifest must expose ./chains");
if (!packageJson.files?.includes("src/")) errors.push("published files must include runtime src/");
if (!packageJson.files?.includes("agent-skills/")) errors.push("published files must include agent-skills/");
if (!packageJson.files?.includes("agents/")) errors.push("published files must include agents/");
if (!packageJson.files?.includes("prompts/")) errors.push("published files must include prompts/");
if (!packageJson.files?.includes("skills/")) errors.push("published files must include skills/");
if (packageJson.dependencies?.["pi-subagents"] !== PI_SUBAGENTS_VERSION) {
  errors.push("package.json pi-subagents dependency must match PI_SUBAGENTS_VERSION");
}
if (!packageJson.bundledDependencies?.includes("pi-subagents")) {
  errors.push("pi-subagents must remain a bundled dependency");
}

const packageLock = JSON.parse(await readFile(join(ROOT, "package-lock.json"), "utf8"));
if (packageLock.version !== packageJson.version) {
  errors.push("package-lock top-level version must match package.json");
}
if (packageLock.packages?.[""]?.version !== packageJson.version) {
  errors.push("package-lock root package version must match package.json");
}
if (packageLock.packages?.[""]?.dependencies?.["pi-subagents"] !== PI_SUBAGENTS_VERSION) {
  errors.push("package-lock root dependency must match PI_SUBAGENTS_VERSION");
}
if (packageLock.packages?.["node_modules/pi-subagents"]?.version !== PI_SUBAGENTS_VERSION) {
  errors.push("package-lock installed pi-subagents version must match PI_SUBAGENTS_VERSION");
}

for (const path of await filesBelow(ROOT)) {
  const content = await readFile(path, "utf8");
  for (const forbidden of FORBIDDEN) {
    if (forbidden.pattern.test(content)) {
      errors.push(`${relative(ROOT, path)} contains ${forbidden.label}`);
    }
  }
}

const releaseGuardSyntax = spawnSync(process.execPath, ["--experimental-strip-types", "--check", ".pi/extensions/pi-forge-release-guard.ts"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (releaseGuardSyntax.status !== 0) {
  errors.push((releaseGuardSyntax.stderr || releaseGuardSyntax.stdout || "release guard syntax check failed").trim());
}

for (const [script, label] of [
  ["scripts/build-second-opinion.mjs", "generated chain"],
  ["scripts/build-reviewers.mjs", "generated reviewers"],
  ["scripts/build-tech-writer.mjs", "generated tech writer"],
]) {
  const generated = spawnSync(process.execPath, [script, "--check"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (generated.status !== 0) {
    errors.push((generated.stderr || generated.stdout || `${label} check failed`).trim());
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("package checks passed");
