#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_VERSION = "2022-11-28";
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_REPORT_CHARS = 65_000;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_FINDINGS = 100;
const DEFINITE_PRE_DISPATCH_CODES = new Set(["EACCES", "ENOENT", "ENOTDIR"]);
const SEVERITIES = new Set(["Critical", "Major", "Minor"]);
const SIDES = new Set(["LEFT", "RIGHT"]);

export class PostReviewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PostReviewError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PostReviewError(code, message, details);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, label, maxLength = 1_000_000) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("invalid-input", `${label} must be a non-empty string`);
  }
  if (value.length > maxLength) fail("invalid-input", `${label} is too large`);
  return value;
}

function validateRepository(value) {
  const repository = requiredString(value, "repository", 200);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    fail("invalid-input", "repository must be an owner/name pair");
  }
  return repository;
}

function validateOid(value, label) {
  const oid = requiredString(value, label, 64).toLowerCase();
  if (!/^[0-9a-f]{40,64}$/.test(oid)) {
    fail("invalid-input", `${label} must be a full hexadecimal Git object ID`);
  }
  return oid;
}

function validatePath(value, index) {
  const path = requiredString(value, `findings[${index}].path`, 4_096);
  if (
    path.startsWith("/")
    || path.includes("\\")
    || path.split("/").some((part) => part === "" || part === "." || part === "..")
    || /[\u0000-\u001f\u007f]/.test(path)
  ) {
    fail("invalid-input", `findings[${index}].path must be a normalized repository-relative path`);
  }
  return path;
}

function validateFinding(value, index) {
  if (!plainObject(value)) fail("invalid-input", `findings[${index}] must be an object`);
  if (value.verified !== true) {
    fail("unverified-finding", `findings[${index}] is not parent-verified`);
  }
  if (!SEVERITIES.has(value.severity)) {
    fail("invalid-input", `findings[${index}].severity must be Critical, Major, or Minor`);
  }
  if (!Number.isSafeInteger(value.line) || value.line < 1) {
    fail("invalid-input", `findings[${index}].line must be a positive integer`);
  }
  if (!SIDES.has(value.side)) {
    fail("invalid-input", `findings[${index}].side must be LEFT or RIGHT`);
  }
  return {
    severity: value.severity,
    path: validatePath(value.path, index),
    line: value.line,
    side: value.side,
    body: requiredString(value.body, `findings[${index}].body`, 65_000).trim(),
    verified: true,
  };
}

export function validatePostReviewInput(value) {
  if (!plainObject(value)) fail("invalid-input", "input must be a JSON object");
  if (value.schemaVersion !== 1) fail("invalid-input", "schemaVersion must be 1");
  if (!Number.isSafeInteger(value.pullRequest) || value.pullRequest < 1) {
    fail("invalid-input", "pullRequest must be a positive integer");
  }
  if (!Array.isArray(value.findings)) fail("invalid-input", "findings must be an array");
  if (value.findings.length > MAX_FINDINGS) {
    fail("limit-exceeded", `findings contains ${value.findings.length} entries; maximum is ${MAX_FINDINGS}`, {
      actual: value.findings.length,
      maximum: MAX_FINDINGS,
    });
  }
  return {
    schemaVersion: 1,
    repository: validateRepository(value.repository),
    pullRequest: value.pullRequest,
    headRefOid: validateOid(value.headRefOid, "headRefOid"),
    baseRefOid: validateOid(value.baseRefOid, "baseRefOid"),
    report: (() => {
      const report = requiredString(value.report, "report");
      if (report.length > MAX_REPORT_CHARS) {
        fail("limit-exceeded", `report contains ${report.length} characters; maximum is ${MAX_REPORT_CHARS}`, {
          actual: report.length,
          maximum: MAX_REPORT_CHARS,
        });
      }
      return report.trim();
    })(),
    findings: value.findings.map(validateFinding),
  };
}

export function reviewMarker(input) {
  return `<!-- pi-forge-pr-review:v1 repo=${input.repository} pr=${input.pullRequest} base=${input.baseRefOid} head=${input.headRefOid} -->`;
}

export function buildGhApiArgs({ endpoint, method = "GET", paginate = false, hasInput = false }) {
  const args = [
    "api",
    endpoint,
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    `X-GitHub-Api-Version: ${API_VERSION}`,
  ];
  if (method !== "GET") args.push("--method", method);
  if (paginate) args.push("--paginate", "--slurp");
  if (hasInput) args.push("--input", "-");
  return args;
}

function boundedDiagnostic(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "?")
    .trim()
    .slice(-2_048);
}

