// ABOUTME: Validates the maintainer-only Pi Forge behavior map and its typed source locators.
// ABOUTME: Separates hard structural checks from advisory whole-file freshness fingerprints.

import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, isAbsolute, join, posix, relative, sep } from "node:path";

export const MAP_REFERENCES = ".pi/skills/pi-forge-handbook/references";
export const DEFAULT_MANIFEST_PATH = `${MAP_REFERENCES}/manifest.json`;
export const DEFAULT_FINGERPRINTS_PATH = `${MAP_REFERENCES}/fingerprints.json`;

export const DISCOVERY_ROOTS = Object.freeze([
  "README.md",
  "package.json",
  "agent-skills",
  "agents",
  "chains",
  "docs",
  "extensions",
  "prompts",
  "scripts",
  "skills",
  "src",
  "tests",
]);

export const DISCOVERY_SCOPES = Object.freeze([
  Object.freeze({
    id: "expert-panel",
    terms: Object.freeze([
      "second-opinion",
      "expert-panel",
      "convene_expert_panel",
      "SECOND_OPINION",
      "CRITIC_AGENT",
      "SYNTHESIZER_AGENT",
      "OPINION_MODELS",
    ]),
  }),
  Object.freeze({
    id: "protected-agent-policy",
    terms: Object.freeze([
      "pi-forge.software-engineer",
      "pi-forge-review-contract",
      "pi-forge-writing-contract",
      "pi-forge-implementation-contract",
      "WRITER_AGENT_NAME",
      "ARTIFACT_AGENT_NAMES",
      "REVIEWER_AGENT_NAMES",
      "TECH_WRITER_AGENT_NAME",
      "validateProtectedLaunch",
      "validateResumeAttestation",
      "run-attestation",
      "protected-agent",
      "protected agent",
    ]),
  }),
]);

