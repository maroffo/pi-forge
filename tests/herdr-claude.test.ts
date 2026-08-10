// ABOUTME: Adversarially verifies the deterministic direct-Claude preflight and launch descriptor.
// ABOUTME: Uses a temporary fake claude executable and never performs a network or model call.

import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CLAUDE_COMMAND_MAX_BUFFER_BYTES,
  CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES,
  CLAUDE_LAUNCH_POLICY,
  CLAUDE_PREFLIGHT_ERROR_CODES,
  CLAUDE_REQUIRED_HELP_FLAGS,
  CLAUDE_ROLE_ARGUMENT_TAILS,
  CLAUDE_ROUTE_EVIDENCE,
} from "../skills/herdr-orchestrator/scripts/prepare-claude-launch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "skills", "herdr-orchestrator", "scripts", "prepare-claude-launch.mjs");
const SECRET_SENTINEL = "SECRET_SENTINEL_DO_NOT_ECHO";
const IDENTITY_SENTINEL = "identity-sentinel@example.invalid";
const CONTROL_SENTINEL = "CONTROL_SENTINEL\nSECOND_LINE";
const DEFAULT_HELP = CLAUDE_REQUIRED_HELP_FLAGS.map((flag) => `  ${flag} <value>`).join("\n");

const FAKE_CLAUDE_SOURCE = `#!${process.execPath}
const { appendFileSync, readFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify(args) + "\\n");
const fixture = JSON.parse(readFileSync(process.env.FAKE_CLAUDE_FIXTURE, "utf8"));
let response;
if (JSON.stringify(args) === JSON.stringify(["--version"])) response = fixture.version;
else if (JSON.stringify(args) === JSON.stringify(["--help"])) response = fixture.help;
else if (JSON.stringify(args) === JSON.stringify(["auth", "status", "--json"])) response = fixture.auth;
else response = { status: 97, stdout: "${SECRET_SENTINEL}", stderr: "unsupported invocation" };
if (response.stdout) process.stdout.write(response.stdout);
if (response.stderr) process.stderr.write(response.stderr);
process.exitCode = response.status ?? 0;
`;

function defaultFixture() {
  return {
    version: { status: 0, stdout: "2.1.226 (Claude Code)\n", stderr: "" },
    help: { status: 0, stdout: `${DEFAULT_HELP}\n`, stderr: "" },
    auth: {
      status: 0,
      stdout: `${JSON.stringify({
        loggedIn: true,
        authMethod: "oauth",
        apiProvider: "firstParty",
        subscriptionType: "max",
        email: IDENTITY_SENTINEL,
        displayName: CONTROL_SENTINEL,
        token: SECRET_SENTINEL,
      })}\n`,
      stderr: "",
    },
  };
}

function cleanEnvironment(fakeDirectory: string, fixturePath: string, logPath: string) {
  const environment: Record<string, string> = {
    PATH: [fakeDirectory, dirname(process.execPath), process.env.PATH ?? ""]
      .filter(Boolean)
      .join(delimiter),
    FAKE_CLAUDE_FIXTURE: fixturePath,
    FAKE_CLAUDE_LOG: logPath,
  };
  for (const name of ["TMPDIR", "TMP", "TEMP", "SYSTEMROOT", "WINDIR"]) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return environment;
}

async function createHarness(t: any, fixture = defaultFixture()) {
  const directory = await mkdtemp(join(tmpdir(), "pi-forge-herdr-claude-"));
  const executable = join(directory, "claude");
  const fixturePath = join(directory, "fixture.json");
  const logPath = join(directory, "invocations.jsonl");
  await writeFile(executable, FAKE_CLAUDE_SOURCE, "utf8");
  await chmod(executable, 0o755);
  await writeFile(fixturePath, JSON.stringify(fixture), "utf8");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const environment = cleanEnvironment(directory, fixturePath, logPath);
  return {
    directory,
    environment,
    invoke(args: string[], overrides: Record<string, string> = {}) {
      return spawnSync(process.execPath, [SCRIPT, ...args], {
        cwd: ROOT,
        env: { ...environment, ...overrides },
        shell: false,
        encoding: "utf8",
        timeout: 15_000,
        maxBuffer: 256 * 1024,
      });
    },
    async invocations() {
      try {
        const content = await readFile(logPath, "utf8");
        return content.trim() ? content.trim().split("\n").map((line) => JSON.parse(line)) : [];
      } catch (error: any) {
        if (error?.code === "ENOENT") return [];
        throw error;
      }
    },
  };
}