export function requestWithGh({ endpoint, method = "GET", body, paginate = false }, options = {}) {
  const hasInput = body !== undefined;
  const result = spawnSync(
    options.executable ?? "gh",
    buildGhApiArgs({ endpoint, method, paginate, hasInput }),
    {
      encoding: "utf8",
      env: options.env ?? process.env,
      input: hasInput ? JSON.stringify(body) : undefined,
      maxBuffer: MAX_OUTPUT_BYTES,
      shell: false,
      timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    },
  );
  if (result.error || result.status !== 0 || result.signal) {
    fail(
      "github-request-failed",
      "GitHub CLI request failed",
      {
        diagnostic: boundedDiagnostic(result.stderr || result.stdout || result.error?.message),
        dispatchState: result.error && DEFINITE_PRE_DISPATCH_CODES.has(result.error.code)
          ? "not-started"
          : "possibly-started",
        exitCode: result.status,
        signal: result.signal ?? null,
      },
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("github-response-invalid", "GitHub CLI returned a non-JSON response");
  }
}

function parseSnapshot(value) {
  const headRefOid = value?.head?.sha;
  const baseRefOid = value?.base?.sha;
  if (typeof headRefOid !== "string" || typeof baseRefOid !== "string") {
    fail("github-response-invalid", "GitHub pull request response omitted immutable object IDs");
  }
  return {
    headRefOid: headRefOid.toLowerCase(),
    baseRefOid: baseRefOid.toLowerCase(),
  };
}

function assertSnapshot(expected, actual, phase) {
  if (expected.headRefOid !== actual.headRefOid || expected.baseRefOid !== actual.baseRefOid) {
    fail("snapshot-changed", `pull request snapshot changed ${phase}`, {
      expectedHeadRefOid: expected.headRefOid,
      expectedBaseRefOid: expected.baseRefOid,
      actualHeadRefOid: actual.headRefOid,
      actualBaseRefOid: actual.baseRefOid,
    });
  }
}

function flattenReviewPages(value) {
  if (!Array.isArray(value)) fail("github-response-invalid", "GitHub reviews response was not an array");
  const reviews = value.every(Array.isArray) ? value.flat() : value;
  if (!reviews.every(plainObject)) {
    fail("github-response-invalid", "GitHub reviews response contained an invalid review");
  }
  return reviews;
}

function findOwnedReview(reviews, login, marker, headRefOid) {
  return reviews.find((review) => (
    review?.user?.login === login
    && review.state === "COMMENTED"
    && typeof review.commit_id === "string"
    && review.commit_id.toLowerCase() === headRefOid
    && typeof review.body === "string"
    && review.body.endsWith(`\n\n${marker}`)
  ));
}

function reviewReceipt(review, details = {}) {
  const id = Number.isSafeInteger(review?.id) ? review.id : null;
  const url = typeof review?.html_url === "string"
    ? review.html_url
    : typeof review?._links?.html?.href === "string"
      ? review._links.html.href
      : null;
  return { id, url, ...details };
}

function dispatchState(error) {
  return error instanceof PostReviewError && error.details?.dispatchState === "not-started"
    ? "not-started"
    : "possibly-started";
}

function inlineComment(finding) {
  return {
    path: finding.path,
    line: finding.line,
    side: finding.side,
    body: `**${finding.severity}**\n\n${finding.body}`,
  };
}

export async function postPullRequestReview(rawInput, options = {}) {
  const input = validatePostReviewInput(rawInput);
  const request = options.request ?? requestWithGh;
  const marker = reviewMarker(input);
  const endpoint = `repos/${input.repository}/pulls/${input.pullRequest}`;
  const reviewsEndpoint = `${endpoint}/reviews?per_page=100`;
  const expected = {
    headRefOid: input.headRefOid,
    baseRefOid: input.baseRefOid,
  };

  const user = await request({ endpoint: "user" });
  const login = requiredString(user?.login, "authenticated GitHub login", 200);

  const getSnapshot = async () => parseSnapshot(await request({ endpoint }));
  const listReviews = async () => flattenReviewPages(await request({
    endpoint: reviewsEndpoint,
    paginate: true,
  }));

  const body = `${input.report}\n\n${marker}`;
  const receipt = (review, details = {}) => reviewReceipt(review, {
    requestedReportMatchesExisting: review.body === body,
    ...details,
  });

  assertSnapshot(expected, await getSnapshot(), "before idempotency check");
  const reviews = await listReviews();
  assertSnapshot(expected, await getSnapshot(), "after idempotency check");
  const existing = findOwnedReview(reviews, login, marker, input.headRefOid);
  if (existing) {
    return {
      schemaVersion: 1,
      status: "already-posted",
      attempts: 0,
      snapshot: expected,
      review: receipt(existing, { currentReportPublished: false }),
    };
  }

  const reviewRequest = {
    commit_id: input.headRefOid,
    body,
    event: "COMMENT",
    ...(input.findings.length > 0
      ? { comments: input.findings.map(inlineComment) }
      : {}),
  };

  const reconcile = async () => {
    const currentReviews = await listReviews();
    const found = findOwnedReview(currentReviews, login, marker, input.headRefOid);
    if (found) return { found };
    const snapshot = await getSnapshot();
    assertSnapshot(expected, snapshot, "during submission reconciliation");
    return { found: null };
  };

  let attempts = 0;
  const submit = async () => {
    attempts += 1;
    const review = await request({ endpoint: `${endpoint}/reviews`, method: "POST", body: reviewRequest });
    if (
      !plainObject(review)
      || review?.user?.login !== login
      || review.state !== "COMMENTED"
      || typeof review.commit_id !== "string"
      || review.commit_id.toLowerCase() !== input.headRefOid
      || typeof review.body !== "string"
      || !review.body.endsWith(`\n\n${marker}`)
    ) {
      fail("github-response-invalid", "GitHub review response did not confirm the submitted snapshot review");
    }
    return review;
  };

  const successfulResult = (status, review) => ({
    schemaVersion: 1,
    status,
    attempts,
    snapshot: expected,
    review: receipt(review, { currentReportPublished: true }),
  });

  const ambiguous = (message, submissionError, reconciliationError) => fail(
    "submission-ambiguous",
    message,
    {
      attempts,
      remoteState: "unknown",
      snapshot: expected,
      submissionCode: submissionError?.code ?? "unknown",
      ...(reconciliationError
        ? { reconciliationCode: reconciliationError?.code ?? "unknown" }
        : {}),
    },
  );

  assertSnapshot(expected, await getSnapshot(), "immediately before submission");
  try {
    return successfulResult("posted", await submit());
  } catch (firstError) {
    let firstReconciliation;
    try {
      firstReconciliation = await reconcile();
    } catch (reconcileError) {
      if (reconcileError instanceof PostReviewError && reconcileError.code === "snapshot-changed") {
        throw reconcileError;
      }
      ambiguous(
        "review submission failed and reconciliation was inconclusive; no retry was attempted",
        firstError,
        reconcileError,
      );
    }
    if (firstReconciliation.found) {
      return successfulResult("posted-reconciled", firstReconciliation.found);
    }
    if (dispatchState(firstError) !== "not-started") {
      ambiguous(
        "the review marker is not visible, but the first request may have started; retry is unsafe",
        firstError,
      );
    }

    try {
      return successfulResult("posted-after-retry", await submit());
    } catch (secondError) {
      let secondReconciliation;
      try {
        secondReconciliation = await reconcile();
      } catch (reconcileError) {
        if (reconcileError instanceof PostReviewError && reconcileError.code === "snapshot-changed") {
          throw reconcileError;
        }
        ambiguous(
          "the retry failed and final reconciliation was inconclusive",
          secondError,
          reconcileError,
        );
      }
      if (secondReconciliation.found) {
        return successfulResult("posted-reconciled", secondReconciliation.found);
      }
      if (dispatchState(secondError) !== "not-started") {
        ambiguous(
          "the review marker is not visible, but the retry may have started",
          secondError,
        );
      }
      fail("submission-failed", "both submission attempts failed before dispatch", {
        attempts,
        remoteState: "confirmed-absent",
        snapshot: expected,
        submissionCode: secondError?.code ?? "unknown",
      });
    }
  }
}

export async function loadInput(path) {
  const stats = await lstat(path);
  if (
    !stats.isFile()
    || stats.isSymbolicLink()
    || stats.size > MAX_INPUT_BYTES
    || (process.platform !== "win32" && (stats.mode & 0o777) !== 0o600)
  ) {
    fail("invalid-input-file", "input must be an exact mode-0600 regular non-symlink file no larger than 2 MiB");
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail("invalid-input-file", "input file must contain valid JSON");
  }
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--input" || !argv[1]) {
    fail("usage", "Usage: post-review.mjs --input <review.json>");
  }
  return { input: argv[1] };
}

function publicError(error) {
  if (error instanceof PostReviewError) {
    return {
      schemaVersion: 1,
      status: "failed",
      code: error.code,
      message: error.message,
      attempts: Number.isSafeInteger(error.details?.attempts) ? error.details.attempts : 0,
      remoteState: error.details?.remoteState ?? "not-attempted",
      ...(Number.isSafeInteger(error.details?.actual) ? { actual: error.details.actual } : {}),
      ...(Number.isSafeInteger(error.details?.maximum) ? { maximum: error.details.maximum } : {}),
      ...(plainObject(error.details?.snapshot) ? { snapshot: error.details.snapshot } : {}),
    };
  }
  return {
    schemaVersion: 1,
    status: "failed",
    code: "unexpected-error",
    message: "unexpected review publication failure",
  };
}

async function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const result = await postPullRequestReview(await loadInput(args.input));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(publicError(error))}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) await main();
