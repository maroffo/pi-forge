// ABOUTME: Blocks shadowed or capability-modified launches of protected Pi Forge agents.
// ABOUTME: Enforces package identity and reviewed contracts before the subagent tool can spawn a child.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  ARTIFACT_AGENT_NAMES,
  IMPLEMENTATION_CONTRACT_NAME,
  WRITER_AGENT_NAME,
} from "../src/agent-policy-config.js";
import { PI_SUBAGENTS_VERSION } from "../src/second-opinion-config.js";

type ResolveLaunchContract = (input: Record<string, unknown>) => Promise<any>;
type LaunchRequest = {
  agent: string;
  task?: string;
  cwd?: string;
  discoveryCwd?: string;
  context?: string;
  model?: string;
  thinking?: string | false;
  skill?: unknown;
  outputSchema?: unknown;
  acceptance?: unknown;
  agentContract?: unknown;
  output?: unknown;
  outputMode?: unknown;
  artifacts?: boolean;
  async?: unknown;
  agentScope?: unknown;
  share?: unknown;
  sessionDir?: unknown;
  chainDir?: unknown;
  reads?: unknown;
  clarify?: unknown;
  policyViolations?: string[];
};

type PolicyDependencies = {
  resolveLaunchContract: ResolveLaunchContract;
  loadRuntimeConfig?: () => Record<string, unknown>;
};

export type RunAttestation = {
  version: 1;
  runId: string;
  classification: "generic" | "protected";
  agents: string[];
  kind: "foreground" | "async";
  asyncDir?: string;
  launchContractDigest?: string;
  restored?: boolean;
};

type PendingRun = Pick<RunAttestation, "classification" | "agents">;

const RUN_ATTESTATION_ENTRY = "pi-forge.run-attestation.v1";
const ARTIFACT_NAMES = new Set(ARTIFACT_AGENT_NAMES);
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_ARTIFACT_TOOLS: string[] = [];
const EXPECTED_WRITER_TOOLS = [
  "bash",
  "edit",
  "find",
  "grep",
  "ls",
  "read",
  "write",
].sort();

let preflightModule: Promise<any> | undefined;
async function resolveWithBundledPreflight(input: Record<string, unknown>) {
  preflightModule ??= import("pi-subagents/preflight");
  const imported = await preflightModule;
  const module = imported.default ?? imported;
  if (typeof module.resolveSubagentLaunchContract !== "function") {
    throw new Error("Bundled pi-subagents preflight API is unavailable.");
  }
  return module.resolveSubagentLaunchContract(input);
}

function loadSubagentRuntimeConfig(): Record<string, unknown> {
  const agentDirectory = process.env.PI_CODING_AGENT_DIR === "~"
    ? homedir()
    : process.env.PI_CODING_AGENT_DIR?.startsWith("~/")
      ? join(homedir(), process.env.PI_CODING_AGENT_DIR.slice(2))
      : process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  const path = join(agentDirectory, "extensions", "subagent", "config.json");
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`pi-subagents runtime config at ${path} is not an object.`);
  }
  return parsed as Record<string, unknown>;
}

function isProtectedAgent(agent: string): boolean {
  return agent === WRITER_AGENT_NAME || ARTIFACT_NAMES.has(agent);
}

export function normalizedSubagentAction(input: Record<string, unknown>): string | undefined {
  if (typeof input.action !== "string") return undefined;
  const action = input.action.toLowerCase();
  if (action === "single" && (input.agent !== undefined || input.task !== undefined)) return undefined;
  if ((action === "parallel" || action === "tasks") && Array.isArray(input.tasks) && input.tasks.length > 0) {
    return undefined;
  }
  return action;
}

function collectAgentNamesFromStep(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const step = value as Record<string, unknown>;
  const agents = typeof step.agent === "string" ? [step.agent] : [];
  if (Array.isArray(step.parallel)) {
    for (const child of step.parallel) agents.push(...collectAgentNamesFromStep(child));
  } else if (step.parallel && typeof step.parallel === "object") {
    agents.push(...collectAgentNamesFromStep(step.parallel));
  }
  return agents;
}

export function collectLaunchAgentNames(input: Record<string, unknown>): string[] {
  const agents = typeof input.agent === "string" ? [input.agent] : [];
  if (Array.isArray(input.tasks)) {
    for (const task of input.tasks) agents.push(...collectAgentNamesFromStep(task));
  }
  if (Array.isArray(input.chain)) {
    for (const step of input.chain) agents.push(...collectAgentNamesFromStep(step));
  }
  return [...new Set(agents)];
}