const DISCOVERY_IGNORES = new Set([
  "scripts/check-behavior-map.mjs",
  "scripts/lib/behavior-map.mjs",
  "tests/behavior-map.test.ts",
]);
const TEXT_EXTENSIONS = new Set(["", ".example", ".js", ".json", ".md", ".mjs", ".sh", ".ts"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const CARD_HEADINGS = [
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

export class BehaviorMapValidationError extends Error {
  constructor(issues) {
    super(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
    this.name = "BehaviorMapValidationError";
    this.issues = issues;
  }
}

function addIssue(issues, code, message) {
  issues.push({ code, message });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateKeys(value, allowed, issues, label) {
  if (!isObject(value)) {
    addIssue(issues, "schema", `${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) addIssue(issues, "schema", `${label} has unknown field '${key}'`);
  }
  return true;
}

function validateId(value, issues, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    addIssue(issues, "schema", `${label} must be a lowercase kebab-case id`);
    return false;
  }
  return true;
}

function validateString(value, issues, label) {
  if (typeof value !== "string" || !value.trim()) {
    addIssue(issues, "schema", `${label} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateStringArray(value, issues, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    addIssue(issues, "schema", `${label} must be ${allowEmpty ? "an" : "a non-empty"} array`);
    return [];
  }
  const output = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) addIssue(issues, "schema", `${label} contains an empty or non-string item`);
    else output.push(item);
  }
  return output;
}

function safeRelativePath(value, issues, label) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || isAbsolute(value)) {
    addIssue(issues, "unsafe-path", `${label} must be a repository-relative POSIX path`);
    return undefined;
  }
  const normalized = posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    addIssue(issues, "unsafe-path", `${label} escapes or is not a canonical repository-relative path: ${value}`);
    return undefined;
  }
  return value;
}

function insideRoot(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

async function resolveRegularFile(root, relativePath, issues, label) {
  const safe = safeRelativePath(relativePath, issues, label);
  if (!safe) return undefined;
  const candidate = join(root, safe);
  let resolved;
  try {
    resolved = await realpath(candidate);
  } catch {
    addIssue(issues, "missing-path", `${label} does not exist: ${safe}`);
    return undefined;
  }
  if (!insideRoot(root, resolved)) {
    addIssue(issues, "unsafe-path", `${label} resolves outside the repository: ${safe}`);
    return undefined;
  }
  let info;
  try {
    info = await stat(resolved);
  } catch {
    addIssue(issues, "missing-path", `${label} cannot be inspected: ${safe}`);
    return undefined;
  }
  if (!info.isFile()) {
    addIssue(issues, "non-regular-path", `${label} is not a regular file: ${safe}`);
    return undefined;
  }
  return { path: safe, absolutePath: resolved };
}

async function readJson(path, issues, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    addIssue(issues, "invalid-json", `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function duplicateIds(values, issues, label) {
  const seen = new Set();
  for (const value of values) {
    if (!value?.id) continue;
    if (seen.has(value.id)) addIssue(issues, "duplicate-id", `${label} id '${value.id}' is duplicated`);
    seen.add(value.id);
  }
}

function parseFrontmatterName(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return [];
  const end = lines.indexOf("---", 1);
  if (end < 0) return [];
  return lines.slice(1, end).flatMap((line) => {
    const match = /^name:\s*([^\s#][^#]*?)\s*$/.exec(line);
    return match ? [match[1].trim()] : [];
  });
}

function resolveJsonPointer(value, pointer) {
  if (pointer === "") return { found: true, value };
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return { found: false };
  let current = value;
  for (const rawToken of pointer.slice(1).split("/")) {
    if (/~(?:[^01]|$)/.test(rawToken)) return { found: false };
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/.test(token)) return { found: false };
      const index = Number(token);
      if (index >= current.length) return { found: false };
      current = current[index];
    } else if (isObject(current) && Object.prototype.hasOwnProperty.call(current, token)) {
      current = current[token];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}

function declarationCount(content, identifier) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^[\\t ]*(?:export\\s+)?(?:default\\s+)?(?:(?:async\\s+)?function|class|(?:const|let|var))\\s+${escaped}\\b`,
    "gm",
  );
  return [...content.matchAll(pattern)].length;
}

async function validateLocator(root, locator, issues, label) {
  const locatorFields = {
    file: [],
    "code-declaration": ["identifier"],
    "markdown-heading": ["heading", "level"],
    "skill-name": ["name"],
    "json-pointer": ["pointer"],
  };
  const unionFields = [...new Set(Object.values(locatorFields).flat())];
  if (!validateKeys(locator, ["id", "type", "path", ...unionFields], issues, label)) {
    return undefined;
  }
  validateId(locator.id, issues, `${label}.id`);
  const file = await resolveRegularFile(root, locator.path, issues, `${label}.path`);
  const types = Object.keys(locatorFields);
  if (!types.includes(locator.type)) addIssue(issues, "unsupported-locator", `${label}.type is unsupported: ${String(locator.type)}`);
  else validateKeys(locator, ["id", "type", "path", ...locatorFields[locator.type]], issues, `${label} (${locator.type})`);
  if (!file || !types.includes(locator.type)) return file;
  if (locator.type === "file") return file;

  const content = await readFile(file.absolutePath, "utf8");
  if (locator.type === "code-declaration") {
    if (![".js", ".mjs", ".ts"].includes(extname(file.path))) {
      addIssue(issues, "locator-mismatch", `${label} code-declaration requires a JS, MJS, or TS file`);
      return file;
    }
    if (!validateString(locator.identifier, issues, `${label}.identifier`)) return file;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(locator.identifier)) {
      addIssue(issues, "schema", `${label}.identifier must be a JavaScript identifier`);
      return file;
    }
    const count = declarationCount(content, locator.identifier);
    if (count !== 1) {
      addIssue(issues, "ambiguous-locator", `${label} expected one declaration of '${locator.identifier}', found ${count}`);
    }
  } else if (locator.type === "markdown-heading") {
    if (extname(file.path) !== ".md") addIssue(issues, "locator-mismatch", `${label} markdown-heading requires a Markdown file`);
    if (!validateString(locator.heading, issues, `${label}.heading`)) return file;
    if (!Number.isInteger(locator.level) || locator.level < 1 || locator.level > 6) {
      addIssue(issues, "schema", `${label}.level must be an integer from 1 to 6`);
      return file;
    }
    const expected = `${"#".repeat(locator.level)} ${locator.heading}`;
    const count = content.split(/\r?\n/).filter((line) => line === expected).length;
    if (count !== 1) addIssue(issues, "ambiguous-locator", `${label} expected one heading '${expected}', found ${count}`);
  } else if (locator.type === "skill-name") {
    if (!file.path.endsWith("SKILL.md")) addIssue(issues, "locator-mismatch", `${label} skill-name requires SKILL.md`);
    if (!validateString(locator.name, issues, `${label}.name`)) return file;
    const names = parseFrontmatterName(content);
    if (names.length !== 1 || names[0] !== locator.name) {
      addIssue(issues, "ambiguous-locator", `${label} expected frontmatter name '${locator.name}', found ${JSON.stringify(names)}`);
    }
  } else if (locator.type === "json-pointer") {
    if (extname(file.path) !== ".json") addIssue(issues, "locator-mismatch", `${label} json-pointer requires a JSON file`);
    if (typeof locator.pointer !== "string" || (locator.pointer !== "" && !locator.pointer.startsWith("/"))) {
      addIssue(issues, "schema", `${label}.pointer must be an RFC 6901 pointer`);
      return file;
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      addIssue(issues, "invalid-json", `${label}.path is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return file;
    }
    if (!resolveJsonPointer(parsed, locator.pointer).found) {
      addIssue(issues, "missing-locator", `${label} JSON pointer does not resolve: ${locator.pointer}`);
    }
  }
  return file;
}

async function walkDiscoveryRoot(root, relativeRoot, output, issues) {
  const safe = safeRelativePath(relativeRoot, issues, "discovery root");
  if (!safe) return;
  const absolute = join(root, safe);
  let info;
  try {
    info = await lstat(absolute);
  } catch {
    addIssue(issues, "missing-path", `checker-owned discovery root is missing: ${safe}`);
    return;
  }
  if (info.isSymbolicLink()) {
    addIssue(issues, "unsafe-path", `checker-owned discovery root is a symlink: ${safe}`);
    return;
  }
  if (info.isFile()) {
    if (TEXT_EXTENSIONS.has(extname(safe)) && !DISCOVERY_IGNORES.has(safe)) output.push(safe);
    return;
  }
  if (!info.isDirectory()) {
    addIssue(issues, "non-regular-path", `checker-owned discovery root is not a file or directory: ${safe}`);
    return;
  }
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (["node_modules", ".git", ".pi-subagents"].includes(entry.name)) continue;
    const child = `${safe}/${entry.name}`;
    if (entry.isDirectory()) await walkDiscoveryRoot(root, child, output, issues);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(child)) && !DISCOVERY_IGNORES.has(child)) output.push(child);
    else if (entry.isSymbolicLink()) addIssue(issues, "unsafe-path", `checker-owned discovery encountered a symlink: ${child}`);
    else if (!entry.isFile()) addIssue(issues, "non-regular-path", `checker-owned discovery encountered a non-regular path: ${child}`);
  }
}

export async function discoverPilotSurfaces(root) {
  const issues = [];
  const canonicalRoot = await realpath(root);
  const paths = [];
  for (const discoveryRoot of DISCOVERY_ROOTS) await walkDiscoveryRoot(canonicalRoot, discoveryRoot, paths, issues);
  if (issues.length > 0) throw new BehaviorMapValidationError(issues);
  const discovered = new Map();
  for (const path of paths.sort()) {
    const content = await readFile(join(canonicalRoot, path), "utf8");
    for (const scope of DISCOVERY_SCOPES) {
      if (scope.terms.some((term) => content.includes(term))) {
        const scopes = discovered.get(path) ?? new Set();
        scopes.add(scope.id);
        discovered.set(path, scopes);
      }
    }
  }
  return discovered;
}

async function validateDocuments(root, documents, issues) {
  if (!validateKeys(documents, ["overview", "index", "registers"], issues, "manifest.documents")) return new Map();
  const output = new Map();
  for (const name of ["overview", "index", "registers"]) {
    const file = await resolveRegularFile(root, documents[name], issues, `manifest.documents.${name}`);
    if (file) output.set(name, { ...file, content: await readFile(file.absolutePath, "utf8") });
  }
  return output;
}

function validateCardContent(content, behavior, issues) {
  for (const heading of CARD_HEADINGS) {
    const expected = `## ${heading}`;
    const count = content.split(/\r?\n/).filter((line) => line === expected).length;
    if (count !== 1) addIssue(issues, "card-contract", `${behavior.id} card expected one '${expected}' heading, found ${count}`);
  }
  if (content.includes("```")) addIssue(issues, "card-contract", `${behavior.id} card must not copy fenced source bodies`);
  if (/(?:^|\s)[A-Za-z0-9_./-]+\.(?:js|json|md|mjs|ts):[0-9]+\b/m.test(content)) {
    addIssue(issues, "card-contract", `${behavior.id} card must not contain static source line locators`);
  }
  for (const locatorId of behavior.locatorIds ?? []) {
    if (!content.includes(`\`${locatorId}\``)) addIssue(issues, "broken-reference", `${behavior.id} card does not name locator '${locatorId}'`);
  }
  for (const registerId of behavior.registerIds ?? []) {
    if (!content.includes(`\`${registerId}\``)) addIssue(issues, "broken-reference", `${behavior.id} card does not name register '${registerId}'`);
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function validateSnapshot(root, fingerprintsPath, expectedPaths, issues) {
  const file = await resolveRegularFile(root, fingerprintsPath, issues, "fingerprint snapshot");
  if (!file) return undefined;
  const snapshot = await readJson(file.absolutePath, issues, "fingerprint snapshot");
  if (!validateKeys(snapshot, ["schemaVersion", "files"], issues, "fingerprint snapshot")) return undefined;
  if (snapshot.schemaVersion !== 1) addIssue(issues, "schema", "fingerprint snapshot schemaVersion must be 1");
  if (!isObject(snapshot.files)) {
    addIssue(issues, "schema", "fingerprint snapshot files must be an object");
    return snapshot;
  }
  const actualPaths = Object.keys(snapshot.files).sort();
  const expected = [...expectedPaths].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expected)) {
    addIssue(issues, "fingerprint-shape", `fingerprint paths differ from canonical inputs: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actualPaths)}`);
  }
  for (const [path, digest] of Object.entries(snapshot.files)) {
    safeRelativePath(path, issues, "fingerprint path");
    if (typeof digest !== "string" || !DIGEST_PATTERN.test(digest)) {
      addIssue(issues, "fingerprint-shape", `fingerprint for '${path}' must be a lowercase SHA-256 digest`);
    }
  }
  return snapshot;
}

export async function validateBehaviorMap({
  root,
  manifestPath = DEFAULT_MANIFEST_PATH,
  fingerprintsPath = DEFAULT_FINGERPRINTS_PATH,
  validateFingerprints = true,
} = {}) {
  const issues = [];
  const canonicalRoot = await realpath(root ?? process.cwd());
  const manifestFile = await resolveRegularFile(canonicalRoot, manifestPath, issues, "behavior map manifest");
  if (!manifestFile) throw new BehaviorMapValidationError(issues);
  const manifest = await readJson(manifestFile.absolutePath, issues, "behavior map manifest");
  if (!validateKeys(
    manifest,
    ["schemaVersion", "documents", "behaviors", "registers", "locators", "surfaces", "unmappedWorkflows"],
    issues,
    "manifest",
  )) throw new BehaviorMapValidationError(issues);
  if (manifest.schemaVersion !== 1) addIssue(issues, "schema", "manifest.schemaVersion must be 1");

  const documents = await validateDocuments(canonicalRoot, manifest.documents, issues);
  const behaviors = Array.isArray(manifest.behaviors) ? manifest.behaviors : [];
  const registers = Array.isArray(manifest.registers) ? manifest.registers : [];
  const locators = Array.isArray(manifest.locators) ? manifest.locators : [];
  const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces : [];
  const unmappedWorkflows = Array.isArray(manifest.unmappedWorkflows) ? manifest.unmappedWorkflows : [];
  for (const [value, label] of [
    [manifest.behaviors, "manifest.behaviors"],
    [manifest.registers, "manifest.registers"],
    [manifest.locators, "manifest.locators"],
    [manifest.surfaces, "manifest.surfaces"],
    [manifest.unmappedWorkflows, "manifest.unmappedWorkflows"],
  ]) {
    if (!Array.isArray(value)) addIssue(issues, "schema", `${label} must be an array`);
  }
  duplicateIds(behaviors, issues, "behavior");
  duplicateIds(registers, issues, "register");
  duplicateIds(locators, issues, "locator");
  duplicateIds(unmappedWorkflows, issues, "unmapped workflow");

  const locatorById = new Map();
  for (let index = 0; index < locators.length; index += 1) {
    const locator = locators[index];
    const file = await validateLocator(canonicalRoot, locator, issues, `manifest.locators[${index}]`);
    if (locator?.id && !locatorById.has(locator.id)) locatorById.set(locator.id, { locator, file });
  }

  const behaviorById = new Map();
  const fingerprintPaths = new Set();
  const generatedPaths = new Set();
  const referencedPaths = new Map();
  const referencePath = (path, behaviorId) => {
    if (typeof path !== "string") return;
    const ids = referencedPaths.get(path) ?? new Set();
    ids.add(behaviorId);
    referencedPaths.set(path, ids);
  };

  for (let index = 0; index < behaviors.length; index += 1) {
    const behavior = behaviors[index];
    const label = `manifest.behaviors[${index}]`;
    if (!validateKeys(
      behavior,
      ["id", "title", "card", "registerIds", "locatorIds", "testPaths", "fingerprintPaths", "generatedArtifacts"],
      issues,
      label,
    )) continue;
    validateId(behavior.id, issues, `${label}.id`);
    validateString(behavior.title, issues, `${label}.title`);
    const card = await resolveRegularFile(canonicalRoot, behavior.card, issues, `${label}.card`);
    const registerIds = validateStringArray(behavior.registerIds, issues, `${label}.registerIds`);
    const locatorIds = validateStringArray(behavior.locatorIds, issues, `${label}.locatorIds`);
    const testPaths = validateStringArray(behavior.testPaths, issues, `${label}.testPaths`);
    const canonicalPaths = validateStringArray(behavior.fingerprintPaths, issues, `${label}.fingerprintPaths`);
    if (!Array.isArray(behavior.generatedArtifacts)) addIssue(issues, "schema", `${label}.generatedArtifacts must be an array`);
    for (const locatorId of locatorIds) {
      const entry = locatorById.get(locatorId);
      if (!entry) addIssue(issues, "broken-reference", `${behavior.id} references unknown locator '${locatorId}'`);
      else referencePath(entry.locator.path, behavior.id);
    }
    for (const registerId of registerIds) validateId(registerId, issues, `${label}.registerIds item`);
    for (const testPath of testPaths) {
      await resolveRegularFile(canonicalRoot, testPath, issues, `${label}.testPaths item`);
      referencePath(testPath, behavior.id);
    }
    for (const canonicalPath of canonicalPaths) {
      const file = await resolveRegularFile(canonicalRoot, canonicalPath, issues, `${label}.fingerprintPaths item`);
      if (file) fingerprintPaths.add(canonicalPath);
      referencePath(canonicalPath, behavior.id);
    }
    for (let generatedIndex = 0; generatedIndex < (behavior.generatedArtifacts ?? []).length; generatedIndex += 1) {
      const generated = behavior.generatedArtifacts[generatedIndex];
      const generatedLabel = `${label}.generatedArtifacts[${generatedIndex}]`;
      if (!validateKeys(generated, ["path", "generatedFrom"], issues, generatedLabel)) continue;
      const output = await resolveRegularFile(canonicalRoot, generated.path, issues, `${generatedLabel}.path`);
      const sources = validateStringArray(generated.generatedFrom, issues, `${generatedLabel}.generatedFrom`);
      if (output) generatedPaths.add(generated.path);
      referencePath(generated.path, behavior.id);
      for (const source of sources) {
        await resolveRegularFile(canonicalRoot, source, issues, `${generatedLabel}.generatedFrom item`);
        if (!canonicalPaths.includes(source)) {
          addIssue(issues, "generated-provenance", `${generated.path} source '${source}' is not a fingerprinted canonical input for ${behavior.id}`);
        }
      }
      if (canonicalPaths.includes(generated.path)) {
        addIssue(issues, "generated-provenance", `${generated.path} is generated and must not be fingerprinted`);
      }
    }
    if (card) {
      const content = await readFile(card.absolutePath, "utf8");
      validateCardContent(content, behavior, issues);
    }
    if (behavior?.id && !behaviorById.has(behavior.id)) behaviorById.set(behavior.id, behavior);
  }

  const registerById = new Map();
  for (let index = 0; index < registers.length; index += 1) {
    const register = registers[index];
    const label = `manifest.registers[${index}]`;
    if (!validateKeys(register, ["id", "title", "behaviorIds", "locatorIds"], issues, label)) continue;
    validateId(register.id, issues, `${label}.id`);
    validateString(register.title, issues, `${label}.title`);
    const behaviorIds = validateStringArray(register.behaviorIds, issues, `${label}.behaviorIds`);
    const locatorIds = validateStringArray(register.locatorIds, issues, `${label}.locatorIds`);
    for (const behaviorId of behaviorIds) {
      if (!behaviorById.has(behaviorId)) addIssue(issues, "broken-reference", `${register.id} references unknown behavior '${behaviorId}'`);
    }
    for (const locatorId of locatorIds) {
      if (!locatorById.has(locatorId)) addIssue(issues, "broken-reference", `${register.id} references unknown locator '${locatorId}'`);
    }
    if (register?.id && !registerById.has(register.id)) registerById.set(register.id, register);
  }
  for (const behavior of behaviors) {
    for (const registerId of behavior?.registerIds ?? []) {
      const register = registerById.get(registerId);
      if (!register) addIssue(issues, "broken-reference", `${behavior.id} references unknown register '${registerId}'`);
      else if (!register.behaviorIds.includes(behavior.id)) {
        addIssue(issues, "broken-reference", `${behavior.id} and register '${registerId}' do not reference each other`);
      }
    }
  }

  const surfaceByPath = new Map();
  for (let index = 0; index < surfaces.length; index += 1) {
    const surface = surfaces[index];
    const label = `manifest.surfaces[${index}]`;
    if (!validateKeys(surface, ["path", "status", "behaviorIds", "rationale"], issues, label)) continue;
    const file = await resolveRegularFile(canonicalRoot, surface.path, issues, `${label}.path`);
    if (surfaceByPath.has(surface.path)) addIssue(issues, "duplicate-path", `surface path '${surface.path}' is duplicated`);
    else if (typeof surface.path === "string") surfaceByPath.set(surface.path, surface);
    if (!["mapped", "unmapped", "excluded"].includes(surface.status)) {
      addIssue(issues, "schema", `${label}.status must be mapped, unmapped, or excluded`);
    }
    const behaviorIds = validateStringArray(surface.behaviorIds, issues, `${label}.behaviorIds`, { allowEmpty: surface.status !== "mapped" });
    for (const behaviorId of behaviorIds) {
      if (!behaviorById.has(behaviorId)) addIssue(issues, "broken-reference", `${surface.path} references unknown behavior '${behaviorId}'`);
    }
    if (surface.status === "mapped") {
      for (const behaviorId of behaviorIds) {
        if (!referencedPaths.get(surface.path)?.has(behaviorId)) {
          addIssue(issues, "broken-reference", `${surface.path} is mapped to ${behaviorId} but the behavior does not reference it`);
        }
      }
    } else if (typeof surface.rationale !== "string" || !surface.rationale.trim()) {
      addIssue(issues, "coverage-rationale", `${surface.path} ${surface.status} classification requires a rationale`);
    }
    if (!file) continue;
  }

  for (const [path, behaviorIds] of referencedPaths) {
    const surface = surfaceByPath.get(path);
    if (!surface || surface.status !== "mapped") {
      addIssue(issues, "broken-reference", `${path} is referenced by ${[...behaviorIds].join(", ")} but is not a mapped surface`);
    }
  }

  const discovered = await discoverPilotSurfaces(canonicalRoot).catch((error) => {
    if (error instanceof BehaviorMapValidationError) issues.push(...error.issues);
    else addIssue(issues, "discovery", error instanceof Error ? error.message : String(error));
    return new Map();
  });
  for (const [path, scopeIds] of discovered) {
    const surface = surfaceByPath.get(path);
    if (!surface) {
      addIssue(issues, "unclassified-surface", `${path} matches ${[...scopeIds].join(", ")} but is not classified`);
      continue;
    }
    if (surface.status === "mapped") {
      for (const scopeId of scopeIds) {
        if (!surface.behaviorIds.includes(scopeId)) {
          addIssue(issues, "unclassified-surface", `${path} matches ${scopeId} but is not mapped to it`);
        }
      }
    }
  }

  for (let index = 0; index < unmappedWorkflows.length; index += 1) {
    const workflow = unmappedWorkflows[index];
    const label = `manifest.unmappedWorkflows[${index}]`;
    if (!validateKeys(workflow, ["id", "title", "rationale"], issues, label)) continue;
    validateId(workflow.id, issues, `${label}.id`);
    validateString(workflow.title, issues, `${label}.title`);
    validateString(workflow.rationale, issues, `${label}.rationale`);
    if (behaviorById.has(workflow.id)) addIssue(issues, "duplicate-id", `unmapped workflow '${workflow.id}' is also a mapped behavior`);
  }

  const indexDocument = documents.get("index")?.content ?? "";
  const registersDocument = documents.get("registers")?.content ?? "";
  for (const behavior of behaviors) {
    if (!indexDocument.includes(`\`${behavior.id}\``) || !indexDocument.includes(`(${posix.relative(dirname(manifest.documents.index), behavior.card)})`)) {
      addIssue(issues, "broken-reference", `index document does not link behavior '${behavior.id}' to its card`);
    }
  }
  for (const register of registers) {
    if (!registersDocument.includes(`\`${register.id}\``)) {
      addIssue(issues, "broken-reference", `register document does not name '${register.id}'`);
    }
    for (const locatorId of register.locatorIds ?? []) {
      if (!registersDocument.includes(`\`${locatorId}\``)) {
        addIssue(issues, "broken-reference", `register document does not name '${register.id}' locator '${locatorId}'`);
      }
    }
  }
  for (const workflow of unmappedWorkflows) {
    if (workflow?.id && !indexDocument.includes(`\`${workflow.id}\``)) {
      addIssue(issues, "broken-reference", `index document does not name unmapped workflow '${workflow.id}'`);
    }
  }

  let snapshot;
  if (validateFingerprints) snapshot = await validateSnapshot(canonicalRoot, fingerprintsPath, fingerprintPaths, issues);
  if (issues.length > 0) throw new BehaviorMapValidationError(issues);
  return {
    root: canonicalRoot,
    manifest,
    manifestPath,
    fingerprintsPath,
    behaviors,
    behaviorById,
    locatorById,
    fingerprintPaths,
    generatedPaths,
    discovered,
    snapshot,
  };
}

export async function checkBehaviorMapFreshness(options = {}) {
  const validated = await validateBehaviorMap(options);
  const stale = [];
  for (const path of [...validated.fingerprintPaths].sort()) {
    const actual = sha256(await readFile(join(validated.root, path)));
    const expected = validated.snapshot.files[path];
    if (actual !== expected) {
      stale.push({
        path,
        expected,
        actual,
        behaviorIds: validated.behaviors
          .filter((behavior) => behavior.fingerprintPaths.includes(path))
          .map((behavior) => behavior.id)
          .sort(),
      });
    }
  }
  return { ...validated, fresh: stale.length === 0, stale };
}

async function assertRefreshDestination(root, fingerprintsPath, issues) {
  if (fingerprintsPath !== DEFAULT_FINGERPRINTS_PATH) {
    addIssue(issues, "unsafe-output", "fingerprint refresh may write only the fixed project snapshot");
    return undefined;
  }
  const safe = safeRelativePath(fingerprintsPath, issues, "fingerprint snapshot path");
  if (!safe) return undefined;
  const absolutePath = join(root, safe);
  if (!insideRoot(root, absolutePath)) {
    addIssue(issues, "unsafe-path", "fingerprint snapshot path escapes the repository");
    return undefined;
  }
  try {
    const resolvedParent = await realpath(dirname(absolutePath));
    if (!insideRoot(root, resolvedParent) || !(await stat(resolvedParent)).isDirectory()) {
      addIssue(issues, "unsafe-output", "fingerprint snapshot parent must resolve to a repository directory");
      return undefined;
    }
  } catch (error) {
    addIssue(issues, "unsafe-output", `fingerprint snapshot parent cannot be verified: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  try {
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink() || !info.isFile() || info.nlink !== 1) {
      addIssue(issues, "unsafe-output", "fingerprint snapshot must be a regular non-symlink file with one hard link");
      return undefined;
    }
    const resolved = await realpath(absolutePath);
    if (!insideRoot(root, resolved)) {
      addIssue(issues, "unsafe-output", "fingerprint snapshot resolves outside the repository");
      return undefined;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      addIssue(issues, "unsafe-output", `fingerprint snapshot cannot be inspected: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
  return absolutePath;
}

export async function refreshBehaviorMapFingerprints({
  root,
  manifestPath = DEFAULT_MANIFEST_PATH,
} = {}) {
  const fingerprintsPath = DEFAULT_FINGERPRINTS_PATH;
  const validated = await validateBehaviorMap({ root, manifestPath, fingerprintsPath, validateFingerprints: false });
  const issues = [];
  const destination = await assertRefreshDestination(validated.root, fingerprintsPath, issues);
  if (issues.length > 0) throw new BehaviorMapValidationError(issues);
  const files = {};
  for (const path of [...validated.fingerprintPaths].sort()) {
    files[path] = sha256(await readFile(join(validated.root, path)));
  }
  const rendered = `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`;
  const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, rendered, { flag: "wx", mode: 0o644 });
    const outputIssues = [];
    await assertRefreshDestination(validated.root, fingerprintsPath, outputIssues);
    if (outputIssues.length > 0) throw new BehaviorMapValidationError(outputIssues);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
  return { ...validated, destination, files };
}
