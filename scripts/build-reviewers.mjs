// ABOUTME: Generates tool-less reviewer agents from one shared contract and domain definitions.
// ABOUTME: Keeps severity and evidence semantics identical without runtime skill loading.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REVIEWER_DEFINITIONS } from "../src/reviewer-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = join(ROOT, "agent-skills", "pi-forge-review-contract", "SKILL.md");

function stripFrontmatter(content) {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) throw new Error("review contract frontmatter is missing");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("review contract frontmatter is unterminated");
  return normalized.slice(end + 5).trim();
}

export function buildReviewerAgent(definition, contractBody) {
  return `---
name: ${definition.name}
package: pi-forge
description: ${definition.description}
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
skills:
tools:
defaultContext: fresh
acceptanceRole: read-only
fallbackModels:
extensions:
subagentOnlyExtensions:
mcpDirectTools:
---

${contractBody}

## Domain Focus: ${definition.title}

${definition.focus}

Use “${definition.title}” as the report title.
`;
}

const contractBody = stripFrontmatter(await readFile(CONTRACT_PATH, "utf8"));
const check = process.argv.includes("--check");
let stale = false;
for (const definition of REVIEWER_DEFINITIONS) {
  const outputPath = join(ROOT, "agents", `${definition.name}.md`);
  const rendered = buildReviewerAgent(definition, contractBody);
  if (check) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== rendered) {
      console.error(`agents/${definition.name}.md is stale; run: node scripts/build-reviewers.mjs`);
      stale = true;
    }
  } else {
    await writeFile(outputPath, rendered);
  }
}
if (stale) process.exitCode = 1;