function validRunId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

function validCanonicalModelId(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
}

function parseRunAttestation(value: unknown): RunAttestation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1
    || !validRunId(candidate.runId)
    || (candidate.classification !== "generic" && candidate.classification !== "protected")
    || !Array.isArray(candidate.agents)
    || candidate.agents.some((agent) => typeof agent !== "string" || !agent)
    || (candidate.kind !== "foreground" && candidate.kind !== "async")
    || (candidate.asyncDir !== undefined && typeof candidate.asyncDir !== "string")
    || (candidate.launchContractDigest !== undefined && typeof candidate.launchContractDigest !== "string")
  ) return undefined;
  const agents = [...new Set(candidate.agents as string[])];
  const classification = agents.some(isProtectedAgent) ? "protected" : candidate.classification;
  return {
    version: 1,
    runId: candidate.runId,
    classification,
    agents,
    kind: candidate.kind,
    ...(typeof candidate.asyncDir === "string" ? { asyncDir: candidate.asyncDir } : {}),
    ...(typeof candidate.launchContractDigest === "string"
      ? { launchContractDigest: candidate.launchContractDigest }
      : {}),
  };
}

function runIdsFromDetails(details: unknown): Array<{
  runId: string;
  kind: "foreground" | "async";
  asyncDir?: string;
  launchContractDigest?: string;
}> {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const value = details as Record<string, unknown>;
  const digest = typeof value.launchContractDigest === "string" ? value.launchContractDigest : undefined;
  if (validRunId(value.asyncId)) {
    return [{
      runId: value.asyncId,
      kind: "async",
      ...(typeof value.asyncDir === "string" ? { asyncDir: value.asyncDir } : {}),
      ...(digest ? { launchContractDigest: digest } : {}),
    }];
  }
  if (!validRunId(value.runId)) return [];
  return [{ runId: value.runId, kind: "foreground", ...(digest ? { launchContractDigest: digest } : {}) }];
}

export function validateResumeAttestation(
  input: Record<string, unknown>,
  attestations: ReadonlyMap<string, RunAttestation>,
): { reason?: string; attestation?: RunAttestation } {
  if ((input.chain as unknown[] | undefined)?.length) {
    return { reason: "Pi Forge does not permit attaching a chain during resume; launch a new preflighted chain instead." };
  }
  if (input.dir !== undefined) {
    return { reason: "Pi Forge resume requires an exact attested run id, not a run directory." };
  }
  const id = input.id;
  const runId = input.runId;
  if (id !== undefined && runId !== undefined && id !== runId) {
    return { reason: "Pi Forge resume received conflicting id and runId values." };
  }
  const requested = id ?? runId;
  if (!validRunId(requested)) {
    return { reason: "Pi Forge resume requires an exact attested run id." };
  }
  const attestation = attestations.get(requested);
  if (!attestation) {
    return {
      reason: `Pi Forge cannot attest resume target '${requested}'. Relaunch it, or continue a protected agent through a new preflighted launch.`,
    };
  }
  if (attestation.classification === "protected") {
    return {
      reason: `Pi Forge protected run '${requested}' cannot be revived safely with pi-subagents 0.37.2. Start a new protected launch containing the prior result and follow-up.`,
    };
  }
  if (attestation.kind === "foreground" && attestation.restored) {
    return {
      reason: `Pi Forge cannot safely resume foreground run '${requested}' after policy reload because pi-subagents may resolve the id as a prefix. Start a new launch instead.`,
    };
  }
  if (attestation.kind === "async") {
    try {
      if (
        !attestation.asyncDir
        || !isAbsolute(attestation.asyncDir)
        || !existsSync(attestation.asyncDir)
        || basename(realpathSync(attestation.asyncDir)) !== requested
      ) {
        return { reason: `Pi Forge cannot re-establish the exact async source for '${requested}'. Start a new launch instead.` };
      }
    } catch {
      return { reason: `Pi Forge cannot re-establish the exact async source for '${requested}'. Start a new launch instead.` };
    }
  }
  return { attestation };
}

