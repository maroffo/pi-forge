// ABOUTME: Generates the tool-less technical writer from one private evidence and prose contract.
// ABOUTME: Prevents runtime skill replacement while keeping the source contract independently testable.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TECH_WRITER_DEFINITION } from "../src/tech-writer-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = join(ROOT, "agent-skills", "pi-forge-writing-contract", "SKILL.md");
const OUTPUT_PATH = join(ROOT, "agents", `${TECH_WRITER_DEFINITION.name}.md`);

function stripFrontmatter(content) {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) throw new Error("writing contract frontmatter is missing");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("writing contract frontmatter is unterminated");
  return normalized.slice(end + 5).trim();
}

export function buildTechWriterAgent(definition, contractBody) {
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

## ${definition.title}

${definition.focus}
`;
}

const contractBody = stripFrontmatter(await readFile(CONTRACT_PATH, "utf8"));
const rendered = buildTechWriterAgent(TECH_WRITER_DEFINITION, contractBody);
if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT_PATH, "utf8").catch(() => "");
  if (current !== rendered) {
    console.error("agents/tech-writer.md is stale; run: node scripts/build-tech-writer.mjs");
    process.exitCode = 1;
  }
} else {
  await writeFile(OUTPUT_PATH, rendered);
}
