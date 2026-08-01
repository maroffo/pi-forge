// ABOUTME: Verifies protected-agent launch extraction and fail-closed override handling.
// ABOUTME: Covers single, parallel, and chain subagent tool input shapes without spawning children.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import agentPolicyExtension, {
  collectLaunchAgentNames,
  collectProtectedLaunches,
  validateProtectedLaunch,
  validateResumeAttestation,
} from "../extensions/agent-policy.ts";

const CWD = "/tmp/pi-forge-policy-test";

test("policy finds protected agents in single, parallel, and chain launches", () => {
  const single = collectProtectedLaunches({
    agent: "pi-forge.security-reviewer",
    task: "review",
  }, CWD);
  assert.deepEqual(single.map((launch) => launch.agent), ["pi-forge.security-reviewer"]);
  assert.deepEqual(
    collectProtectedLaunches({ agent: "pi-forge.tech-writer", task: "draft" }, CWD)
      .map((launch) => launch.agent),
    ["pi-forge.tech-writer"],
  );
  assert.deepEqual(
    collectProtectedLaunches({ agent: "pi-forge.socratic-analyst", task: "analyze" }, CWD)
      .map((launch) => launch.agent),
    ["pi-forge.socratic-analyst"],
  );

  const parallel = collectProtectedLaunches({
    cwd: "/tmp/untrusted-discovery-root",
    context: "fresh",
    tasks: [
      { agent: "pi-forge.test-reviewer", task: "tests", cwd: "/tmp/clean-step-root" },
      { agent: "reviewer", task: "generic" },
      { agent: "pi-forge.database-reviewer", task: "database" },
    ],
  }, CWD);
  assert.deepEqual(parallel.map((launch) => launch.agent), [
    "pi-forge.test-reviewer",
    "pi-forge.database-reviewer",
  ]);
  assert.ok(parallel.every((launch) => launch.context === "fresh"));
  assert.ok(parallel.every((launch) => launch.discoveryCwd === "/tmp/untrusted-discovery-root"));
  assert.equal(parallel[0]?.cwd, "/tmp/clean-step-root");

  const chain = collectProtectedLaunches({
    chain: [
      {
        parallel: [
          { agent: "pi-forge.architecture-reviewer", task: "architecture" },
          { agent: "pi-forge.performance-reviewer", task: "performance" },
        ],
      },
      { agent: "pi-forge.software-engineer", task: "fix" },
    ],
  }, CWD);
  assert.deepEqual(chain.map((launch) => launch.agent), [
    "pi-forge.architecture-reviewer",
    "pi-forge.performance-reviewer",
    "pi-forge.software-engineer",
  ]);
});

test("policy ignores management calls but finds delayed execution actions", () => {
  assert.deepEqual(collectProtectedLaunches({ action: "list" }, CWD), []);
  assert.deepEqual(collectProtectedLaunches({ agent: "reviewer", task: "review" }, CWD), []);
  assert.deepEqual(
    collectProtectedLaunches({
      action: "schedule",
      agent: "pi-forge.security-reviewer",
      task: "review",
    }, CWD).map((launch) => launch.agent),
    ["pi-forge.security-reviewer"],
  );
  assert.deepEqual(
    collectProtectedLaunches({
      action: "append-step",
      chain: [{ agent: "pi-forge.test-reviewer", task: "review" }],
    }, CWD).map((launch) => launch.agent),
    ["pi-forge.test-reviewer"],
  );
});