function assertNoSensitiveOutput(result: any, temporaryDirectory?: string) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  for (const sentinel of [SECRET_SENTINEL, IDENTITY_SENTINEL, "CONTROL_SENTINEL", "SECOND_LINE"]) {
    assert.ok(!output.includes(sentinel), `output leaked sentinel ${sentinel}`);
  }
  if (temporaryDirectory) assert.ok(!output.includes(temporaryDirectory), "output leaked a local path");
}

function assertFixedError(result: any, code: string, temporaryDirectory?: string) {
  assert.notEqual(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.ok(CLAUDE_PREFLIGHT_ERROR_CODES.includes(code));
  assert.equal(
    result.stdout,
    `${JSON.stringify({ schemaVersion: 1, status: "error", code })}\n`,
  );
  assertNoSensitiveOutput(result, temporaryDirectory);
}

function expectedArguments(model: string, role: "read-only" | "writer") {
  return ["--model", model, ...CLAUDE_ROLE_ARGUMENT_TAILS[role]];
}

const POSIX_ONLY = process.platform === "win32";

// The production runner deliberately uses shell:false. A script fixture therefore needs POSIX executable semantics.
test("direct-Claude policy constants are frozen and closed", () => {
  assert.ok(Object.isFrozen(CLAUDE_LAUNCH_POLICY));
  assert.ok(Object.isFrozen(CLAUDE_LAUNCH_POLICY.models));
  assert.ok(Object.isFrozen(CLAUDE_LAUNCH_POLICY.roles));
  assert.ok(Object.isFrozen(CLAUDE_ROLE_ARGUMENT_TAILS));
  assert.ok(Object.isFrozen(CLAUDE_ROLE_ARGUMENT_TAILS["read-only"]));
  assert.ok(Object.isFrozen(CLAUDE_ROLE_ARGUMENT_TAILS.writer));
  assert.ok(Object.isFrozen(CLAUDE_LAUNCH_POLICY.preflightInvocations));
  assert.ok(Object.isFrozen(CLAUDE_LAUNCH_POLICY.preflightInvocations.version));
  assert.ok(Object.isFrozen(CLAUDE_LAUNCH_POLICY.errorCodes));
  assert.deepEqual(CLAUDE_LAUNCH_POLICY.models, ["claude-fable-5", "claude-opus-5"]);
  assert.deepEqual(CLAUDE_LAUNCH_POLICY.roles, ["read-only", "writer"]);
  assert.deepEqual(CLAUDE_LAUNCH_POLICY.preflightInvocations, {
    version: ["--version"],
    help: ["--help"],
    auth: ["auth", "status", "--json"],
  });
  assert.equal(CLAUDE_LAUNCH_POLICY.errorCodes, CLAUDE_PREFLIGHT_ERROR_CODES);
  assert.deepEqual(CLAUDE_ROUTE_EVIDENCE, {
    source: "claude-auth-status",
    meaning: "cli-declared-first-party-route-for-current-environment",
    limitation: "not-cryptographic-endpoint-attestation",
  });
});

test("Fable read-only success emits one sanitized descriptor after exactly three calls", { skip: POSIX_ONLY }, async (t) => {
  const harness = await createHarness(t);
  const result = harness.invoke(["--model", "claude-fable-5", "--role", "read-only"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assertNoSensitiveOutput(result, harness.directory);
  const descriptor = JSON.parse(result.stdout);
  assert.deepEqual(descriptor, {
    schemaVersion: 1,
    status: "ready",
    readiness: {
      version: "2.1.226",
      loggedIn: true,
      authMethod: "oauth",
      apiProvider: "firstParty",
      subscriptionType: "max",
      requiredFlags: Object.fromEntries(CLAUDE_REQUIRED_HELP_FLAGS.map((flag) => [flag, true])),
      conflictingVariables: CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES.map((name) => ({ name, present: false })),
    },
    routeEvidence: { ...CLAUDE_ROUTE_EVIDENCE },
    launch: {
      kind: "claude",
      model: "claude-fable-5",
      role: "read-only",
      agentArgs: expectedArguments("claude-fable-5", "read-only"),
    },
  });
  assert.deepEqual(await harness.invocations(), [
    ["--version"],
    ["--help"],
    ["auth", "status", "--json"],
  ]);
});

test("Opus writer success emits the exact writer argv after exactly three calls", { skip: POSIX_ONLY }, async (t) => {
  const harness = await createHarness(t);
  const result = harness.invoke(["--model", "claude-opus-5", "--role", "writer"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assertNoSensitiveOutput(result, harness.directory);
  const descriptor = JSON.parse(result.stdout);
  assert.deepEqual(descriptor.launch, {
    kind: "claude",
    model: "claude-opus-5",
    role: "writer",
    agentArgs: expectedArguments("claude-opus-5", "writer"),
  });
  assert.deepEqual(await harness.invocations(), [
    ["--version"],
    ["--help"],
    ["auth", "status", "--json"],
  ]);
});

test("closed CLI rejects aliases, other models, roles, reordering, duplicates, and extras before spawn", { skip: POSIX_ONLY }, async (t) => {
  const invalidInputs = [
    [],
    ["--model", "fable", "--role", "read-only"],
    ["--model", "opus", "--role", "writer"],
    ["--model", "claude-sonnet-5", "--role", "read-only"],
    ["--model", "claude-fable-5", "--role", "reviewer"],
    ["--role", "read-only", "--model", "claude-fable-5"],
    ["--model", "claude-fable-5", "--model", "claude-opus-5", "--role", "read-only"],
    ["--model", "claude-fable-5", "--role", "read-only", "--role", "writer"],
    ["--model", "claude-fable-5", "--role", "read-only", "--extra"],
  ];

  for (const [index, input] of invalidInputs.entries()) {
    await t.test(`invalid input ${index + 1}`, async (subtest) => {
      const harness = await createHarness(subtest);
      const result = harness.invoke(input);
      assertFixedError(result, "INVALID_INPUT", harness.directory);
      assert.deepEqual(await harness.invocations(), []);
    });
  }
});

test("version validation rejects below-floor, prerelease, and malformed output without retry", { skip: POSIX_ONLY }, async (t) => {
  const cases = [
    ["2.1.225\n", "VERSION_UNSUPPORTED"],
    ["2.1.226-beta.1\n", "VERSION_INVALID"],
    ["v2.1.226\n", "VERSION_INVALID"],
    ["02.1.226\n", "VERSION_INVALID"],
    ["2.1\n", "VERSION_INVALID"],
  ];
  for (const [version, code] of cases) {
    await t.test(code + version, async (subtest) => {
      const fixture = defaultFixture();
      fixture.version.stdout = version;
      const harness = await createHarness(subtest, fixture);
      const result = harness.invoke(["--model", "claude-fable-5", "--role", "read-only"]);
      assertFixedError(result, code, harness.directory);
      assert.deepEqual(await harness.invocations(), [["--version"]]);
    });
  }
});

test("missing required help flag stops after the one help call", { skip: POSIX_ONLY }, async (t) => {
  const fixture = defaultFixture();
  fixture.help.stdout = `${CLAUDE_REQUIRED_HELP_FLAGS.filter((flag) => flag !== "--tools").join("\n")}\n`;
  const harness = await createHarness(t, fixture);
  const result = harness.invoke(["--model", "claude-fable-5", "--role", "read-only"]);

  assertFixedError(result, "HELP_REQUIRED_FLAG_MISSING", harness.directory);
  assert.deepEqual(await harness.invocations(), [["--version"], ["--help"]]);
});

test("command failures capture secret stdout and stderr without leak or retry", { skip: POSIX_ONLY }, async (t) => {
  for (const [stage, code, expectedCalls] of [
    ["version", "VERSION_EXECUTION_FAILED", [["--version"]]],
    ["help", "HELP_EXECUTION_FAILED", [["--version"], ["--help"]]],
    ["auth", "AUTH_EXECUTION_FAILED", [["--version"], ["--help"], ["auth", "status", "--json"]]],
  ] as const) {
    await t.test(stage, async (subtest) => {
      const fixture = defaultFixture();
      fixture[stage] = {
        status: 9,
        stdout: `${SECRET_SENTINEL}\n`,
        stderr: `${IDENTITY_SENTINEL}\n${CONTROL_SENTINEL}\n`,
      };
      const harness = await createHarness(subtest, fixture);
      const result = harness.invoke(["--model", "claude-fable-5", "--role", "read-only"]);
      assertFixedError(result, code, harness.directory);
      assert.deepEqual(await harness.invocations(), expectedCalls);
    });
  }
});

test("auth failures are fixed, sanitized, and never retried", { skip: POSIX_ONLY }, async (t) => {
  const cases = [
    ["malformed", `{not-json ${SECRET_SENTINEL}`, "AUTH_JSON_INVALID"],
    ["array", "[]", "AUTH_JSON_INVALID"],
    ["logged-out", JSON.stringify({ loggedIn: false, apiProvider: "firstParty", authMethod: "oauth", subscriptionType: "max", token: SECRET_SENTINEL }), "AUTH_NOT_LOGGED_IN"],
    ["wrong-provider", JSON.stringify({ loggedIn: true, apiProvider: IDENTITY_SENTINEL, authMethod: "oauth", subscriptionType: "max" }), "AUTH_PROVIDER_MISMATCH"],
    ["missing-method", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", subscriptionType: "max" }), "AUTH_METHOD_UNSAFE"],
    ["empty-method", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "", subscriptionType: "max" }), "AUTH_METHOD_UNSAFE"],
    ["identity-method", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: IDENTITY_SENTINEL, subscriptionType: "max" }), "AUTH_METHOD_UNSAFE"],
    ["arbitrary-method", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "unknown-safe-token", subscriptionType: "max" }), "AUTH_METHOD_UNSAFE"],
    ["control-method", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: CONTROL_SENTINEL, subscriptionType: "max" }), "AUTH_METHOD_UNSAFE"],
    ["missing-type", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "oauth" }), "SUBSCRIPTION_TYPE_UNSAFE"],
    ["empty-type", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "oauth", subscriptionType: "" }), "SUBSCRIPTION_TYPE_UNSAFE"],
    ["identity-type", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "oauth", subscriptionType: IDENTITY_SENTINEL }), "SUBSCRIPTION_TYPE_UNSAFE"],
    ["arbitrary-type", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "oauth", subscriptionType: "unknown-safe-token" }), "SUBSCRIPTION_TYPE_UNSAFE"],
    ["control-type", JSON.stringify({ loggedIn: true, apiProvider: "firstParty", authMethod: "oauth", subscriptionType: CONTROL_SENTINEL }), "SUBSCRIPTION_TYPE_UNSAFE"],
  ];

  for (const [name, authOutput, code] of cases) {
    await t.test(name, async (subtest) => {
      const fixture = defaultFixture();
      fixture.auth.stdout = `${authOutput}\n`;
      const harness = await createHarness(subtest, fixture);
      const result = harness.invoke(["--model", "claude-opus-5", "--role", "writer"]);
      assertFixedError(result, code, harness.directory);
      assert.deepEqual(await harness.invocations(), [
        ["--version"],
        ["--help"],
        ["auth", "status", "--json"],
      ]);
    });
  }
});

test("oversized captured output fails with one fixed code and no sentinel leak", { skip: POSIX_ONLY }, async (t) => {
  const fixture = defaultFixture();
  fixture.version.stdout = `${SECRET_SENTINEL}${"x".repeat(CLAUDE_COMMAND_MAX_BUFFER_BYTES + 1024)}`;
  const harness = await createHarness(t, fixture);
  const result = harness.invoke(["--model", "claude-fable-5", "--role", "read-only"]);

  assertFixedError(result, "VERSION_OUTPUT_TOO_LARGE", harness.directory);
  assert.deepEqual(await harness.invocations(), [["--version"]]);
});

test("every routing and proxy variable conflicts by presence before spawn", { skip: POSIX_ONLY }, async (t) => {
  for (const name of CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES) {
    await t.test(name, async (subtest) => {
      const harness = await createHarness(subtest);
      const result = harness.invoke(
        ["--model", "claude-fable-5", "--role", "read-only"],
        { [name]: "" },
      );
      assertFixedError(result, "ENVIRONMENT_CONFLICT", harness.directory);
      assert.deepEqual(await harness.invocations(), []);
    });
  }
});