function policyViolations(value: Record<string, unknown>): string[] {
  const violations: string[] = [];
  if (value.skill !== undefined) violations.push("skill override");
  if (value.outputSchema !== undefined) violations.push("output schema");
  if (value.acceptance !== undefined && value.acceptance !== false) violations.push("acceptance commands");
  if (value.agentContract !== undefined) {
    const contract = value.agentContract as Record<string, unknown> | undefined;
    if (!contract || contract.version !== 1 || Object.keys(contract).length !== 1) {
      violations.push("agent contract");
    }
  }
  if (value.output !== undefined || value.outputMode !== undefined) violations.push("output persistence");
  if (value.share === true) violations.push("session sharing");
  if (value.sessionDir !== undefined || value.chainDir !== undefined) violations.push("session destination");
  if (value.reads !== undefined) violations.push("filesystem reads injection");
  if (value.clarify === true) violations.push("clarification override");
  if (value.thinking !== undefined) violations.push("thinking override");
  return violations;
}

function collectChainLaunches(value: unknown, inherited: Omit<LaunchRequest, "agent">): LaunchRequest[] {
  if (!value || typeof value !== "object") return [];
  const step = value as Record<string, unknown>;
  const effective: Omit<LaunchRequest, "agent"> = {
    ...inherited,
    task: typeof step.task === "string" ? step.task : inherited.task,
    cwd: typeof step.cwd === "string" ? step.cwd : inherited.cwd,
    model: typeof step.model === "string" ? step.model : inherited.model,
    skill: step.skill !== undefined ? step.skill : inherited.skill,
    outputSchema: step.outputSchema !== undefined ? step.outputSchema : inherited.outputSchema,
    acceptance: step.acceptance !== undefined ? step.acceptance : inherited.acceptance,
    agentContract: step.agentContract !== undefined ? step.agentContract : inherited.agentContract,
    output: step.output !== undefined ? step.output : inherited.output,
    outputMode: step.outputMode !== undefined ? step.outputMode : inherited.outputMode,
    share: step.share !== undefined ? step.share : inherited.share,
    sessionDir: step.sessionDir !== undefined ? step.sessionDir : inherited.sessionDir,
    chainDir: step.chainDir !== undefined ? step.chainDir : inherited.chainDir,
    reads: step.reads !== undefined ? step.reads : inherited.reads,
    clarify: step.clarify !== undefined ? step.clarify : inherited.clarify,
    async: step.async !== undefined ? step.async : inherited.async,
    policyViolations: [
      ...(inherited.policyViolations ?? []),
      ...policyViolations(step),
    ],
  };
  const launches: LaunchRequest[] = [];
  if (typeof step.agent === "string") launches.push({ ...effective, agent: step.agent });
  const parallel = step.parallel;
  if (Array.isArray(parallel)) {
    for (const child of parallel) launches.push(...collectChainLaunches(child, effective));
  } else if (parallel && typeof parallel === "object") {
    launches.push(...collectChainLaunches(parallel, effective));
  }
  return launches;
}

export function collectProtectedLaunches(input: Record<string, unknown>, defaultCwd: string): LaunchRequest[] {
  const action = normalizedSubagentAction(input);
  if (action !== undefined && action !== "schedule" && action !== "append-step") return [];
  const discoveryCwd = typeof input.cwd === "string" ? input.cwd : defaultCwd;
  const inherited: Omit<LaunchRequest, "agent"> = {
    task: typeof input.task === "string" ? input.task : undefined,
    cwd: discoveryCwd,
    discoveryCwd,
    context: typeof input.context === "string" ? input.context : undefined,
    model: typeof input.model === "string" ? input.model : undefined,
    thinking: typeof input.thinking === "string" || input.thinking === false ? input.thinking : undefined,
    skill: input.skill,
    outputSchema: input.outputSchema,
    acceptance: input.acceptance,
    agentContract: input.agentContract,
    output: input.output,
    outputMode: input.outputMode,
    artifacts: typeof input.artifacts === "boolean" ? input.artifacts : undefined,
    async: input.async,
    agentScope: input.agentScope,
    share: input.share,
    sessionDir: input.sessionDir,
    chainDir: input.chainDir,
    reads: input.reads,
    clarify: input.clarify,
    policyViolations: policyViolations(input),
  };
  const launches: LaunchRequest[] = [];

  if (typeof input.agent === "string") launches.push({ ...inherited, agent: input.agent });
  const nestedInherited = { ...inherited, model: undefined };
  if (Array.isArray(input.tasks)) {
    for (const task of input.tasks) launches.push(...collectChainLaunches(task, nestedInherited));
  }
  if (Array.isArray(input.chain)) {
    for (const step of input.chain) launches.push(...collectChainLaunches(step, nestedInherited));
  }
  return launches.filter((launch) => isProtectedAgent(launch.agent));
}

