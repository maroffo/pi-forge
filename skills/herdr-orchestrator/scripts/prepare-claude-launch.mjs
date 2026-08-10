#!/usr/bin/env node
// ABOUTME: Produces a sanitized, no-model Claude Code readiness and launch descriptor.
// ABOUTME: Owns the closed direct-Claude model, role, argument, and environment policy.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const CLAUDE_LAUNCH_SCHEMA_VERSION = 1;
export const MINIMUM_CLAUDE_CODE_VERSION = "2.1.226";
export const CLAUDE_COMMAND_TIMEOUT_MS = 5_000;
export const CLAUDE_COMMAND_MAX_BUFFER_BYTES = 64 * 1024;

export const CLAUDE_MODELS = Object.freeze([
  "claude-fable-5",
  "claude-opus-5",
]);

export const CLAUDE_ROLES = Object.freeze([
  "read-only",
  "writer",
]);

export const CLAUDE_REQUIRED_HELP_FLAGS = Object.freeze([
  "--model",
  "--safe-mode",
  "--permission-mode",
  "--tools",
  "--strict-mcp-config",
  "--no-chrome",
  "--disable-slash-commands",
]);

export const CLAUDE_AUTH_METHOD_TOKENS = Object.freeze([
  "claude.ai",
  "oauth",
  "oauth_token",
  "api_key",
  "console",
]);

export const CLAUDE_SUBSCRIPTION_TYPE_TOKENS = Object.freeze([
  "free",
  "pro",
  "max",
  "team",
  "enterprise",
  "api",
]);

export const CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES = Object.freeze([
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
]);

export const CLAUDE_PREFLIGHT_INVOCATIONS = Object.freeze({
  version: Object.freeze(["--version"]),
  help: Object.freeze(["--help"]),
  auth: Object.freeze(["auth", "status", "--json"]),
});

const READ_ONLY_ARGUMENT_TAIL = Object.freeze([
  "--safe-mode",
  "--permission-mode",
  "plan",
  "--strict-mcp-config",
  "--no-chrome",
  "--disable-slash-commands",
  "--tools",
  "Read,Grep,Glob",
]);

const WRITER_ARGUMENT_TAIL = Object.freeze([
  "--safe-mode",
  "--permission-mode",
  "acceptEdits",
  "--strict-mcp-config",
  "--no-chrome",
  "--disable-slash-commands",
  "--tools",
  "Read,Grep,Glob,Edit,Write,Bash",
]);

export const CLAUDE_ROLE_ARGUMENT_TAILS = Object.freeze({
  "read-only": READ_ONLY_ARGUMENT_TAIL,
  writer: WRITER_ARGUMENT_TAIL,
});

export const CLAUDE_ROUTE_EVIDENCE = Object.freeze({
  source: "claude-auth-status",
  meaning: "cli-declared-first-party-route-for-current-environment",
  limitation: "not-cryptographic-endpoint-attestation",
});

export const CLAUDE_PREFLIGHT_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "ENVIRONMENT_CONFLICT",
  "VERSION_EXECUTION_FAILED",
  "VERSION_TIMEOUT",
  "VERSION_OUTPUT_TOO_LARGE",
  "VERSION_INVALID",
  "VERSION_UNSUPPORTED",
  "HELP_EXECUTION_FAILED",
  "HELP_TIMEOUT",
  "HELP_OUTPUT_TOO_LARGE",
  "HELP_REQUIRED_FLAG_MISSING",
  "AUTH_EXECUTION_FAILED",
  "AUTH_TIMEOUT",
  "AUTH_OUTPUT_TOO_LARGE",
  "AUTH_JSON_INVALID",
  "AUTH_NOT_LOGGED_IN",
  "AUTH_PROVIDER_MISMATCH",
  "AUTH_METHOD_UNSAFE",
  "SUBSCRIPTION_TYPE_UNSAFE",
  "INTERNAL_FAILURE",
]);

