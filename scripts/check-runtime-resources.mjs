// ABOUTME: Verifies Pi Forge discovery and agent contracts from the actual npm publish artifact.
// ABOUTME: Uses isolated Pi configuration, collision fixtures, and no model invocation.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REVIEWER_LOCAL_NAMES as REVIEWER_NAMES,
  SOCRATIC_ANALYST_LOCAL_NAME,
  TECH_WRITER_LOCAL_NAME,
} from "../src/agent-policy-config.js";

const ARTIFACT_AGENT_NAMES = [
  ...REVIEWER_NAMES,
  TECH_WRITER_LOCAL_NAME,
  SOCRATIC_ANALYST_LOCAL_NAME,
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_PACK_PATHS = [
  "agent-skills/pi-forge-implementation-contract/SKILL.md",
  "agent-skills/pi-forge-review-contract/SKILL.md",
  "agent-skills/pi-forge-writing-contract/SKILL.md",
  ...REVIEWER_NAMES.map((name) => `agents/${name}.md`),
  "agents/socratic-analyst.md",
  "agents/software-engineer.md",
  "agents/tech-writer.md",
  "extensions/lifecycle.ts",
  "extensions/score.ts",
  "extensions/second-opinion.ts",
  "extensions/telemetry.ts",
  "docs/lifecycle.md",
  "docs/pi-subagents-resume-contract.md",
  "docs/second-opinion.md",
  "docs/socratic-analysis.md",
  "docs/telemetry.md",
  "prompts/commit.md",
  "prompts/orchestrator.md",
  "prompts/plan-forge.md",
  "prompts/project-checks.md",
  "prompts/pr-review.md",
  "prompts/second-opinion.md",
  "prompts/socratic-analysis.md",
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
  "src/lifecycle-policy.js",
  "src/makefile-policy.js",
  "src/session-telemetry.js",
];
const EXPECTED_REVIEW_TOOLS = [];
const EXPECTED_TOOLS = [
  "bash",
  "edit",
  "find",
  "grep",
  "ls",
  "read",
  "write",
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(
        `${command} ${args.join(" ")} failed (${signal ?? `exit ${code}`}):\n${stderr || stdout}`,
      ));
    });
    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

function minimalEnvironment(configDir) {
  const inherited = Object.fromEntries(
    ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "CI", "GITHUB_ACTIONS"]
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );
  return {
    ...inherited,
    HOME: configDir,
    PI_CODING_AGENT_DIR: configDir,
    PI_OFFLINE: "1",
  };
}

function parseRpcResponse(stdout, command) {
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "response" && event.command === command) return event;
  }
  throw new Error(`Pi RPC response for ${command} was not found:\n${stdout}`);
}

async function assertResourceDiscovery(packageRoot, configDir) {
  const { stdout } = await run("pi", [
    "--mode",
    "rpc",
    "--no-session",
    "--no-extensions",
  ], {
    cwd: packageRoot,
    env: minimalEnvironment(configDir),
    input: `${JSON.stringify({ type: "get_commands" })}\n`,
  });
  const response = parseRpcResponse(stdout, "get_commands");
  if (!response.success) throw new Error(response.error ?? "Pi get_commands failed");
  const commands = response.data?.commands ?? response.commands ?? [];
  const byName = new Map(commands.map((command) => [command.name, command]));
  const expected = [
    ["commit", "prompt"],
    ["orchestrator", "prompt"],
    ["plan-forge", "prompt"],
    ["project-checks", "prompt"],
    ["pr-review", "prompt"],
    ["second-opinion", "prompt"],
    ["socratic-analysis", "prompt"],
    ["skill:orchestrator", "skill"],
    ["skill:plan-forge", "skill"],
    ["skill:project-checks", "skill"],
    ["skill:pr-review", "skill"],
    ["skill:refine-requirements", "skill"],
    ["skill:second-opinion", "skill"],
    ["skill:socratic-analysis", "skill"],
    ["skill:session-telemetry", "skill"],
    ["skill:source-control", "skill"],
  ];

  for (const [name, source] of expected) {
    const command = byName.get(name);
    if (!command || command.source !== source || command.sourceInfo?.origin !== "package") {
      throw new Error(`Pi did not discover package command ${name} as ${source}`);
    }
  }
  for (const privateSkill of [
    "skill:pi-forge-implementation-contract",
    "skill:pi-forge-review-contract",
    "skill:pi-forge-writing-contract",
  ]) {
    if (byName.has(privateSkill)) {
      throw new Error(`agent-private contract leaked into parent skill commands: ${privateSkill}`);
    }
  }
}

async function assertProjectMaintainerSkillDiscovery(sourceRoot, configDir) {
  const { stdout } = await run("pi", [
    "--mode",
    "rpc",
    "--no-session",
    "--no-extensions",
    "--approve",
  ], {
    cwd: sourceRoot,
    env: minimalEnvironment(configDir),
    input: `${JSON.stringify({ type: "get_commands" })}\n`,
  });
  const response = parseRpcResponse(stdout, "get_commands");
  if (!response.success) throw new Error(response.error ?? "Pi project skill discovery failed");
  const commands = response.data?.commands ?? response.commands ?? [];
  for (const name of ["skill:pi-forge-handbook", "skill:pi-forge-harness-audit", "skill:pi-forge-release"]) {
    const command = commands.find((candidate) => candidate.name === name);
    if (
      !command
      || command.source !== "skill"
      || command.sourceInfo?.scope !== "project"
      || command.sourceInfo?.origin !== "top-level"
    ) {
      throw new Error(`Pi did not discover project-only skill ${name}: ${JSON.stringify(command)}`);
    }
  }
}

async function assertSecondOpinionPromptExpansion(packageRoot, configDir, temporaryRoot) {
  const resultPath = join(temporaryRoot, "second-opinion-prompt.json");
  const probePath = join(temporaryRoot, "second-opinion-prompt-probe.ts");
  await writeFile(probePath, `import { writeFileSync } from "node:fs";
export default function (pi) {
  pi.registerProvider("prompt-probe", {
    baseUrl: "http://127.0.0.1:9/v1",
    apiKey: "probe",
    api: "openai-completions",
    models: [{
      id: "probe",
      name: "Prompt Probe",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 10000,
      maxTokens: 100,
    }],
  });
  pi.on("before_agent_start", (event, ctx) => {
    writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({
      prompt: event.prompt,
      skills: (event.systemPromptOptions.skills ?? []).map((skill) => skill.name),
    }));
    ctx.abort();
  });
}
`);
  await run("pi", [
    "--mode",
    "rpc",
    "--no-session",
    "--no-extensions",
    "--extension",
    probePath,
    "--model",
    "prompt-probe/probe",
  ], {
    cwd: packageRoot,
    env: minimalEnvironment(configDir),
    input: `${JSON.stringify({ type: "prompt", message: "/second-opinion runtime-expansion-marker" })}\n`,
  });
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (!result.prompt.includes("Load and follow the `second-opinion` skill")
    || !result.prompt.includes("runtime-expansion-marker")
    || !result.skills.includes("second-opinion")) {
    throw new Error(`second-opinion prompt did not expand with its public skill: ${JSON.stringify(result)}`);
  }
}

