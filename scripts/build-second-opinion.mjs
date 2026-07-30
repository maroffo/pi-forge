// ABOUTME: Generates the four-provider second-opinion chain from one canonical prompt and schema.
// ABOUTME: Keeps model assignments explicit while preventing copy-paste drift across parallel tasks.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRITIC_AGENT,
  OPINION_MODELS,
  SYNTHESIZER_AGENT,
  SYNTHESIZER_MODEL,
} from "../src/second-opinion-config.js";

export { OPINION_MODELS } from "../src/second-opinion-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "chains", "second-opinion.chain.json");
const INTEGRITY_OUTPUT = join(ROOT, "src", "second-opinion-integrity.js");
const PERSPECTIVES = ["A", "B", "C", "D"];

const criticTask = `Evaluate the artifact independently using the rubric below. Do not identify your provider or speculate about other reviewers.

Rubric:
- correctness and internal consistency
- hidden assumptions and missing evidence
- concrete risks or counterexamples
- smallest justified recommendation

<artifact>
{task}
</artifact>`;

const criticSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "findings", "uncertainties"],
  properties: {
    verdict: { type: "string", enum: ["accept", "revise", "reject", "inconclusive"] },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "claim", "evidence", "recommendation", "confidence"],
        properties: {
          severity: { type: "string", enum: ["critical", "major", "minor", "note"] },
          claim: { type: "string" },
          evidence: { type: "string" },
          recommendation: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    uncertainties: { type: "array", items: { type: "string" } },
  },
};

const synthesisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict",
    "consensus",
    "disagreements",
    "priorityFindings",
    "discardedClaims",
    "recommendation",
    "confidence",
  ],
  properties: {
    verdict: { type: "string", enum: ["accept", "revise", "reject", "inconclusive"] },
    consensus: { type: "array", items: { type: "string" } },
    disagreements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "positions", "resolution", "evidenceNeeded"],
        properties: {
          topic: { type: "string" },
          positions: { type: "array", items: { type: "string" } },
          resolution: { type: "string" },
          evidenceNeeded: { type: "string" },
        },
      },
    },
    priorityFindings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "claim", "evidence", "recommendation", "reportedBy"],
        properties: {
          severity: { type: "string", enum: ["critical", "major", "minor", "note"] },
          claim: { type: "string" },
          evidence: { type: "string" },
          recommendation: { type: "string" },
          reportedBy: {
            type: "array",
            items: { type: "string", enum: PERSPECTIVES },
          },
        },
      },
    },
    discardedClaims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "reason"],
        properties: {
          claim: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    recommendation: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
};

function synthesisTask() {
  const reports = PERSPECTIVES.map(
    (label) => `<perspective-${label.toLowerCase()}>\n{outputs.perspective${label}}\n</perspective-${label.toLowerCase()}>`,
  ).join("\n\n");

  return `Synthesize the four anonymous perspectives against the original artifact. Do not infer which provider produced a perspective. Agreement is not proof; preserve unresolved disagreement and identify evidence needed to resolve it.

<artifact>
{task}
</artifact>

${reports}`;
}

export function buildSecondOpinionChain() {
  return {
    name: "second-opinion",
    package: "pi-forge",
    description: "Ask four isolated providers for independent opinions, then synthesize their evidence with minimized identity bias",
    chain: [
      {
        phase: "Independent review",
        label: "Four provider perspectives",
        parallel: OPINION_MODELS.map((model, index) => ({
          agent: CRITIC_AGENT,
          model,
          as: `perspective${PERSPECTIVES[index]}`,
          progress: false,
          task: criticTask,
          outputSchema: criticSchema,
        })),
        concurrency: 4,
        failFast: false,
      },
      {
        agent: SYNTHESIZER_AGENT,
        model: SYNTHESIZER_MODEL,
        phase: "Synthesis",
        label: "Blind evidence synthesis",
        task: synthesisTask(),
        outputSchema: synthesisSchema,
      },
    ],
  };
}

const rendered = `${JSON.stringify(buildSecondOpinionChain(), null, 2)}\n`;
const digest = createHash("sha256").update(rendered).digest("hex");
const integrityModule = `// ABOUTME: Generated integrity binding for the disclosed second-opinion chain.\n// ABOUTME: Regenerate with scripts/build-second-opinion.mjs; do not edit manually.\n\nexport const SECOND_OPINION_CHAIN_SHA256 = ${JSON.stringify(digest)};\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "");
  const currentIntegrity = await readFile(INTEGRITY_OUTPUT, "utf8").catch(() => "");
  if (current !== rendered || currentIntegrity !== integrityModule) {
    console.error("second-opinion generated resources are stale; run: node scripts/build-second-opinion.mjs");
    process.exitCode = 1;
  }
} else {
  await writeFile(OUTPUT, rendered);
  await writeFile(INTEGRITY_OUTPUT, integrityModule);
}