export const CLAUDE_LAUNCH_POLICY = Object.freeze({
  schemaVersion: CLAUDE_LAUNCH_SCHEMA_VERSION,
  kind: "claude",
  minimumVersion: MINIMUM_CLAUDE_CODE_VERSION,
  commandTimeoutMs: CLAUDE_COMMAND_TIMEOUT_MS,
  commandMaxBufferBytes: CLAUDE_COMMAND_MAX_BUFFER_BYTES,
  models: CLAUDE_MODELS,
  roles: CLAUDE_ROLES,
  preflightInvocations: CLAUDE_PREFLIGHT_INVOCATIONS,
  requiredHelpFlags: CLAUDE_REQUIRED_HELP_FLAGS,
  authMethodTokens: CLAUDE_AUTH_METHOD_TOKENS,
  subscriptionTypeTokens: CLAUDE_SUBSCRIPTION_TYPE_TOKENS,
  conflictingEnvironmentVariables: CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES,
  roleArgumentTails: CLAUDE_ROLE_ARGUMENT_TAILS,
  routeEvidence: CLAUDE_ROUTE_EVIDENCE,
  errorCodes: CLAUDE_PREFLIGHT_ERROR_CODES,
});

const SAFE_AUTH_TOKEN = /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/;
const MINIMUM_VERSION_PARTS = Object.freeze(MINIMUM_CLAUDE_CODE_VERSION.split(".").map(Number));
const STAGE_ERRORS = Object.freeze({
  version: Object.freeze({
    execution: "VERSION_EXECUTION_FAILED",
    timeout: "VERSION_TIMEOUT",
    oversized: "VERSION_OUTPUT_TOO_LARGE",
  }),
  help: Object.freeze({
    execution: "HELP_EXECUTION_FAILED",
    timeout: "HELP_TIMEOUT",
    oversized: "HELP_OUTPUT_TOO_LARGE",
  }),
  auth: Object.freeze({
    execution: "AUTH_EXECUTION_FAILED",
    timeout: "AUTH_TIMEOUT",
    oversized: "AUTH_OUTPUT_TOO_LARGE",
  }),
});

function errorDescriptor(code) {
  return {
    schemaVersion: CLAUDE_LAUNCH_SCHEMA_VERSION,
    status: "error",
    code,
  };
}

function parseInput(argv) {
  if (
    argv.length !== 4
    || argv[0] !== "--model"
    || argv[2] !== "--role"
    || !CLAUDE_MODELS.includes(argv[1])
    || !CLAUDE_ROLES.includes(argv[3])
  ) return undefined;
  return { model: argv[1], role: argv[3] };
}

function hasEnvironmentConflict(environment) {
  return CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES.some(
    (name) => Object.prototype.hasOwnProperty.call(environment, name),
  );
}

function capturedBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value);
  return Buffer.alloc(0);
}

function runClaude(args, stage, environment) {
  const errors = STAGE_ERRORS[stage];
  let result;
  try {
    result = spawnSync("claude", args, {
      shell: false,
      windowsHide: true,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CLAUDE_COMMAND_TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: CLAUDE_COMMAND_MAX_BUFFER_BYTES,
    });
  } catch {
    return { error: errors.execution };
  }

  const stdout = capturedBytes(result?.stdout);
  const stderr = capturedBytes(result?.stderr);
  const errorCode = result?.error && typeof result.error === "object" ? result.error.code : undefined;
  if (errorCode === "ETIMEDOUT") return { error: errors.timeout };
  if (
    errorCode === "ENOBUFS"
    || stdout.length > CLAUDE_COMMAND_MAX_BUFFER_BYTES
    || stderr.length > CLAUDE_COMMAND_MAX_BUFFER_BYTES
  ) return { error: errors.oversized };
  if (result?.error || result?.signal || result?.status !== 0 || stderr.length !== 0) {
    return { error: errors.execution };
  }
  return { stdout: stdout.toString("utf8") };
}

function parseStableVersion(value) {
  const match = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})(?:\s+\(Claude Code\))?\s*$/.exec(value);
  if (!match) return undefined;
  return match.slice(1).map(Number);
}