test("policy rejects protected invocation overrides before preflight", async () => {
  let resolverCalls = 0;
  const resolver = async () => { resolverCalls += 1; return {}; };
  const base = {
    agent: "pi-forge.socratic-analyst",
    model: "trusted/model",
    artifacts: false,
    acceptance: false,
    agentContract: { version: 1 },
  };

  const checks = [
    [{ ...base, skill: false }, /skill overrides/],
    [{ ...base, context: "fork" }, /requires context fresh/],
    [{ ...base, outputSchema: { type: "object" } }, /output schemas/],
    [{ ...base, acceptance: { verify: ["echo unsafe"] } }, /acceptance/],
    [{ ...base, agentContract: { version: 1, extra: true } }, /agentContract/],
    [{ ...base, output: "/tmp/review.txt" }, /output persistence/],
    [{ ...base, outputMode: "file-only" }, /output persistence/],
    [{ ...base, artifacts: undefined }, /requires artifacts: false/],
    [{ ...base, model: undefined }, /requires an explicit model/],
    [{ ...base, model: "trusted-model" }, /canonical provider\/model/],
    [{ ...base, agentScope: "project" }, /agentScope overrides/],
    [{ ...base, share: true }, /session sharing/],
    [{ ...base, sessionDir: "/tmp/sessions" }, /session destination/],
    [{ ...base, chainDir: "/tmp/chain" }, /session destination/],
    [{ ...base, reads: ["secret.txt"] }, /filesystem reads injection/],
    [{ ...base, clarify: true }, /clarification overrides/],
    [{ ...base, thinking: "high" }, /thinking overrides/],
  ] as const;
  for (const [launch, expected] of checks) {
    const reason = await validateProtectedLaunch(launch, CWD, resolver);
    assert.match(reason ?? "", expected);
  }
  assert.match(
    await validateProtectedLaunch({
      agent: "pi-forge.software-engineer",
      task: "implement",
      artifacts: false,
    }, CWD, resolver) ?? "",
    /requires an explicit model/,
  );
  assert.match(
    await validateProtectedLaunch({
      agent: "pi-forge.software-engineer",
      task: "implement",
      model: "trusted-model",
      artifacts: false,
    }, CWD, resolver) ?? "",
    /canonical provider\/model/,
  );
  for (const asyncValue of [undefined, true]) {
    assert.match(
      await validateProtectedLaunch({
        agent: "pi-forge.software-engineer",
        task: "implement",
        model: "trusted/model",
        artifacts: false,
        ...(asyncValue === undefined ? {} : { async: asyncValue }),
      }, CWD, resolver) ?? "",
      /requires explicit async: false/,
    );
  }
  assert.equal(resolverCalls, 0);
});

test("registered policy rejects the unqualified Socratic alias before discovery", async () => {
  let handler: ((event: any, ctx: any) => Promise<any>) | undefined;
  let resolverCalls = 0;
  agentPolicyExtension({
    on(name: string, candidate: typeof handler) {
      if (name === "tool_call") handler = candidate;
    },
  } as any, {
    resolveLaunchContract: async () => { resolverCalls += 1; return {}; },
  });
  assert.ok(handler);

  for (const input of [
    { agent: "socratic-analyst", task: "analyze" },
    { tasks: [{ agent: "socratic-analyst", task: "analyze" }] },
    { chain: [{ parallel: [{ agent: "socratic-analyst", task: "analyze" }] }] },
  ]) {
    const result = await handler!({ toolName: "subagent", input }, { cwd: CWD });
    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /unsafe unqualified protected-agent alias/);
    assert.match(result?.reason ?? "", /pi-forge\.socratic-analyst/);
  }
  assert.equal(resolverCalls, 0);
});

test("resume policy allows only exact generic attestations", () => {
  const generic = {
    version: 1 as const,
    runId: "generic-run-1",
    classification: "generic" as const,
    agents: ["reviewer"],
    kind: "foreground" as const,
  };
  const protectedRun = {
    version: 1 as const,
    runId: "protected-run-1",
    classification: "protected" as const,
    agents: ["pi-forge.tech-writer"],
    kind: "foreground" as const,
  };
  const attestations = new Map([
    [generic.runId, generic],
    [protectedRun.runId, protectedRun],
  ]);

  assert.equal(validateResumeAttestation({ action: "resume", id: generic.runId }, attestations).reason, undefined);
  assert.match(
    validateResumeAttestation({ action: "resume", id: protectedRun.runId }, attestations).reason ?? "",
    /cannot be revived safely/,
  );
  assert.match(
    validateResumeAttestation({ action: "resume", id: "generic" }, attestations).reason ?? "",
    /cannot attest/,
  );
  assert.match(
    validateResumeAttestation({ action: "resume", dir: "/tmp/run" }, attestations).reason ?? "",
    /exact attested run id/,
  );
  assert.match(
    validateResumeAttestation({ action: "resume", id: generic.runId, chain: [{ agent: "worker" }] }, attestations).reason ?? "",
    /does not permit attaching a chain/,
  );
  assert.deepEqual(
    collectLaunchAgentNames({
      chain: [{ parallel: [{ agent: "reviewer" }, { parallel: { agent: "pi-forge.tech-writer" } }] }],
    }),
    ["reviewer", "pi-forge.tech-writer"],
  );
});