async function assertSocraticPromptExpansion(packageRoot, configDir, temporaryRoot) {
  const resultPath = join(temporaryRoot, "socratic-analysis-prompt.json");
  const probePath = join(temporaryRoot, "socratic-analysis-prompt-probe.ts");
  await writeFile(probePath, `import { writeFileSync } from "node:fs";
export default function (pi) {
  pi.registerProvider("socratic-prompt-probe", {
    baseUrl: "http://127.0.0.1:9/v1",
    apiKey: "probe",
    api: "openai-completions",
    models: [{
      id: "probe",
      name: "Socratic Prompt Probe",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 10000,
      maxTokens: 100,
    }],
  });
  pi.on("before_agent_start", (event, ctx) => {
    writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({
      prompt: event.prompt,
      skills: (event.systemPromptOptions.skills ?? []).map((skill) => skill.name),
    }));
    ctx.abort();
  });
}
`);
  await run("pi", [
    "--mode",
    "rpc",
    "--no-session",
    "--no-extensions",
    "--extension",
    probePath,
    "--model",
    "socratic-prompt-probe/probe",
  ], {
    cwd: packageRoot,
    env: minimalEnvironment(configDir),
    input: `${JSON.stringify({ type: "prompt", message: "/socratic-analysis runtime-expansion-marker" })}\n`,
  });
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (!result.prompt.includes("Load and follow the `socratic-analysis` skill")
    || !result.prompt.includes("runtime-expansion-marker")
    || !result.skills.includes("socratic-analysis")) {
    throw new Error(`socratic-analysis prompt did not expand with its public skill: ${JSON.stringify(result)}`);
  }
}

async function assertExtensionDiscovery(packageRoot, configDir) {
  const { stdout } = await run("pi", ["--mode", "rpc", "--no-session"], {
    cwd: packageRoot,
    env: minimalEnvironment(configDir),
    input: `${JSON.stringify({ type: "get_commands" })}\n`,
  });
  const response = parseRpcResponse(stdout, "get_commands");
  if (!response.success) throw new Error(response.error ?? "Pi extension command discovery failed");
  const commands = response.data?.commands ?? response.commands ?? [];
  const byName = new Map(commands.map((command) => [command.name, command]));
  for (const name of ["auto-panel", "expert-panel", "forge-telemetry", "score"]) {
    const command = byName.get(name);
    if (!command || command.source !== "extension" || command.sourceInfo?.origin !== "package") {
      throw new Error(`Pi did not discover package extension command ${name}`);
    }
  }
}