function sameStrings(actual: unknown, expected: string[]): boolean {
  return Array.isArray(actual)
    && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function expectedAgentPath(agent: string): string {
  const localName = agent.slice("pi-forge.".length);
  return realpathSync(join(PACKAGE_ROOT, "agents", `${localName}.md`));
}

function expectedContractPath(contractName: string): string {
  return realpathSync(join(PACKAGE_ROOT, "agent-skills", contractName, "SKILL.md"));
}

export async function validateProtectedLaunch(
  launch: LaunchRequest,
  defaultCwd: string,
  resolveLaunchContract: ResolveLaunchContract,
): Promise<string | undefined> {
  const artifactOnly = ARTIFACT_NAMES.has(launch.agent);
  const expectedContext = artifactOnly ? "fresh" : "fork";
  if ((launch.policyViolations?.length ?? 0) > 0) {
    return `${launch.agent} rejected unsafe invocation fields: ${[...new Set(launch.policyViolations)].join(", ")}.`;
  }
  if (launch.context !== undefined && launch.context !== expectedContext) {
    return `${launch.agent} requires context ${expectedContext}.`;
  }
  if (launch.skill !== undefined) {
    return `${launch.agent} does not permit invocation-time skill overrides.`;
  }
  if (launch.outputSchema !== undefined) {
    return `${launch.agent} does not permit invocation-time output schemas.`;
  }
  if (!launch.model) {
    return `${launch.agent} requires an explicit model selected and approved locally.`;
  }
  if (!validCanonicalModelId(launch.model)) {
    return `${launch.agent} requires a canonical provider/model identifier.`;
  }
  if (!artifactOnly && launch.async !== false) {
    return `${launch.agent} requires explicit async: false so its mutations can be joined before verification.`;
  }
  if (artifactOnly && launch.artifacts !== false) {
    return `${launch.agent} requires artifacts: false.`;
  }
  if (artifactOnly && launch.acceptance !== false) {
    return `${launch.agent} requires acceptance: false.`;
  }
  const agentContract = launch.agentContract as Record<string, unknown> | undefined;
  if (
    artifactOnly
    && (
      !agentContract
      || agentContract.version !== 1
      || Object.keys(agentContract).length !== 1
    )
  ) {
    return `${launch.agent} requires agentContract: { version: 1 } with no acceptance commands.`;
  }
  if (artifactOnly && (launch.output !== undefined || launch.outputMode !== undefined)) {
    return `${launch.agent} does not permit invocation-time output persistence.`;
  }
  if (launch.share === true) {
    return `${launch.agent} does not permit session sharing.`;
  }
  if (launch.sessionDir !== undefined || launch.chainDir !== undefined) {
    return `${launch.agent} does not permit custom session destinations.`;
  }
  if (launch.reads !== undefined) {
    return `${launch.agent} does not permit filesystem reads injection.`;
  }
  if (launch.clarify === true) {
    return `${launch.agent} does not permit clarification overrides.`;
  }
  if (launch.thinking !== undefined) {
    return `${launch.agent} does not permit invocation-time thinking overrides.`;
  }
  if (launch.agentScope !== undefined) {
    return `${launch.agent} does not permit invocation-time agentScope overrides.`;
  }

  const preflightInput = {
    agent: launch.agent,
    cwd: launch.discoveryCwd ?? defaultCwd,
    task: launch.task ?? "Pi Forge protected-agent preflight",
    ...(launch.context ? { context: launch.context } : {}),
    ...(launch.model ? { model: launch.model } : {}),
    ...(launch.thinking !== undefined ? { thinking: launch.thinking } : {}),
    artifacts: launch.artifacts ?? false,
    runId: `pi-forge-policy-${launch.agent.slice("pi-forge.".length)}`,
  };
  const result = await resolveLaunchContract(preflightInput);
  if (!result.ok || !result.contract) {
    return `Preflight failed for ${launch.agent}: ${result.message ?? "unknown error"}`;
  }

  const baseline = await resolveLaunchContract({ ...preflightInput, agentScope: "user" });
  if (!baseline.ok || !baseline.contract) {
    return `Trusted package baseline failed for ${launch.agent}: ${baseline.message ?? "unknown error"}`;
  }

  const contract = result.contract;
  const baselineContract = baseline.contract;
  let actualAgentPath: string;
  try {
    actualAgentPath = realpathSync(contract.agent.filePath);
  } catch {
    return `${launch.agent} resolved to an unreadable agent file.`;
  }
  const common = contract.protocol?.packageVersion === PI_SUBAGENTS_VERSION
    && baselineContract.protocol?.packageVersion === PI_SUBAGENTS_VERSION
    && contract.agent.source === "package"
    && baselineContract.agent.source === "package"
    && actualAgentPath === expectedAgentPath(launch.agent)
    && realpathSync(baselineContract.agent.filePath) === expectedAgentPath(launch.agent)
    && contract.agent.definitionDigest === baselineContract.agent.definitionDigest
    && contract.agent.shadowedCandidates.length === 0
    && contract.context === expectedContext
    && contract.model === launch.model
    && contract.modelCandidates.length === 1
    && contract.modelCandidates[0] === launch.model
    && baselineContract.model === contract.model
    && baselineContract.modelCandidates.length === 1
    && baselineContract.modelCandidates[0] === baselineContract.model
    && contract.inheritSkills === false
    && contract.skills.missing.length === 0
    && contract.tools.explicitAllowlist === true
    && contract.tools.internalTools.length === 0
    && contract.tools.mcp.length === 0
    && contract.tools.effectiveMcpTools.length === 0
    && contract.tools.toolExtensionPaths.length === 0
    && contract.tools.configuredExtensions.length === 0
    && contract.tools.disableAmbientExtensions === true
    && contract.tools.fanoutAuthorized === false
    && contract.tools.runtimeExtensions.length === 1
    && contract.tools.runtimeExtensions[0].endsWith("/subagent-prompt-runtime.ts")
    && !contract.diagnostics.some((diagnostic: any) => diagnostic.severity === "error");
  if (!common) return `${launch.agent} effective package or capability contract was modified.`;

  if (artifactOnly) {
    const modelMatches = contract.model === launch.model
      || contract.model?.startsWith(`${launch.model}:`) === true;
    const valid = modelMatches
      && contract.modelCandidates.length === 1
      && contract.modelCandidates[0] === contract.model
      && contract.systemPromptMode === "replace"
      && contract.inheritProjectContext === false
      && contract.skills.requested.length === 0
      && contract.skills.resolved.length === 0
      && sameStrings(contract.tools.effectiveAllowlist, EXPECTED_ARTIFACT_TOOLS)
      && sameStrings(contract.tools.requestedBuiltin, EXPECTED_ARTIFACT_TOOLS)
      && sameStrings(contract.tools.declaredBuiltin, EXPECTED_ARTIFACT_TOOLS)
      && sameStrings(contract.tools.requiredChildTools, EXPECTED_ARTIFACT_TOOLS);
    return valid ? undefined : `${launch.agent} effective artifact-only contract was modified.`;
  }

  const resolvedSkill = contract.skills.resolved[0];
  const validWriter = contract.systemPromptMode === "append"
    && contract.inheritProjectContext === true
    && contract.skills.requested.length === 1
    && contract.skills.requested[0] === IMPLEMENTATION_CONTRACT_NAME
    && contract.skills.resolved.length === 1
    && resolvedSkill?.name === IMPLEMENTATION_CONTRACT_NAME
    && realpathSync(resolvedSkill.path) === expectedContractPath(IMPLEMENTATION_CONTRACT_NAME)
    && sameStrings(contract.tools.effectiveAllowlist, EXPECTED_WRITER_TOOLS)
    && sameStrings(contract.tools.requestedBuiltin, EXPECTED_WRITER_TOOLS)
    && sameStrings(contract.tools.declaredBuiltin, EXPECTED_WRITER_TOOLS)
    && sameStrings(contract.tools.requiredChildTools, EXPECTED_WRITER_TOOLS);
  return validWriter ? undefined : `${launch.agent} effective writer contract was modified.`;
}

export default function agentPolicyExtension(
  pi: ExtensionAPI,
  dependencies: PolicyDependencies = { resolveLaunchContract: resolveWithBundledPreflight },
): void {
  const attestations = new Map<string, RunAttestation>();
  const pendingRuns = new Map<string, PendingRun>();

  const remember = (attestation: RunAttestation, persist: boolean) => {
    const existing = attestations.get(attestation.runId);
    const sourceConflict = existing !== undefined && existing.kind !== attestation.kind;
    const merged: RunAttestation = {
      ...attestation,
      classification: existing?.classification === "protected" || attestation.classification === "protected"
        ? "protected"
        : "generic",
      agents: [...new Set([...(existing?.agents ?? []), ...attestation.agents])],
      kind: sourceConflict ? "foreground" : attestation.kind,
      ...(sourceConflict || attestation.restored || existing?.restored ? { restored: true } : {}),
      ...(attestation.asyncDir || existing?.asyncDir
        ? { asyncDir: attestation.asyncDir ?? existing?.asyncDir }
        : {}),
      ...(attestation.launchContractDigest || existing?.launchContractDigest
        ? { launchContractDigest: attestation.launchContractDigest ?? existing?.launchContractDigest }
        : {}),
    };
    attestations.set(merged.runId, merged);
    if (persist) {
      const { restored: _restored, ...persisted } = merged;
      pi.appendEntry(RUN_ATTESTATION_ENTRY, persisted);
    }
  };

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    attestations.clear();
    pendingRuns.clear();
    for (const entry of ctx.sessionManager.getEntries()) {
      if (
        !entry
        || typeof entry !== "object"
        || (entry as { type?: unknown }).type !== "custom"
        || (entry as { customType?: unknown }).customType !== RUN_ATTESTATION_ENTRY
      ) continue;
      const attestation = parseRunAttestation((entry as { data?: unknown }).data);
      if (attestation) remember({ ...attestation, restored: true }, false);
    }
  });

  pi.on("tool_result", (event: any) => {
    if (event.toolName !== "subagent" || typeof event.toolCallId !== "string") return;
    const pending = pendingRuns.get(event.toolCallId);
    if (!pending) return;
    pendingRuns.delete(event.toolCallId);
    for (const result of runIdsFromDetails(event.details)) {
      remember({
        version: 1,
        runId: result.runId,
        classification: pending.classification,
        agents: pending.agents,
        kind: result.kind,
        ...(result.asyncDir ? { asyncDir: result.asyncDir } : {}),
        ...(result.launchContractDigest ? { launchContractDigest: result.launchContractDigest } : {}),
      }, true);
    }
  });

  pi.on("tool_call", async (event, ctx: ExtensionContext) => {
    if (event.toolName !== "subagent") return;
    const input = event.input as Record<string, unknown>;
    const action = normalizedSubagentAction(input);
    const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;

    if (action === "resume") {
      const resume = validateResumeAttestation(input, attestations);
      if (resume.reason) return { block: true, reason: resume.reason };
      if (toolCallId && resume.attestation) {
        pendingRuns.set(toolCallId, {
          classification: resume.attestation.classification,
          agents: [...resume.attestation.agents],
        });
      }
      return;
    }

    const launches = collectProtectedLaunches(input, ctx.cwd);
    const writerLaunches = launches.filter((launch) => launch.agent === WRITER_AGENT_NAME);
    if (writerLaunches.length > 0) {
      const directSingleWriter = action === undefined
        && input.agent === WRITER_AGENT_NAME
        && (!Array.isArray(input.tasks) || input.tasks.length === 0)
        && (!Array.isArray(input.chain) || input.chain.length === 0)
        && (input.count === undefined || input.count === 1);
      if (!directSingleWriter || writerLaunches.length !== 1) {
        return { block: true, reason: "Pi Forge permits exactly one direct implementation writer per subagent call." };
      }
      try {
        const runtimeConfig = (dependencies.loadRuntimeConfig ?? loadSubagentRuntimeConfig)();
        if (runtimeConfig.forceTopLevelAsync === true) {
          return { block: true, reason: "Pi Forge cannot launch the implementation writer while pi-subagents forceTopLevelAsync is enabled." };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { block: true, reason: `Pi Forge could not verify foreground writer configuration: ${message}` };
      }
    }
    if ((action === "schedule" || action === "append-step") && launches.length > 0) {
      return {
        block: true,
        reason: `Pi Forge protected agents cannot be launched through ${String(action)}.`,
      };
    }
    for (const launch of launches) {
      try {
        const reason = await validateProtectedLaunch(
          launch,
          ctx.cwd,
          dependencies.resolveLaunchContract,
        );
        if (reason) return { block: true, reason };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { block: true, reason: `Pi Forge protected-agent policy failed closed: ${message}` };
      }
    }

    if (action === undefined && toolCallId) {
      const agents = collectLaunchAgentNames(input);
      if (agents.length > 0) {
        pendingRuns.set(toolCallId, {
          classification: agents.some(isProtectedAgent) ? "protected" : "generic",
          agents,
        });
      }
    }
  });
}