test("registered policy attests failed generic runs and restores only exact async sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-resume-policy-"));
  const asyncDir = join(root, "generic-async-1");
  await mkdir(asyncDir);
  try {
    const handlers = new Map<string, (...args: any[]) => any>();
    const entries: any[] = [];
    agentPolicyExtension({
      on(name: string, handler: (...args: any[]) => any) { handlers.set(name, handler); },
      appendEntry(customType: string, data: unknown) {
        entries.push({ type: "custom", customType, data });
      },
    } as any, { resolveLaunchContract: async () => ({}) });

    handlers.get("session_start")?.({}, { sessionManager: { getEntries: () => [] } });
    for (const [toolCallId, details] of [
      ["foreground-call", { runId: "generic-foreground-1", launchContractDigest: "digest-1" }],
      ["async-call", { asyncId: "generic-async-1", asyncDir, launchContractDigest: "digest-2" }],
    ] as const) {
      assert.equal(await handlers.get("tool_call")?.({
        toolName: "subagent",
        toolCallId,
        input: { agent: "reviewer", task: "review" },
      }, { cwd: root }), undefined);
      handlers.get("tool_result")?.({
        toolName: "subagent",
        toolCallId,
        isError: true,
        details,
      });
    }
    assert.equal(entries.length, 2);
    assert.equal(entries[0].data.kind, "foreground");
    assert.equal(entries[1].data.kind, "async");

    assert.equal(await handlers.get("tool_call")?.({
      toolName: "subagent",
      input: { action: "resume", id: "generic-foreground-1", message: "continue" },
    }, { cwd: root }), undefined);

    const restoredHandlers = new Map<string, (...args: any[]) => any>();
    agentPolicyExtension({
      on(name: string, handler: (...args: any[]) => any) { restoredHandlers.set(name, handler); },
      appendEntry() {},
    } as any, { resolveLaunchContract: async () => ({}) });
    restoredHandlers.get("session_start")?.({}, {
      sessionManager: {
        getEntries: () => [
          ...entries,
          {
            type: "custom",
            customType: "pi-forge.run-attestation.v1",
            data: {
              version: 1,
              runId: "protected-run-1",
              classification: "generic",
              agents: ["pi-forge.tech-writer"],
              kind: "foreground",
            },
          },
        ],
      },
    });
    const staleForeground = await restoredHandlers.get("tool_call")?.({
      toolName: "subagent",
      input: { action: "resume", id: "generic-foreground-1", message: "continue" },
    }, { cwd: root });
    assert.equal(staleForeground?.block, true);
    assert.match(staleForeground?.reason ?? "", /after policy reload/);

    assert.equal(await restoredHandlers.get("tool_call")?.({
      toolName: "subagent",
      input: { action: "resume", id: "generic-async-1", message: "continue" },
    }, { cwd: root }), undefined);

    const protectedResume = await restoredHandlers.get("tool_call")?.({
      toolName: "subagent",
      input: { action: "resume", id: "protected-run-1", message: "continue" },
    }, { cwd: root });
    assert.equal(protectedResume?.block, true);
    assert.match(protectedResume?.reason ?? "", /cannot be revived safely/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registered policy enforces one direct foreground writer against runtime async defaults", async () => {
  const makeHandler = (runtimeConfig: Record<string, unknown>) => {
    let handler: ((event: any, ctx: any) => Promise<any>) | undefined;
    let resolverCalls = 0;
    agentPolicyExtension({
      on(name: string, candidate: typeof handler) {
        if (name === "tool_call") handler = candidate;
      },
    } as any, {
      resolveLaunchContract: async () => { resolverCalls += 1; return {}; },
      loadRuntimeConfig: () => runtimeConfig,
    });
    return { handler: handler!, resolverCalls: () => resolverCalls };
  };
  const writer = {
    agent: "pi-forge.software-engineer",
    task: "implement",
    model: "trusted/model",
    artifacts: false,
    async: false,
  };

  const forced = makeHandler({ forceTopLevelAsync: true });
  const forcedResult = await forced.handler({ toolName: "subagent", input: writer }, { cwd: CWD });
  assert.equal(forcedResult?.block, true);
  assert.match(forcedResult?.reason ?? "", /forceTopLevelAsync/);
  assert.equal(forced.resolverCalls(), 0);

  const defaultAsync = makeHandler({ asyncByDefault: true });
  const defaultResult = await defaultAsync.handler({ toolName: "subagent", input: writer }, { cwd: CWD });
  assert.equal(defaultResult?.block, true);
  assert.doesNotMatch(defaultResult?.reason ?? "", /forceTopLevelAsync|foreground/);
  assert.equal(defaultAsync.resolverCalls(), 1);

  const multi = makeHandler({});
  const multiResult = await multi.handler({
    toolName: "subagent",
    input: { tasks: [writer, writer] },
  }, { cwd: CWD });
  assert.equal(multiResult?.block, true);
  assert.match(multiResult?.reason ?? "", /exactly one direct implementation writer/);
  assert.equal(multi.resolverCalls(), 0);
});

