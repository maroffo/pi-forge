// ABOUTME: Verifies Behavior Map locators, coverage, path safety, provenance, and advisory freshness.
// ABOUTME: Uses isolated fixtures so every structural failure mode is reproducible without model calls.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  BehaviorMapValidationError,
  DEFAULT_FINGERPRINTS_PATH,
  DEFAULT_MANIFEST_PATH,
  checkBehaviorMapFreshness,
  refreshBehaviorMapFingerprints,
  validateBehaviorMap,
} from "../scripts/lib/behavior-map.mjs";

const REQUIRED_CARD_HEADINGS = [
  "Purpose",
  "Triggers",
  "Inputs",
  "Outputs",
  "State transitions",
  "Exceptional paths",
  "Source of truth",
  "Generated artifacts",
  "Tests",
  "Registers",
  "Locators",
];

function digest(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

async function put(root: string, path: string, content: string) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function card(title: string, locatorIds: string[], registerIds: string[]) {
  return [
    `# ${title}`,
    "",
    ...REQUIRED_CARD_HEADINGS.flatMap((heading) => [
      `## ${heading}`,
      heading === "Registers"
        ? registerIds.map((id) => `- \`${id}\``).join("\n")
        : heading === "Locators"
          ? locatorIds.map((id) => `- \`${id}\``).join("\n")
          : `Navigation for ${heading.toLowerCase()}.`,
      "",
    ]),
  ].join("\n");
}

async function writeJson(root: string, path: string, value: unknown) {
  await put(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-behavior-map-"));
  for (const directory of [
    "agent-skills",
    "agents",
    "chains",
    "docs",
    "extensions",
    "prompts",
    "scripts",
    "skills/second-opinion",
    "src",
    "tests",
  ]) await mkdir(join(root, directory), { recursive: true });
  await put(root, "README.md", "Fixture repository.\n");
  await put(root, "package.json", "{}\n");
  for (const directory of ["agent-skills", "agents", "prompts"]) {
    await put(root, `${directory}/.keep`, "fixture\n");
  }
  await put(root, "extensions/expert.ts", "// expert-panel\nexport function launchExpertPanel() {}\n");
  await put(root, "extensions/policy.ts", "export function validateProtectedLaunch() {}\n");
  await put(root, "docs/workflows.md", "# Workflows\n\n## Expert Panel\n\nsecond-opinion navigation.\n");
  await put(root, "skills/second-opinion/SKILL.md", "---\nname: second-opinion\ndescription: Fixture.\n---\n\n# Skill\n");
  await put(root, "scripts/generate.mjs", "// second-opinion canonical generator\nexport const source = true;\n");
  await put(root, "src/generated.js", "export const generated = true;\n");
  await put(root, "tests/workflow.test.ts", "// expert-panel and validateProtectedLaunch tests\n");
  await writeJson(root, "chains/panel.json", { chain: [{ name: "second-opinion" }] });

  const references = ".pi/skills/pi-forge-handbook/references";
  const expertLocators = ["expert-file", "expert-launch", "expert-heading", "expert-skill", "expert-chain"];
  const policyLocators = ["policy-launch"];
  await put(root, `${references}/overview.md`, "# Fixture overview\n");
  await put(root, `${references}/index.md`, [
    "# Index",
    "",
    "- `expert-panel`: [Expert](behaviors/expert-panel.md)",
    "- `protected-agent-policy`: [Policy](behaviors/protected-agent-policy.md)",
    "- `telemetry`: explicitly unmapped",
    "",
  ].join("\n"));
  await put(root, `${references}/registers.md`, "# Registers\n\n- `runtime-version`: `expert-file`, `policy-launch`\n");
  await put(root, `${references}/behaviors/expert-panel.md`, card("Expert", expertLocators, ["runtime-version"]));
  await put(root, `${references}/behaviors/protected-agent-policy.md`, card("Policy", policyLocators, ["runtime-version"]));

  const manifest = {
    schemaVersion: 1,
    documents: {
      overview: `${references}/overview.md`,
      index: `${references}/index.md`,
      registers: `${references}/registers.md`,
    },
    behaviors: [
      {
        id: "expert-panel",
        title: "Expert Panel",
        card: `${references}/behaviors/expert-panel.md`,
        registerIds: ["runtime-version"],
        locatorIds: expertLocators,
        testPaths: ["tests/workflow.test.ts"],
        fingerprintPaths: [
          "docs/workflows.md",
          "extensions/expert.ts",
          "scripts/generate.mjs",
          "skills/second-opinion/SKILL.md",
          "tests/workflow.test.ts",
        ],
        generatedArtifacts: [
          { path: "chains/panel.json", generatedFrom: ["scripts/generate.mjs"] },
          { path: "src/generated.js", generatedFrom: ["scripts/generate.mjs"] },
        ],
      },
      {
        id: "protected-agent-policy",
        title: "Protected policy",
        card: `${references}/behaviors/protected-agent-policy.md`,
        registerIds: ["runtime-version"],
        locatorIds: policyLocators,
        testPaths: ["tests/workflow.test.ts"],
        fingerprintPaths: ["extensions/policy.ts", "tests/workflow.test.ts"],
        generatedArtifacts: [],
      },
    ],
    registers: [
      {
        id: "runtime-version",
        title: "Runtime version",
        behaviorIds: ["expert-panel", "protected-agent-policy"],
        locatorIds: ["expert-file", "policy-launch"],
      },
    ],
    locators: [
      { id: "expert-file", type: "file", path: "extensions/expert.ts" },
      { id: "expert-launch", type: "code-declaration", path: "extensions/expert.ts", identifier: "launchExpertPanel" },
      { id: "expert-heading", type: "markdown-heading", path: "docs/workflows.md", heading: "Expert Panel", level: 2 },
      { id: "expert-skill", type: "skill-name", path: "skills/second-opinion/SKILL.md", name: "second-opinion" },
      { id: "expert-chain", type: "json-pointer", path: "chains/panel.json", pointer: "/chain/0/name" },
      { id: "policy-launch", type: "code-declaration", path: "extensions/policy.ts", identifier: "validateProtectedLaunch" },
    ],
    surfaces: [
      { path: "chains/panel.json", status: "mapped", behaviorIds: ["expert-panel"] },
      { path: "docs/workflows.md", status: "mapped", behaviorIds: ["expert-panel"] },
      { path: "extensions/expert.ts", status: "mapped", behaviorIds: ["expert-panel"] },
      { path: "extensions/policy.ts", status: "mapped", behaviorIds: ["protected-agent-policy"] },
      { path: "scripts/generate.mjs", status: "mapped", behaviorIds: ["expert-panel"] },
      { path: "skills/second-opinion/SKILL.md", status: "mapped", behaviorIds: ["expert-panel"] },
      { path: "src/generated.js", status: "mapped", behaviorIds: ["expert-panel"] },
      { path: "tests/workflow.test.ts", status: "mapped", behaviorIds: ["expert-panel", "protected-agent-policy"] },
    ],
    unmappedWorkflows: [
      { id: "telemetry", title: "Telemetry", rationale: "Outside the two-workflow pilot." },
    ],
  };
  await writeJson(root, DEFAULT_MANIFEST_PATH, manifest);
  const files: Record<string, string> = {};
  for (const path of [...new Set(manifest.behaviors.flatMap((behavior) => behavior.fingerprintPaths))].sort()) {
    files[path] = digest(await readFile(join(root, path)));
  }
  await writeJson(root, DEFAULT_FINGERPRINTS_PATH, { schemaVersion: 1, files });
  return { root, manifest };
}

async function issueCodes(promise: Promise<unknown>) {
  try {
    await promise;
    assert.fail("expected behavior map validation to fail");
  } catch (error) {
    assert.ok(error instanceof BehaviorMapValidationError, String(error));
    return new Set(error.issues.map((issue) => issue.code));
  }
}

test("behavior map validates every typed locator and starts fresh", async () => {
  const fixture = await makeFixture();
  try {
    const result = await validateBehaviorMap({ root: fixture.root });
    assert.equal(result.behaviors.length, 2);
    assert.deepEqual([...result.discovered.keys()], [
      "chains/panel.json",
      "docs/workflows.md",
      "extensions/expert.ts",
      "extensions/policy.ts",
      "scripts/generate.mjs",
      "skills/second-opinion/SKILL.md",
      "tests/workflow.test.ts",
    ]);
    assert.equal((await checkBehaviorMapFreshness({ root: fixture.root })).fresh, true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("behavior map rejects duplicate, missing, ambiguous, and broken locators", async () => {
  for (const mutate of [
    (manifest: any) => { manifest.locators.push({ ...manifest.locators[0] }); },
    (manifest: any) => { manifest.locators[0].path = "extensions/missing.ts"; },
    async (manifest: any, root: string) => {
      await put(root, "extensions/expert.ts", "// expert-panel\nexport function launchExpertPanel() {}\nfunction launchExpertPanel() {}\n");
    },
    (manifest: any) => { manifest.behaviors[0].locatorIds.push("missing-locator"); },
  ]) {
    const fixture = await makeFixture();
    try {
      await mutate(fixture.manifest, fixture.root);
      await writeJson(fixture.root, DEFAULT_MANIFEST_PATH, fixture.manifest);
      const codes = await issueCodes(validateBehaviorMap({ root: fixture.root }));
      assert.ok([...codes].some((code) => ["duplicate-id", "missing-path", "ambiguous-locator", "broken-reference"].includes(code)));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("behavior map rejects unclassified discovery and missing classification rationale", async () => {
  const fixture = await makeFixture();
  try {
    await put(fixture.root, "docs/new-panel.md", "# New\n\nexpert-panel undocumented surface.\n");
    assert.ok((await issueCodes(validateBehaviorMap({ root: fixture.root }))).has("unclassified-surface"));
    fixture.manifest.surfaces.push({
      path: "docs/new-panel.md",
      status: "excluded",
      behaviorIds: [],
      rationale: "",
    });
    await writeJson(fixture.root, DEFAULT_MANIFEST_PATH, fixture.manifest);
    assert.ok((await issueCodes(validateBehaviorMap({ root: fixture.root }))).has("coverage-rationale"));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("behavior map rejects escaping, symlinked, and non-regular locator paths", async () => {
  for (const kind of ["relative", "symlink", "directory"] as const) {
    const fixture = await makeFixture();
    const outside = join(dirname(fixture.root), `${fixture.root.split("/").at(-1)}-outside.ts`);
    try {
      if (kind === "relative") fixture.manifest.locators[0].path = "../outside.ts";
      if (kind === "directory") fixture.manifest.locators[0].path = "src";
      if (kind === "symlink") {
        await writeFile(outside, "outside\n");
        await symlink(outside, join(fixture.root, "src", "outside-link.ts"));
        fixture.manifest.locators[0].path = "src/outside-link.ts";
      }
      await writeJson(fixture.root, DEFAULT_MANIFEST_PATH, fixture.manifest);
      const codes = await issueCodes(validateBehaviorMap({ root: fixture.root }));
      assert.ok(codes.has("unsafe-path") || codes.has("non-regular-path"));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(outside, { force: true });
    }
  }
});

test("behavior map rejects missing register locators and unmapped workflow index entries", async () => {
  for (const path of [
    `${dirname(DEFAULT_MANIFEST_PATH)}/registers.md`,
    `${dirname(DEFAULT_MANIFEST_PATH)}/index.md`,
  ]) {
    const fixture = await makeFixture();
    try {
      const content = await readFile(join(fixture.root, path), "utf8");
      await put(
        fixture.root,
        path,
        path.endsWith("registers.md")
          ? content.replace("`policy-launch`", "policy launch")
          : content.replace("`telemetry`", "telemetry"),
      );
      assert.ok((await issueCodes(validateBehaviorMap({ root: fixture.root }))).has("broken-reference"));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("behavior map rejects malformed cards, JSON pointers, and generated provenance", async () => {
  for (const mutate of [
    async (manifest: any, root: string) => {
      const path = `${dirname(DEFAULT_MANIFEST_PATH)}/behaviors/expert-panel.md`;
      await put(root, path, card("Expert", manifest.behaviors[0].locatorIds, manifest.behaviors[0].registerIds).replace("## Inputs", "## Missing Inputs"));
    },
    (manifest: any) => { manifest.locators.find((locator: any) => locator.id === "expert-chain").pointer = "/chain/9"; },
    (manifest: any) => { manifest.behaviors[0].fingerprintPaths = manifest.behaviors[0].fingerprintPaths.filter((path: string) => path !== "scripts/generate.mjs"); },
    (manifest: any) => { manifest.behaviors[0].fingerprintPaths.push("chains/panel.json"); },
  ]) {
    const fixture = await makeFixture();
    try {
      await mutate(fixture.manifest, fixture.root);
      await writeJson(fixture.root, DEFAULT_MANIFEST_PATH, fixture.manifest);
      const codes = await issueCodes(validateBehaviorMap({ root: fixture.root }));
      assert.ok([...codes].some((code) => ["card-contract", "missing-locator", "generated-provenance", "fingerprint-shape"].includes(code)));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("behavior map rejects missing native locators and malformed manifest or snapshot JSON", async () => {
  for (const mutate of [
    (manifest: any) => { manifest.locators.find((locator: any) => locator.id === "expert-heading").heading = "Missing heading"; },
    (manifest: any) => { manifest.locators.find((locator: any) => locator.id === "expert-skill").name = "missing-skill"; },
    (manifest: any) => { manifest.locators.find((locator: any) => locator.id === "expert-file").type = "text-anchor"; },
    (manifest: any) => { manifest.locators.find((locator: any) => locator.id === "expert-file").pointer = "/unexpected"; },
  ]) {
    const fixture = await makeFixture();
    try {
      mutate(fixture.manifest);
      await writeJson(fixture.root, DEFAULT_MANIFEST_PATH, fixture.manifest);
      const codes = await issueCodes(validateBehaviorMap({ root: fixture.root }));
      assert.ok(codes.has("ambiguous-locator") || codes.has("unsupported-locator") || codes.has("schema"));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }

  for (const path of [DEFAULT_MANIFEST_PATH, DEFAULT_FINGERPRINTS_PATH]) {
    const fixture = await makeFixture();
    try {
      await put(fixture.root, path, "{not-json}\n");
      assert.ok((await issueCodes(validateBehaviorMap({ root: fixture.root }))).has("invalid-json"));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("behavior map freshness freezes affected cards and explicit refresh restores the snapshot", async () => {
  const fixture = await makeFixture();
  try {
    await put(fixture.root, "extensions/expert.ts", "// expert-panel changed\nexport function launchExpertPanel() {}\n");
    const structural = await validateBehaviorMap({ root: fixture.root });
    assert.equal(structural.behaviors.length, 2);
    const stale = await checkBehaviorMapFreshness({ root: fixture.root });
    assert.equal(stale.fresh, false);
    assert.deepEqual(stale.stale.map((entry) => entry.path), ["extensions/expert.ts"]);
    assert.deepEqual(stale.stale[0]?.behaviorIds, ["expert-panel"]);

    const refreshed = await refreshBehaviorMapFingerprints({ root: fixture.root });
    assert.equal(refreshed.destination, join(await realpath(fixture.root), DEFAULT_FINGERPRINTS_PATH));
    assert.equal((await checkBehaviorMapFreshness({ root: fixture.root })).fresh, true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("behavior map refresh writes nothing when structure or fixed output is unsafe", async () => {
  const invalid = await makeFixture();
  try {
    invalid.manifest.behaviors[0].locatorIds.push("missing-locator");
    await writeJson(invalid.root, DEFAULT_MANIFEST_PATH, invalid.manifest);
    const before = await readFile(join(invalid.root, DEFAULT_FINGERPRINTS_PATH), "utf8");
    assert.ok((await issueCodes(refreshBehaviorMapFingerprints({ root: invalid.root }))).has("broken-reference"));
    assert.equal(await readFile(join(invalid.root, DEFAULT_FINGERPRINTS_PATH), "utf8"), before);
  } finally {
    await rm(invalid.root, { recursive: true, force: true });
  }

  const linked = await makeFixture();
  const outside = join(dirname(linked.root), `${linked.root.split("/").at(-1)}-fingerprints.json`);
  try {
    await writeFile(outside, "outside\n");
    await rm(join(linked.root, DEFAULT_FINGERPRINTS_PATH));
    await symlink(outside, join(linked.root, DEFAULT_FINGERPRINTS_PATH));
    assert.ok((await issueCodes(refreshBehaviorMapFingerprints({ root: linked.root }))).has("unsafe-output"));
    assert.equal(await readFile(outside, "utf8"), "outside\n");
  } finally {
    await rm(linked.root, { recursive: true, force: true });
    await rm(outside, { force: true });
  }

  const hardlinked = await makeFixture();
  const hardlinkPath = join(dirname(hardlinked.root), `${hardlinked.root.split("/").at(-1)}-hardlink.json`);
  try {
    await link(join(hardlinked.root, DEFAULT_FINGERPRINTS_PATH), hardlinkPath);
    const before = await readFile(hardlinkPath, "utf8");
    assert.ok((await issueCodes(refreshBehaviorMapFingerprints({ root: hardlinked.root }))).has("unsafe-output"));
    assert.equal(await readFile(hardlinkPath, "utf8"), before);
  } finally {
    await rm(hardlinked.root, { recursive: true, force: true });
    await rm(hardlinkPath, { force: true });
  }
});