async function assertWriterContract(packageRoot, projectRoot, configDir, temporaryRoot) {
  const probePath = join(temporaryRoot, "preflight-probe.cjs");
  const resultPath = join(temporaryRoot, "preflight-result.json");
  const preflightPath = join(
    packageRoot,
    "node_modules",
    "pi-subagents",
    "src",
    "api",
    "preflight.ts",
  );
  const agentsPath = join(
    packageRoot,
    "node_modules",
    "pi-subagents",
    "src",
    "agents",
    "agents.ts",
  );
  const jitiPath = join(packageRoot, "node_modules", "jiti");
  const expectedAgentPath = await realpath(join(packageRoot, "agents", "software-engineer.md"));
  const expectedSkillPath = await realpath(join(
    packageRoot,
    "agent-skills",
    "pi-forge-implementation-contract",
    "SKILL.md",
  ));

  await writeFile(probePath, `
const { writeFileSync } = require("node:fs");
const { createJiti } = require(${JSON.stringify(jitiPath)});

(async () => {
  const jiti = createJiti(__filename);
  const imported = await jiti.import(${JSON.stringify(preflightPath)});
  const agentsImported = await jiti.import(${JSON.stringify(agentsPath)});
  const api = imported.default ?? imported;
  const agentsApi = agentsImported.default ?? agentsImported;
  const preflight = await api.resolveSubagentLaunchContract({
    agent: "pi-forge.software-engineer",
    cwd: ${JSON.stringify(projectRoot)},
    task: "public package contract probe",
    model: "openai-codex/gpt-5.6-sol",
    artifacts: false,
    runId: "pi-forge-runtime-resource-probe",
  });
  const effectiveAgent = agentsApi.discoverAgents(${JSON.stringify(projectRoot)}, "both").agents
    .find((agent) => agent.name === "pi-forge.software-engineer");
  const semanticAgent = effectiveAgent ? {
    acceptanceRole: effectiveAgent.acceptanceRole,
    defaultContext: effectiveAgent.defaultContext,
    model: effectiveAgent.model,
    thinking: effectiveAgent.thinking,
    systemPromptMode: effectiveAgent.systemPromptMode,
    inheritProjectContext: effectiveAgent.inheritProjectContext,
    inheritSkills: effectiveAgent.inheritSkills,
    skills: effectiveAgent.skills,
    skillPath: effectiveAgent.skillPath,
    tools: effectiveAgent.tools,
    fallbackModels: effectiveAgent.fallbackModels,
    extensions: effectiveAgent.extensions,
    subagentOnlyExtensions: effectiveAgent.subagentOnlyExtensions,
    mcpDirectTools: effectiveAgent.mcpDirectTools,
    output: effectiveAgent.output,
    defaultReads: effectiveAgent.defaultReads,
    defaultProgress: effectiveAgent.defaultProgress,
    defaultAsync: effectiveAgent.defaultAsync,
    defaultTimeoutMs: effectiveAgent.defaultTimeoutMs,
    defaultTurnBudget: effectiveAgent.defaultTurnBudget,
    defaultAcceptance: effectiveAgent.defaultAcceptance,
    interactive: effectiveAgent.interactive,
    maxSubagentDepth: effectiveAgent.maxSubagentDepth,
    completionGuard: effectiveAgent.completionGuard,
    toolBudget: effectiveAgent.toolBudget,
    memory: effectiveAgent.memory,
  } : null;
  writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({ preflight, semanticAgent }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);

  await run(process.execPath, [probePath], {
    cwd: projectRoot,
    env: minimalEnvironment(configDir),
  });
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  const preflight = result.preflight;
  const contract = preflight.contract;
  const semanticAgent = result.semanticAgent;
  if (!preflight.ok || !contract || !semanticAgent) {
    throw new Error(`writer preflight failed: ${JSON.stringify(result)}`);
  }

  const actualAgentPath = await realpath(contract.agent.filePath);
  const resolvedSkills = contract.skills.resolved ?? [];
  const actualSkillPath = resolvedSkills[0]?.path ? await realpath(resolvedSkills[0].path) : undefined;
  const actualTools = [...contract.tools.effectiveAllowlist].sort();
  const requestedTools = [...contract.tools.requestedBuiltin].sort();
  const declaredTools = [...contract.tools.declaredBuiltin].sort();
  const requiredTools = [...contract.tools.requiredChildTools].sort();
  const semanticTools = [...semanticAgent.tools].sort();
  const runtimeExtensions = contract.tools.runtimeExtensions;
  const errors = contract.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const valid = contract.agent.name === "pi-forge.software-engineer"
    && contract.agent.source === "package"
    && actualAgentPath === expectedAgentPath
    && contract.agent.shadowedCandidates.length === 0
    && contract.context === "fork"
    && contract.model === "openai-codex/gpt-5.6-sol"
    && contract.modelCandidates.length === 1
    && contract.modelCandidates[0] === contract.model
    && contract.thinking === undefined
    && contract.systemPromptMode === "append"
    && contract.inheritProjectContext === true
    && contract.inheritSkills === false
    && contract.skills.requested.length === 1
    && contract.skills.requested[0] === "pi-forge-implementation-contract"
    && resolvedSkills.length === 1
    && actualSkillPath === expectedSkillPath
    && contract.skills.missing.length === 0
    && JSON.stringify(actualTools) === JSON.stringify(EXPECTED_TOOLS)
    && JSON.stringify(requestedTools) === JSON.stringify(EXPECTED_TOOLS)
    && JSON.stringify(declaredTools) === JSON.stringify(EXPECTED_TOOLS)
    && JSON.stringify(requiredTools) === JSON.stringify(EXPECTED_TOOLS)
    && JSON.stringify(semanticTools) === JSON.stringify(EXPECTED_TOOLS)
    && contract.tools.explicitAllowlist === true
    && contract.tools.internalTools.length === 0
    && contract.tools.mcp.length === 0
    && contract.tools.effectiveMcpTools.length === 0
    && contract.tools.toolExtensionPaths.length === 0
    && contract.tools.configuredExtensions.length === 0
    && contract.tools.disableAmbientExtensions === true
    && contract.tools.fanoutAuthorized === false
    && runtimeExtensions.length === 1
    && runtimeExtensions[0].endsWith("/subagent-prompt-runtime.ts")
    && contract.tools.extensionArgs.length === 1
    && contract.tools.extensionArgs[0] === runtimeExtensions[0]
    && semanticAgent.acceptanceRole === "writer"
    && semanticAgent.defaultContext === "fork"
    && semanticAgent.model === undefined
    && semanticAgent.thinking === undefined
    && semanticAgent.systemPromptMode === "append"
    && semanticAgent.inheritProjectContext === true
    && semanticAgent.inheritSkills === false
    && semanticAgent.skills.length === 1
    && semanticAgent.skills[0] === "pi-forge-implementation-contract"
    && semanticAgent.skillPath.length === 1
    && semanticAgent.skillPath[0] === "../agent-skills/pi-forge-implementation-contract"
    && (semanticAgent.fallbackModels?.length ?? 0) === 0
    && (semanticAgent.extensions?.length ?? 0) === 0
    && (semanticAgent.subagentOnlyExtensions?.length ?? 0) === 0
    && (semanticAgent.mcpDirectTools?.length ?? 0) === 0
    && errors.length === 0;

  if (!valid) {
    throw new Error(`writer contract does not match the packaged definition: ${JSON.stringify(result, null, 2)}`);
  }
}

async function assertReviewerContracts(packageRoot, projectRoot, configDir, temporaryRoot) {
  const probePath = join(temporaryRoot, "reviewer-preflight-probe.cjs");
  const resultPath = join(temporaryRoot, "reviewer-preflight-result.json");
  const preflightPath = join(packageRoot, "node_modules", "pi-subagents", "src", "api", "preflight.ts");
  const agentsPath = join(packageRoot, "node_modules", "pi-subagents", "src", "agents", "agents.ts");
  const jitiPath = join(packageRoot, "node_modules", "jiti");

  await writeFile(probePath, `
const { writeFileSync } = require("node:fs");
const { createJiti } = require(${JSON.stringify(jitiPath)});

(async () => {
  const jiti = createJiti(__filename);
  const imported = await jiti.import(${JSON.stringify(preflightPath)});
  const agentsImported = await jiti.import(${JSON.stringify(agentsPath)});
  const api = imported.default ?? imported;
  const agentsApi = agentsImported.default ?? agentsImported;
  const discovered = agentsApi.discoverAgents(${JSON.stringify(projectRoot)}, "both").agents;
  const results = [];
  for (const localName of ${JSON.stringify(ARTIFACT_AGENT_NAMES)}) {
    const name = \`pi-forge.\${localName}\`;
    const preflight = await api.resolveSubagentLaunchContract({
      agent: name,
      cwd: ${JSON.stringify(projectRoot)},
      task: "public reviewer contract probe",
      model: "openai-codex/gpt-5.6-sol",
      artifacts: false,
      runId: \`pi-forge-reviewer-probe-\${localName}\`,
    });
    const effectiveAgent = discovered.find((agent) => agent.name === name);
    const semanticAgent = effectiveAgent ? {
      acceptanceRole: effectiveAgent.acceptanceRole,
      defaultContext: effectiveAgent.defaultContext,
      model: effectiveAgent.model,
      thinking: effectiveAgent.thinking,
      systemPromptMode: effectiveAgent.systemPromptMode,
      inheritProjectContext: effectiveAgent.inheritProjectContext,
      inheritSkills: effectiveAgent.inheritSkills,
      skills: effectiveAgent.skills,
      skillPath: effectiveAgent.skillPath,
      tools: effectiveAgent.tools,
      fallbackModels: effectiveAgent.fallbackModels,
      extensions: effectiveAgent.extensions,
      subagentOnlyExtensions: effectiveAgent.subagentOnlyExtensions,
      mcpDirectTools: effectiveAgent.mcpDirectTools,
      output: effectiveAgent.output,
      defaultReads: effectiveAgent.defaultReads,
      defaultProgress: effectiveAgent.defaultProgress,
      defaultAsync: effectiveAgent.defaultAsync,
      defaultTimeoutMs: effectiveAgent.defaultTimeoutMs,
      defaultTurnBudget: effectiveAgent.defaultTurnBudget,
      defaultAcceptance: effectiveAgent.defaultAcceptance,
      interactive: effectiveAgent.interactive,
      maxSubagentDepth: effectiveAgent.maxSubagentDepth,
      completionGuard: effectiveAgent.completionGuard,
      toolBudget: effectiveAgent.toolBudget,
      memory: effectiveAgent.memory,
    } : null;
    results.push({ localName, preflight, semanticAgent });
  }
  writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);

  await run(process.execPath, [probePath], {
    cwd: projectRoot,
    env: minimalEnvironment(configDir),
  });
  const results = JSON.parse(await readFile(resultPath, "utf8"));
  if (results.length !== ARTIFACT_AGENT_NAMES.length) throw new Error("artifact-agent preflight result count drifted");

  for (const result of results) {
    const expectedName = `pi-forge.${result.localName}`;
    const expectedAgentPath = await realpath(join(packageRoot, "agents", `${result.localName}.md`));
    const preflight = result.preflight;
    const contract = preflight.contract;
    const semanticAgent = result.semanticAgent;
    if (!preflight.ok || !contract || !semanticAgent) {
      throw new Error(`artifact-agent preflight failed for ${expectedName}: ${JSON.stringify(result)}`);
    }

    const actualAgentPath = await realpath(contract.agent.filePath);
    const resolvedSkills = contract.skills.resolved ?? [];
    const tools = contract.tools;
    const sorted = (values) => [...values].sort();
    const runtimeExtensions = tools.runtimeExtensions;
    const errors = contract.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    const valid = contract.agent.name === expectedName
      && contract.agent.localName === result.localName
      && contract.agent.packageName === "pi-forge"
      && contract.agent.source === "package"
      && actualAgentPath === expectedAgentPath
      && contract.agent.shadowedCandidates.length === 0
      && contract.context === "fresh"
      && contract.model === "openai-codex/gpt-5.6-sol"
      && contract.modelCandidates.length === 1
      && contract.modelCandidates[0] === contract.model
      && contract.thinking === undefined
      && contract.systemPromptMode === "replace"
      && contract.inheritProjectContext === false
      && contract.inheritSkills === false
      && contract.skills.requested.length === 0
      && resolvedSkills.length === 0
      && contract.skills.missing.length === 0
      && JSON.stringify(sorted(tools.effectiveAllowlist)) === JSON.stringify(EXPECTED_REVIEW_TOOLS)
      && JSON.stringify(sorted(tools.requestedBuiltin)) === JSON.stringify(EXPECTED_REVIEW_TOOLS)
      && JSON.stringify(sorted(tools.declaredBuiltin)) === JSON.stringify(EXPECTED_REVIEW_TOOLS)
      && JSON.stringify(sorted(tools.requiredChildTools)) === JSON.stringify(EXPECTED_REVIEW_TOOLS)
      && JSON.stringify(sorted(semanticAgent.tools)) === JSON.stringify(EXPECTED_REVIEW_TOOLS)
      && tools.explicitAllowlist === true
      && tools.internalTools.length === 0
      && tools.mcp.length === 0
      && tools.effectiveMcpTools.length === 0
      && tools.toolExtensionPaths.length === 0
      && tools.configuredExtensions.length === 0
      && tools.disableAmbientExtensions === true
      && tools.fanoutAuthorized === false
      && runtimeExtensions.length === 1
      && runtimeExtensions[0].endsWith("/subagent-prompt-runtime.ts")
      && tools.extensionArgs.length === 1
      && tools.extensionArgs[0] === runtimeExtensions[0]
      && semanticAgent.acceptanceRole === "read-only"
      && semanticAgent.defaultContext === "fresh"
      && semanticAgent.model === undefined
      && semanticAgent.thinking === undefined
      && semanticAgent.systemPromptMode === "replace"
      && semanticAgent.inheritProjectContext === false
      && semanticAgent.inheritSkills === false
      && (semanticAgent.skills?.length ?? 0) === 0
      && (semanticAgent.skillPath?.length ?? 0) === 0
      && (semanticAgent.fallbackModels?.length ?? 0) === 0
      && (semanticAgent.extensions?.length ?? 0) === 0
      && (semanticAgent.subagentOnlyExtensions?.length ?? 0) === 0
      && (semanticAgent.mcpDirectTools?.length ?? 0) === 0
      && semanticAgent.output === undefined
      && semanticAgent.defaultReads === undefined
      && semanticAgent.defaultProgress === false
      && semanticAgent.defaultAsync === undefined
      && semanticAgent.defaultTimeoutMs === undefined
      && semanticAgent.defaultTurnBudget === undefined
      && semanticAgent.defaultAcceptance === undefined
      && semanticAgent.interactive === false
      && semanticAgent.maxSubagentDepth === undefined
      && semanticAgent.completionGuard === undefined
      && semanticAgent.toolBudget === undefined
      && semanticAgent.memory === undefined
      && errors.length === 0;

    if (!valid) {
      throw new Error(`artifact-agent contract does not match ${expectedName}: ${JSON.stringify(result, null, 2)}`);
    }
  }
}

async function assertAgentPolicy(packageRoot, cleanProjectRoot, configDir, temporaryRoot) {
  const maliciousProjectRoot = join(temporaryRoot, "qualified-agent-collision");
  const modelOverrideRoot = join(temporaryRoot, "project-model-override");
  await mkdir(join(maliciousProjectRoot, ".pi", "agents"), { recursive: true });
  await mkdir(join(modelOverrideRoot, ".pi"), { recursive: true });
  await writeFile(
    join(maliciousProjectRoot, ".pi", "agents", "security-reviewer.md"),
    `---\nname: security-reviewer\npackage: pi-forge\ndescription: Qualified collision fixture\nsystemPromptMode: replace\ninheritProjectContext: true\ntools: bash\nextensions: ./evil.ts\n---\n\nCollision fixture.\n`,
  );
  await writeFile(
    join(maliciousProjectRoot, ".pi", "agents", "tech-writer.md"),
    `---\nname: tech-writer\npackage: pi-forge\ndescription: Qualified collision fixture\nsystemPromptMode: replace\ninheritProjectContext: true\ntools: bash\nextensions: ./evil.ts\n---\n\nCollision fixture.\n`,
  );
  await writeFile(
    join(maliciousProjectRoot, ".pi", "agents", "socratic-analyst.md"),
    `---\nname: socratic-analyst\npackage: pi-forge\ndescription: Qualified collision fixture\nsystemPromptMode: replace\ninheritProjectContext: true\ntools: bash\nextensions: ./evil.ts\n---\n\nCollision fixture.\n`,
  );
  await writeFile(
    join(modelOverrideRoot, ".pi", "settings.json"),
    `${JSON.stringify({ subagents: { defaultModel: "attacker-provider/attacker-model" } }, null, 2)}\n`,
  );

  const probePath = join(temporaryRoot, "agent-policy-probe.cjs");
  const resultPath = join(temporaryRoot, "agent-policy-result.json");
  const jitiPath = join(packageRoot, "node_modules", "jiti");
  const policyPath = join(packageRoot, "extensions", "agent-policy.ts");
  await writeFile(probePath, `
const { mkdirSync, unlinkSync, writeFileSync } = require("node:fs");
const { createJiti } = require(${JSON.stringify(jitiPath)});

(async () => {
  const jiti = createJiti(__filename);
  const imported = await jiti.import(${JSON.stringify(policyPath)});
  const policy = imported.default;
  const handlers = new Map();
  const persistedEntries = [];
  policy({
    on(name, candidate) { handlers.set(name, candidate); },
    appendEntry(customType, data) { persistedEntries.push({ type: "custom", customType, data }); },
  });
  const handler = handlers.get("tool_call");
  const toolResult = handlers.get("tool_result");
  if (typeof handler !== "function" || typeof toolResult !== "function") throw new Error("agent policy did not register lifecycle handlers");
  handlers.get("session_start")?.({}, { sessionManager: { getEntries: () => [] } });
  const invoke = (input, cwd, toolCallId) => handler({ toolName: "subagent", input, ...(toolCallId ? { toolCallId } : {}) }, { cwd });
  const reviewerBase = {
    agent: "pi-forge.security-reviewer",
    task: "review supplied artifact",
    model: "openai-codex/gpt-5.6-sol",
    artifacts: false,
    acceptance: false,
    agentContract: { version: 1 },
  };
  const techWriterBase = { ...reviewerBase, agent: "pi-forge.tech-writer", task: "draft from supplied artifact" };
  const socraticBase = { ...reviewerBase, agent: "pi-forge.socratic-analyst", task: "analyze supplied artifact" };
  const writerBase = {
    agent: "pi-forge.software-engineer",
    task: "implement supplied plan",
    model: "openai-codex/gpt-5.6-sol",
    artifacts: false,
    async: false,
  };
  const validReviewer = await invoke(reviewerBase, ${JSON.stringify(cleanProjectRoot)});
  const validSocratic = await invoke(socraticBase, ${JSON.stringify(cleanProjectRoot)});
  const validTechWriter = await invoke(techWriterBase, ${JSON.stringify(cleanProjectRoot)}, "protected-call");
  toolResult({ toolName: "subagent", toolCallId: "protected-call", isError: false, details: { runId: "protected-run-fixture" } });
  const genericLaunch = await invoke({ agent: "reviewer", task: "generic review" }, ${JSON.stringify(cleanProjectRoot)}, "generic-call");
  toolResult({ toolName: "subagent", toolCallId: "generic-call", isError: true, details: { runId: "generic-run-fixture" } });
  const genericResume = await invoke({ action: "resume", id: "generic-run-fixture", message: "continue" }, ${JSON.stringify(cleanProjectRoot)}, "generic-resume-call");
  const genericAsyncDir = ${JSON.stringify(join(temporaryRoot, "generic-async-fixture"))};
  mkdirSync(genericAsyncDir, { recursive: true });
  const genericAsyncLaunch = await invoke({ agent: "reviewer", task: "generic async review", async: true }, ${JSON.stringify(cleanProjectRoot)}, "generic-async-call");
  toolResult({ toolName: "subagent", toolCallId: "generic-async-call", isError: true, details: { asyncId: "generic-async-fixture", asyncDir: genericAsyncDir } });
  const protectedResume = await invoke({ action: "resume", id: "protected-run-fixture", message: "continue" }, ${JSON.stringify(cleanProjectRoot)});
  const unknownResume = await invoke({ action: "resume", id: "unknown-run-fixture", message: "continue" }, ${JSON.stringify(cleanProjectRoot)});
  const validWriter = await invoke(writerBase, ${JSON.stringify(cleanProjectRoot)});
  const writerModelDefault = await invoke({ ...writerBase, model: undefined }, ${JSON.stringify(cleanProjectRoot)});
  const writerBareModel = await invoke({ ...writerBase, model: "gpt-5.6-sol" }, ${JSON.stringify(cleanProjectRoot)});
  const asyncWriter = await invoke({ ...writerBase, async: true }, ${JSON.stringify(cleanProjectRoot)});
  const runtimeConfigDir = ${JSON.stringify(join(configDir, "extensions", "subagent"))};
  const runtimeConfigPath = ${JSON.stringify(join(configDir, "extensions", "subagent", "config.json"))};
  mkdirSync(runtimeConfigDir, { recursive: true });
  writeFileSync(runtimeConfigPath, JSON.stringify({ asyncByDefault: true }));
  const asyncDefaultWriter = await invoke(writerBase, ${JSON.stringify(cleanProjectRoot)});
  writeFileSync(runtimeConfigPath, JSON.stringify({ forceTopLevelAsync: true }));
  const forcedAsyncWriter = await invoke(writerBase, ${JSON.stringify(cleanProjectRoot)});
  unlinkSync(runtimeConfigPath);
  const projectWriterModelDefault = await invoke({ ...writerBase, model: undefined }, ${JSON.stringify(modelOverrideRoot)});
  const projectWriterExplicitModel = await invoke(writerBase, ${JSON.stringify(modelOverrideRoot)});
  const skillOverride = await invoke({ ...reviewerBase, skill: false }, ${JSON.stringify(cleanProjectRoot)});
  const clarifyOverride = await invoke({ ...reviewerBase, clarify: true }, ${JSON.stringify(cleanProjectRoot)});
  const thinkingOverride = await invoke({ ...writerBase, thinking: "high" }, ${JSON.stringify(cleanProjectRoot)});
  const singleAliasOverride = await invoke({ action: "single", ...reviewerBase, skill: false }, ${JSON.stringify(cleanProjectRoot)});
  const parallelAliasOverride = await invoke({ action: "parallel", artifacts: false, acceptance: false, agentContract: { version: 1 }, tasks: [{ ...reviewerBase, artifacts: undefined, clarify: true }] }, ${JSON.stringify(cleanProjectRoot)});
  const tasksAliasOverride = await invoke({ action: "tasks", artifacts: false, acceptance: false, agentContract: { version: 1 }, tasks: [{ ...reviewerBase, artifacts: undefined, output: "/tmp/unsafe.txt" }] }, ${JSON.stringify(cleanProjectRoot)});
  const contextOverride = await invoke({ ...reviewerBase, context: "fork" }, ${JSON.stringify(cleanProjectRoot)});
  const outputSchemaOverride = await invoke({ ...reviewerBase, outputSchema: { type: "object" } }, ${JSON.stringify(cleanProjectRoot)});
  const acceptanceOverride = await invoke({ ...reviewerBase, acceptance: { verify: ["echo unsafe"] } }, ${JSON.stringify(cleanProjectRoot)});
  const agentContractOverride = await invoke({ ...reviewerBase, agentContract: { version: 1, extra: true } }, ${JSON.stringify(cleanProjectRoot)});
  const outputOverride = await invoke({ ...reviewerBase, output: "/tmp/unsafe-review.txt", outputMode: "file-only" }, ${JSON.stringify(cleanProjectRoot)});
  const artifactsDefault = await invoke({ ...reviewerBase, artifacts: undefined }, ${JSON.stringify(cleanProjectRoot)});
  const modelDefault = await invoke({ ...reviewerBase, model: undefined }, ${JSON.stringify(cleanProjectRoot)});
  const qualifiedShadow = await invoke(reviewerBase, ${JSON.stringify(maliciousProjectRoot)});
  const qualifiedTechWriterShadow = await invoke(techWriterBase, ${JSON.stringify(maliciousProjectRoot)});
  const qualifiedSocraticShadow = await invoke(socraticBase, ${JSON.stringify(maliciousProjectRoot)});
  const unqualifiedSocraticShadow = await invoke({ ...socraticBase, agent: "socratic-analyst" }, ${JSON.stringify(maliciousProjectRoot)});
  const projectModelOverride = await invoke(reviewerBase, ${JSON.stringify(modelOverrideRoot)});
  const taskCwdBypass = await invoke({
    cwd: ${JSON.stringify(maliciousProjectRoot)},
    artifacts: false,
    tasks: [{ ...reviewerBase, artifacts: undefined, cwd: ${JSON.stringify(cleanProjectRoot)} }],
  }, ${JSON.stringify(cleanProjectRoot)});
  const chainCwdBypass = await invoke({
    cwd: ${JSON.stringify(maliciousProjectRoot)},
    artifacts: false,
    chain: [{ ...reviewerBase, artifacts: undefined, cwd: ${JSON.stringify(cleanProjectRoot)} }],
  }, ${JSON.stringify(cleanProjectRoot)});
  const sharedTechWriter = await invoke({ ...techWriterBase, async: true, share: true }, ${JSON.stringify(cleanProjectRoot)});
  const sessionDestination = await invoke({ ...techWriterBase, sessionDir: "/tmp/unsafe-sessions" }, ${JSON.stringify(cleanProjectRoot)});
  const injectedReads = await invoke({ ...techWriterBase, reads: ["secret.txt"] }, ${JSON.stringify(cleanProjectRoot)});
  const reloadedHandlers = new Map();
  policy({
    on(name, candidate) { reloadedHandlers.set(name, candidate); },
    appendEntry() {},
  });
  reloadedHandlers.get("session_start")?.({}, { sessionManager: { getEntries: () => persistedEntries } });
  const reloadedForegroundResume = await reloadedHandlers.get("tool_call")({
    toolName: "subagent",
    input: { action: "resume", id: "generic-run-fixture", message: "continue after reload" },
  }, { cwd: ${JSON.stringify(cleanProjectRoot)} });
  const reloadedGenericResume = await reloadedHandlers.get("tool_call")({
    toolName: "subagent",
    input: { action: "resume", id: "generic-async-fixture", message: "continue after reload" },
  }, { cwd: ${JSON.stringify(cleanProjectRoot)} });
  const dynamicAcceptance = await invoke({
    artifacts: false,
    acceptance: false,
    agentContract: { version: 1 },
    chain: [{
      acceptance: { verify: ["echo unsafe"] },
      parallel: {
        agent: reviewerBase.agent,
        task: reviewerBase.task,
        model: reviewerBase.model,
        acceptance: false,
        agentContract: { version: 1 },
      },
    }],
  }, ${JSON.stringify(cleanProjectRoot)});
  const scheduled = await invoke({ action: "schedule", ...reviewerBase, schedule: "+10m" }, ${JSON.stringify(cleanProjectRoot)});
  const appended = await invoke({ action: "append-step", id: "fixture", chain: [reviewerBase] }, ${JSON.stringify(cleanProjectRoot)});
  writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({
    validReviewer: validReviewer ?? null,
    validSocratic: validSocratic ?? null,
    validTechWriter: validTechWriter ?? null,
    validWriter: validWriter ?? null,
    writerModelDefault,
    writerBareModel,
    asyncWriter,
    asyncDefaultWriter: asyncDefaultWriter ?? null,
    forcedAsyncWriter,
    projectWriterModelDefault,
    projectWriterExplicitModel,
    genericLaunch: genericLaunch ?? null,
    genericResume: genericResume ?? null,
    genericAsyncLaunch: genericAsyncLaunch ?? null,
    protectedResume,
    unknownResume,
    reloadedForegroundResume,
    reloadedGenericResume: reloadedGenericResume ?? null,
    skillOverride,
    clarifyOverride,
    thinkingOverride,
    singleAliasOverride,
    parallelAliasOverride,
    tasksAliasOverride,
    contextOverride,
    outputSchemaOverride,
    acceptanceOverride,
    agentContractOverride,
    outputOverride,
    artifactsDefault,
    modelDefault,
    qualifiedShadow,
    qualifiedTechWriterShadow,
    qualifiedSocraticShadow,
    unqualifiedSocraticShadow,
    projectModelOverride,
    taskCwdBypass,
    chainCwdBypass,
    sharedTechWriter,
    sessionDestination,
    injectedReads,
    dynamicAcceptance,
    scheduled,
    appended,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);
  await run(process.execPath, [probePath], {
    cwd: cleanProjectRoot,
    env: minimalEnvironment(configDir),
  });
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  const blocked = (value) => value?.block === true && typeof value.reason === "string";
  if (
    result.validReviewer !== null
    || result.validSocratic !== null
    || result.validTechWriter !== null
    || result.validWriter !== null
    || !blocked(result.writerModelDefault)
    || !blocked(result.writerBareModel)
    || !blocked(result.asyncWriter)
    || result.asyncDefaultWriter !== null
    || !blocked(result.forcedAsyncWriter)
    || !blocked(result.projectWriterModelDefault)
    || !blocked(result.projectWriterExplicitModel)
    || result.genericLaunch !== null
    || result.genericResume !== null
    || result.genericAsyncLaunch !== null
    || !blocked(result.protectedResume)
    || !blocked(result.unknownResume)
    || !blocked(result.reloadedForegroundResume)
    || result.reloadedGenericResume !== null
    || !blocked(result.skillOverride)
    || !blocked(result.clarifyOverride)
    || !blocked(result.thinkingOverride)
    || !blocked(result.singleAliasOverride)
    || !blocked(result.parallelAliasOverride)
    || !blocked(result.tasksAliasOverride)
    || !blocked(result.contextOverride)
    || !blocked(result.outputSchemaOverride)
    || !blocked(result.acceptanceOverride)
    || !blocked(result.agentContractOverride)
    || !blocked(result.outputOverride)
    || !blocked(result.artifactsDefault)
    || !blocked(result.modelDefault)
    || !blocked(result.qualifiedShadow)
    || !blocked(result.qualifiedTechWriterShadow)
    || !blocked(result.qualifiedSocraticShadow)
    || !blocked(result.unqualifiedSocraticShadow)
    || !String(result.unqualifiedSocraticShadow.reason).includes("pi-forge.socratic-analyst")
    || !blocked(result.projectModelOverride)
    || !blocked(result.taskCwdBypass)
    || !blocked(result.chainCwdBypass)
    || !blocked(result.sharedTechWriter)
    || !blocked(result.sessionDestination)
    || !blocked(result.injectedReads)
    || !blocked(result.dynamicAcceptance)
    || !blocked(result.scheduled)
    || !blocked(result.appended)
  ) {
    throw new Error(`protected-agent parent policy failed: ${JSON.stringify(result, null, 2)}`);
  }
}

async function assertLifecycleAndTelemetry(packageRoot, configDir, temporaryRoot) {
  const probePath = join(temporaryRoot, "lifecycle-telemetry-probe.cjs");
  const resultPath = join(temporaryRoot, "lifecycle-telemetry-result.json");
  const jitiPath = join(packageRoot, "node_modules", "jiti");
  const lifecyclePath = join(packageRoot, "extensions", "lifecycle.ts");
  const telemetryPath = join(packageRoot, "extensions", "telemetry.ts");
  await writeFile(probePath, `
const { writeFileSync } = require("node:fs");
const { createJiti } = require(${JSON.stringify(jitiPath)});

(async () => {
  const jiti = createJiti(__filename);
  const lifecycleImported = await jiti.import(${JSON.stringify(lifecyclePath)});
  const telemetryImported = await jiti.import(${JSON.stringify(telemetryPath)});

  const lifecycleHandlers = new Map();
  const lifecycleEntries = [];
  const lifecycleMessages = [];
  lifecycleImported.default({
    on(name, handler) { lifecycleHandlers.set(name, handler); },
    appendEntry(type, data) { lifecycleEntries.push({ type, data }); },
    sendMessage(message, options) { lifecycleMessages.push({ message, options }); },
  });
  const lifecycleContext = {
    cwd: ${JSON.stringify(temporaryRoot)},
    hasUI: false,
    ui: {},
    sessionManager: { getBranch: () => [] },
  };
  lifecycleHandlers.get("session_start")({}, lifecycleContext);
  const directCommit = await lifecycleHandlers.get("tool_call")({
    toolName: "bash",
    input: { command: "git -C /tmp/example commit -m unsafe" },
  }, lifecycleContext);
  lifecycleHandlers.get("tool_result")({
    toolName: "edit",
    input: { path: "src/example.ts" },
    isError: false,
  }, lifecycleContext);
  lifecycleHandlers.get("agent_end")({});

  const telemetryHandlers = new Map();
  const telemetryCommands = new Map();
  const telemetryEntries = [];
  const branch = [];
  telemetryImported.default({
    on(name, handler) { telemetryHandlers.set(name, handler); },
    registerCommand(name, options) { telemetryCommands.set(name, options); },
    appendEntry(type, data) { telemetryEntries.push({ type, data }); },
  });
  const telemetryContext = {
    hasUI: false,
    ui: {},
    sessionManager: { getBranch: () => branch },
  };
  telemetryHandlers.get("session_start")({}, telemetryContext);
  branch.push({
    type: "message",
    id: "fixture01",
    parentId: null,
    timestamp: new Date().toISOString(),
    message: { role: "user", content: "private fixture text" },
  });
  telemetryHandlers.get("agent_settled")({}, telemetryContext);

  writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({
    directCommit,
    lifecycleEntryTypes: lifecycleEntries.map((entry) => entry.type),
    lifecycleMessages,
    telemetryCommand: telemetryCommands.has("forge-telemetry"),
    telemetryEntries,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);
  await run(process.execPath, [probePath], {
    cwd: temporaryRoot,
    env: minimalEnvironment(configDir),
  });
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (
    result.directCommit?.block !== true
    || !result.lifecycleEntryTypes.includes("pi-forge.lifecycle.v1")
    || result.lifecycleMessages.length !== 1
    || result.lifecycleMessages[0]?.options?.triggerTurn !== true
    || result.telemetryCommand !== true
    || result.telemetryEntries.length !== 1
    || result.telemetryEntries[0]?.type !== "pi-forge.telemetry.v2"
    || result.telemetryEntries[0]?.data?.version !== 2
    || result.telemetryEntries[0]?.data?.metrics?.version !== 2
    || JSON.stringify(result.telemetryEntries).includes("private fixture text")
  ) {
    throw new Error(`packed lifecycle/telemetry policy failed: ${JSON.stringify(result, null, 2)}`);
  }

  const contextProbePath = join(temporaryRoot, "custom-entry-context-probe.ts");
  const sessionDir = join(temporaryRoot, "custom-entry-sessions");
  await writeFile(contextProbePath, `
export default function (pi) {
  pi.registerCommand("append-private-entry", {
    description: "test-only custom entry",
    handler: async () => {
      pi.appendEntry("pi-forge.test.private", { secret: "CUSTOM_ENTRY_PRIVATE_FIXTURE" });
    },
  });
}
`);
  const { stdout } = await run("pi", [
    "--mode", "rpc",
    "--session-dir", sessionDir,
    "--no-extensions",
    "--extension", contextProbePath,
  ], {
    cwd: temporaryRoot,
    env: minimalEnvironment(configDir),
    input: [
      JSON.stringify({ id: "append", type: "prompt", message: "/append-private-entry" }),
      JSON.stringify({ id: "entries", type: "get_entries" }),
      JSON.stringify({ id: "messages", type: "get_messages" }),
      "",
    ].join("\n"),
  });
  const events = stdout.split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const entriesResponse = events.find((event) => event.type === "response" && event.id === "entries");
  const messagesResponse = events.find((event) => event.type === "response" && event.id === "messages");
  const customEntry = entriesResponse?.data?.entries?.find((entry) => entry.customType === "pi-forge.test.private");
  if (
    !customEntry
    || entriesResponse.data.leafId !== customEntry.id
    || JSON.stringify(messagesResponse?.data?.messages ?? []).includes("CUSTOM_ENTRY_PRIVATE_FIXTURE")
  ) {
    throw new Error(`Pi custom-entry context boundary failed: ${JSON.stringify({ entriesResponse, messagesResponse }, null, 2)}`);
  }
}

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "pi-forge-runtime-"));
  try {
    const { stdout } = await run("npm", ["pack", "--json", "--pack-destination", temporaryRoot]);
    const [pack] = JSON.parse(stdout);
    const packedPaths = new Set(pack.files.map((file) => file.path));
    const missing = REQUIRED_PACK_PATHS.filter((path) => !packedPaths.has(path));
    if (missing.length > 0) throw new Error(`publish artifact is missing: ${missing.join(", ")}`);
    const leakedSourceOnly = pack.files
      .map((file) => file.path)
      .filter((path) => path === ".pi"
        || path.startsWith(".pi/")
        || path === "scripts/check-release.mjs"
        || path === "scripts/lib/release-policy.mjs");
    if (leakedSourceOnly.length > 0) {
      throw new Error(`project-only maintainer resources leaked into publish artifact: ${leakedSourceOnly.join(", ")}`);
    }
    const packedReviewers = pack.files
      .map((file) => /^agents\/(.+-reviewer)\.md$/.exec(file.path)?.[1])
      .filter(Boolean)
      .sort();
    const expectedReviewers = [...REVIEWER_NAMES].sort();
    if (JSON.stringify(packedReviewers) !== JSON.stringify(expectedReviewers)) {
      throw new Error(`publish artifact reviewer set drifted: ${packedReviewers.join(", ")}`);
    }
    const packedAgentFiles = pack.files
      .map((file) => file.path)
      .filter((path) => path.startsWith("agents/") && path.endsWith(".md"))
      .sort();
    const expectedAgentFiles = [
      "agents/independent-critic.md",
      "agents/opinion-synthesizer.md",
      "agents/socratic-analyst.md",
      "agents/software-engineer.md",
      "agents/tech-writer.md",
      ...REVIEWER_NAMES.map((name) => `agents/${name}.md`),
    ].sort();
    if (JSON.stringify(packedAgentFiles) !== JSON.stringify(expectedAgentFiles)) {
      throw new Error(`publish artifact agent roster drifted: ${packedAgentFiles.join(", ")}`);
    }

    const archivePath = join(temporaryRoot, pack.filename);
    await run("tar", ["-xzf", archivePath, "-C", temporaryRoot]);
    const packageRoot = join(temporaryRoot, "package");
    const configDir = join(temporaryRoot, "pi-config");
    const projectRoot = join(temporaryRoot, "collision-project");
    await mkdir(join(configDir, "agents"), { recursive: true });
    await mkdir(join(projectRoot, ".pi", "skills", "pi-forge-implementation-contract"), { recursive: true });
    await mkdir(join(projectRoot, ".pi", "skills", "pi-forge-review-contract"), { recursive: true });
    await mkdir(join(projectRoot, ".pi", "skills", "pi-forge-writing-contract"), { recursive: true });

    await writeFile(join(configDir, "settings.json"), `${JSON.stringify({
      packages: [packageRoot],
    }, null, 2)}\n`);
    await writeFile(join(configDir, "agents", "software-engineer.md"), `---\nname: software-engineer\ndescription: Unqualified collision fixture\n---\n\nCollision fixture.\n`);
    await writeFile(join(configDir, "agents", "tech-writer.md"), `---\nname: tech-writer\ndescription: Unqualified collision fixture\n---\n\nCollision fixture.\n`);
    await writeFile(join(configDir, "agents", "socratic-analyst.md"), `---\nname: socratic-analyst\ndescription: Unqualified collision fixture\n---\n\nCollision fixture.\n`);
    for (const name of REVIEWER_NAMES) {
      await writeFile(join(configDir, "agents", `${name}.md`), `---\nname: ${name}\ndescription: Unqualified collision fixture\n---\n\nCollision fixture.\n`);
    }
    await writeFile(
      join(projectRoot, ".pi", "skills", "pi-forge-implementation-contract", "SKILL.md"),
      `---\nname: pi-forge-implementation-contract\ndescription: Collision fixture that must not override the agent-private contract.\n---\n\nCollision fixture.\n`,
    );
    await writeFile(
      join(projectRoot, ".pi", "skills", "pi-forge-review-contract", "SKILL.md"),
      `---\nname: pi-forge-review-contract\ndescription: Collision fixture that must not override the agent-private contract.\n---\n\nCollision fixture.\n`,
    );
    await writeFile(
      join(projectRoot, ".pi", "skills", "pi-forge-writing-contract", "SKILL.md"),
      `---\nname: pi-forge-writing-contract\ndescription: Collision fixture that must not override the compiled agent contract.\n---\n\nCollision fixture.\n`,
    );

    await assertProjectMaintainerSkillDiscovery(ROOT, configDir);
    await assertResourceDiscovery(packageRoot, configDir);
    await assertSecondOpinionPromptExpansion(packageRoot, configDir, temporaryRoot);
    await assertSocraticPromptExpansion(packageRoot, configDir, temporaryRoot);
    await assertExtensionDiscovery(packageRoot, configDir);
    await assertWriterContract(packageRoot, projectRoot, configDir, temporaryRoot);
    await assertReviewerContracts(packageRoot, projectRoot, configDir, temporaryRoot);
    await assertAgentPolicy(packageRoot, projectRoot, configDir, temporaryRoot);
    await assertLifecycleAndTelemetry(packageRoot, configDir, temporaryRoot);
    console.log(JSON.stringify({
      publishArtifact: "verified",
      commitPrompt: "discovered",
      publicSkills: ["orchestrator", "plan-forge", "project-checks", "pr-review", "refine-requirements", "second-opinion", "session-telemetry", "socratic-analysis", "source-control"],
      writerAgent: "pi-forge.software-engineer",
      techWriterAgent: "pi-forge.tech-writer",
      reviewerAgents: REVIEWER_NAMES.map((name) => `pi-forge.${name}`),
      privateContractCollisions: "rejected",
      protectedAgentPolicy: "verified",
      projectMaintainerSkills: ["pi-forge-handbook", "pi-forge-harness-audit", "pi-forge-release"],
      automaticPanelCommand: "discovered-default-off",
      secondOpinionPrompt: "expanded-and-aborted-before-provider",
      socraticAnalysisPrompt: "expanded-and-aborted-before-provider",
      modelInvocationRequested: false,
    }));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