test("registered policy blocks overrides across every execution shape", async () => {
  let handler: ((event: any, ctx: any) => Promise<any>) | undefined;
  let resolverCalls = 0;
  agentPolicyExtension({
    on(name: string, candidate: typeof handler) {
      if (name === "tool_call") handler = candidate;
    },
  } as any, {
    resolveLaunchContract: async () => { resolverCalls += 1; return {}; },
  });
  assert.ok(handler);

  const safeRun = { artifacts: false, acceptance: false, agentContract: { version: 1 } };
  const calls = [
    {
      ...safeRun,
      action: "single",
      agent: "pi-forge.tech-writer",
      task: "draft",
      model: "trusted/model",
      skill: false,
    },
    {
      ...safeRun,
      action: "parallel",
      tasks: [{
        agent: "pi-forge.test-reviewer",
        task: "review",
        model: "trusted/model",
        clarify: true,
      }],
    },
    {
      ...safeRun,
      action: "tasks",
      tasks: [{
        agent: "pi-forge.security-reviewer",
        task: "review",
        model: "trusted/model",
        output: "/tmp/unsafe.txt",
      }],
    },
    {
      ...safeRun,
      agent: "pi-forge.tech-writer",
      task: "draft",
      model: "trusted/model",
      output: "/tmp/unsafe.md",
    },
    {
      ...safeRun,
      agent: "pi-forge.security-reviewer",
      task: "review",
      model: "trusted/model",
      skill: false,
    },
    {
      ...safeRun,
      tasks: [{
        agent: "pi-forge.test-reviewer",
        task: "review",
        model: "trusted/model",
        acceptance: { verify: ["echo unsafe"] },
      }],
    },
    {
      ...safeRun,
      chain: [{
        agent: "pi-forge.database-reviewer",
        task: "review",
        model: "trusted/model",
        output: "/tmp/unsafe.txt",
      }],
    },
    {
      ...safeRun,
      chain: [{
        parallel: [{
          agent: "pi-forge.performance-reviewer",
          task: "review",
          model: "trusted/model",
          outputSchema: { type: "object" },
        }],
      }],
    },
    {
      ...safeRun,
      chain: [{
        parallel: {
          agent: "pi-forge.architecture-reviewer",
          task: "review",
          model: "trusted/model",
          agentContract: { version: 1, extra: true },
        },
      }],
    },
    {
      ...safeRun,
      chain: [{
        acceptance: { verify: ["echo unsafe"] },
        parallel: {
          agent: "pi-forge.security-reviewer",
          task: "review",
          model: "trusted/model",
          acceptance: false,
          agentContract: { version: 1 },
        },
      }],
    },
    {
      ...safeRun,
      agent: "pi-forge.tech-writer",
      task: "draft",
      model: "trusted/model",
      async: true,
      share: true,
      sessionDir: "/tmp/unsafe-sessions",
    },
    {
      action: "resume",
      id: "protected-run-fixture",
      output: "/tmp/unsafe.txt",
      agentScope: "project",
    },
    {
      action: "schedule",
      agent: "pi-forge.security-reviewer",
      task: "review",
      model: "trusted/model",
      artifacts: false,
    },
    {
      action: "append-step",
      chain: [{
        agent: "pi-forge.test-reviewer",
        task: "review",
        model: "trusted/model",
      }],
    },
  ];

  for (const input of calls) {
    const result = await handler!({ toolName: "subagent", input }, { cwd: CWD });
    assert.equal(result?.block, true, JSON.stringify(input));
  }
  assert.equal(resolverCalls, 0);
});