function versionAtLeastMinimum(parts) {
  for (let index = 0; index < MINIMUM_VERSION_PARTS.length; index += 1) {
    if (parts[index] > MINIMUM_VERSION_PARTS[index]) return true;
    if (parts[index] < MINIMUM_VERSION_PARTS[index]) return false;
  }
  return true;
}

function helpHasFlag(help, flag) {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=$|[\\s=,<\\[])`, "m").test(help);
}

function safeAuthToken(value, allowedValues) {
  return typeof value === "string" && SAFE_AUTH_TOKEN.test(value) && allowedValues.includes(value);
}

function buildAgentArgs(model, role) {
  return ["--model", model, ...CLAUDE_ROLE_ARGUMENT_TAILS[role]];
}

export function prepareClaudeLaunch(argv, environment = process.env) {
  const input = parseInput(argv);
  if (!input) return errorDescriptor("INVALID_INPUT");
  if (hasEnvironmentConflict(environment)) return errorDescriptor("ENVIRONMENT_CONFLICT");

  const versionResult = runClaude(CLAUDE_PREFLIGHT_INVOCATIONS.version, "version", environment);
  if (versionResult.error) return errorDescriptor(versionResult.error);
  const versionParts = parseStableVersion(versionResult.stdout);
  if (!versionParts) return errorDescriptor("VERSION_INVALID");
  if (!versionAtLeastMinimum(versionParts)) return errorDescriptor("VERSION_UNSUPPORTED");
  const version = versionParts.join(".");

  const helpResult = runClaude(CLAUDE_PREFLIGHT_INVOCATIONS.help, "help", environment);
  if (helpResult.error) return errorDescriptor(helpResult.error);
  if (!CLAUDE_REQUIRED_HELP_FLAGS.every((flag) => helpHasFlag(helpResult.stdout, flag))) {
    return errorDescriptor("HELP_REQUIRED_FLAG_MISSING");
  }

  const authResult = runClaude(CLAUDE_PREFLIGHT_INVOCATIONS.auth, "auth", environment);
  if (authResult.error) return errorDescriptor(authResult.error);
  let auth;
  try {
    auth = JSON.parse(authResult.stdout);
  } catch {
    return errorDescriptor("AUTH_JSON_INVALID");
  }
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
    return errorDescriptor("AUTH_JSON_INVALID");
  }
  if (auth.loggedIn !== true) return errorDescriptor("AUTH_NOT_LOGGED_IN");
  if (auth.apiProvider !== "firstParty") return errorDescriptor("AUTH_PROVIDER_MISMATCH");
  if (!safeAuthToken(auth.authMethod, CLAUDE_AUTH_METHOD_TOKENS)) return errorDescriptor("AUTH_METHOD_UNSAFE");
  if (!safeAuthToken(auth.subscriptionType, CLAUDE_SUBSCRIPTION_TYPE_TOKENS)) {
    return errorDescriptor("SUBSCRIPTION_TYPE_UNSAFE");
  }

  return {
    schemaVersion: CLAUDE_LAUNCH_SCHEMA_VERSION,
    status: "ready",
    readiness: {
      version,
      loggedIn: true,
      authMethod: auth.authMethod,
      apiProvider: "firstParty",
      subscriptionType: auth.subscriptionType,
      requiredFlags: Object.fromEntries(CLAUDE_REQUIRED_HELP_FLAGS.map((flag) => [flag, true])),
      conflictingVariables: CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES.map((name) => ({ name, present: false })),
    },
    routeEvidence: { ...CLAUDE_ROUTE_EVIDENCE },
    launch: {
      kind: "claude",
      model: input.model,
      role: input.role,
      agentArgs: buildAgentArgs(input.model, input.role),
    },
  };
}

function main() {
  let descriptor;
  try {
    descriptor = prepareClaudeLaunch(process.argv.slice(2));
  } catch {
    descriptor = errorDescriptor("INTERNAL_FAILURE");
  }
  process.stdout.write(`${JSON.stringify(descriptor)}\n`);
  if (descriptor.status !== "ready") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
