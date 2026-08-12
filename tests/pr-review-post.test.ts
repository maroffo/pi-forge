import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PostReviewError,
  buildGhApiArgs,
  loadInput,
  postPullRequestReview,
  requestWithGh,
  reviewMarker,
  validatePostReviewInput,
} from "../skills/pr-review/scripts/post-review.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const ADVANCED_HEAD = "c".repeat(40);

function input(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    repository: "octo/example",
    pullRequest: 42,
    headRefOid: HEAD,
    baseRefOid: BASE,
    report: "# APPROVE: keep the change\n\nNo findings.",
    findings: [],
    ...overrides,
  };
}

function snapshot(head = HEAD, base = BASE) {
  return { head: { sha: head }, base: { sha: base } };
}

function review(body: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    html_url: "https://github.com/octo/example/pull/42#pullrequestreview-123",
    user: { login: "reviewer" },
    state: "COMMENTED",
    body,
    commit_id: HEAD,
    ...overrides,
  };
}

type Request = {
  endpoint: string;
  method?: string;
  body?: unknown;
  paginate?: boolean;
};

type Step = {
  check: (request: Request) => void;
  result?: unknown;
  error?: Error;
};

function scripted(steps: Step[]) {
  const calls: Request[] = [];
  const request = async (value: Request) => {
    calls.push(structuredClone(value));
    const step = steps.shift();
    assert.ok(step, `unexpected request: ${JSON.stringify(value)}`);
    step.check(value);
    if (step.error) throw step.error;
    return structuredClone(step.result);
  };
  return { calls, request, remaining: () => steps.length };
}

const isUser = (request: Request) => assert.equal(request.endpoint, "user");
const isPull = (request: Request) => assert.equal(request.endpoint, "repos/octo/example/pulls/42");
const isReviews = (request: Request) => {
  assert.equal(request.endpoint, "repos/octo/example/pulls/42/reviews?per_page=100");
  assert.equal(request.paginate, true);
};
const isPost = (request: Request) => {
  assert.equal(request.endpoint, "repos/octo/example/pulls/42/reviews");
  assert.equal(request.method, "POST");
};

function baseSteps() {
  return [
    { check: isUser, result: { login: "reviewer" } },
    { check: isPull, result: snapshot() },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot() },
    { check: isPull, result: snapshot() },
  ];
}

test("posts the complete no-finding report as one COMMENT review", async () => {
  let submittedBody: any;
  const fixture = input();
  const script = scripted([
    ...baseSteps(),
    {
      check(request) {
        isPost(request);
        submittedBody = request.body;
      },
      result: review(`${fixture.report}\n\n${reviewMarker(fixture)}`),
    },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "posted");
  assert.equal(result.attempts, 1);
  assert.equal(result.review.currentReportPublished, true);
  assert.equal(result.review.requestedReportMatchesExisting, true);
  assert.equal(script.remaining(), 0);
  assert.equal(submittedBody.event, "COMMENT");
  assert.equal(submittedBody.commit_id, HEAD);
  assert.ok(submittedBody.body.startsWith(fixture.report));
  assert.ok(submittedBody.body.endsWith(reviewMarker(fixture)));
  assert.equal("comments" in submittedBody, false);
});

test("submits every verified severity inline in the same review request", async () => {
  const findings = ["Critical", "Major", "Minor"].map((severity, index) => ({
    severity,
    path: `src/file-${index}.ts`,
    line: index + 10,
    side: index === 0 ? "LEFT" : "RIGHT",
    body: `${severity} evidence and required fix`,
    verified: true,
  }));
  const fixture = input({ findings });
  let submittedBody: any;
  const script = scripted([
    ...baseSteps(),
    {
      check(request) {
        isPost(request);
        submittedBody = request.body;
      },
      result: review(`${fixture.report}\n\n${reviewMarker(fixture)}`),
    },
  ]);

  await postPullRequestReview(fixture, { request: script.request });

  assert.deepEqual(
    submittedBody.comments,
    findings.map((finding) => ({
      path: finding.path,
      line: finding.line,
      side: finding.side,
      body: `**${finding.severity}**\n\n${finding.body}`,
    })),
  );
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("skips an owned review with the same immutable snapshot marker", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    { check: isUser, result: { login: "reviewer" } },
    { check: isPull, result: snapshot() },
    { check: isReviews, result: [[review(`old report\n\n${marker}`)]] },
    { check: isPull, result: snapshot() },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "already-posted");
  assert.equal(result.attempts, 0);
  assert.equal(result.review.currentReportPublished, false);
  assert.equal(result.review.requestedReportMatchesExisting, false);
  assert.equal(script.calls.some((call) => call.method === "POST"), false);
  assert.equal(script.remaining(), 0);
});

test("does not trust another author's copied snapshot marker", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    { check: isUser, result: { login: "reviewer" } },
    { check: isPull, result: snapshot() },
    {
      check: isReviews,
      result: [[review(`copied ${marker}`, { user: { login: "someone-else" } })]],
    },
    { check: isPull, result: snapshot() },
    { check: isPull, result: snapshot() },
    { check: isPost, result: review(`${fixture.report}\n\n${marker}`) },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "posted");
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("does not accept an owned marker attached to a different commit", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    { check: isUser, result: { login: "reviewer" } },
    { check: isPull, result: snapshot() },
    {
      check: isReviews,
      result: [[review(`copied ${marker}`, { commit_id: ADVANCED_HEAD })]],
    },
    { check: isPull, result: snapshot() },
    { check: isPull, result: snapshot() },
    { check: isPost, result: review(`${fixture.report}\n\n${marker}`) },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "posted");
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("stops before posting when the snapshot changes adjacent to submission", async () => {
  const script = scripted([
    { check: isUser, result: { login: "reviewer" } },
    { check: isPull, result: snapshot() },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot(ADVANCED_HEAD) },
  ]);

  await assert.rejects(
    postPullRequestReview(input(), { request: script.request }),
    (error: any) => error instanceof PostReviewError && error.code === "snapshot-changed",
  );
  assert.equal(script.calls.some((call) => call.method === "POST"), false);
});

test("reconciles an accepted first request without retrying", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    ...baseSteps(),
    { check: isPost, error: new PostReviewError("github-request-failed", "connection reset") },
    { check: isReviews, result: [[review(`${fixture.report}\n\n${marker}`)]] },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "posted-reconciled");
  assert.equal(result.attempts, 1);
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("retries once only after a definite pre-dispatch failure and confirmed absence", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    ...baseSteps(),
    {
      check: isPost,
      error: new PostReviewError("github-request-failed", "gh executable missing", {
        dispatchState: "not-started",
      }),
    },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot() },
    { check: isPost, result: review(`${fixture.report}\n\n${marker}`) },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "posted-after-retry");
  assert.equal(result.attempts, 2);
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 2);
});

test("does not retry a possibly dispatched request even when the marker is not yet visible", async () => {
  const script = scripted([
    ...baseSteps(),
    { check: isPost, error: new PostReviewError("github-request-failed", "connection reset") },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot() },
  ]);

  await assert.rejects(
    postPullRequestReview(input(), { request: script.request }),
    (error: any) => (
      error instanceof PostReviewError
      && error.code === "submission-ambiguous"
      && error.details.remoteState === "unknown"
    ),
  );
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("does not retry when reconciliation observes a changed snapshot", async () => {
  const script = scripted([
    ...baseSteps(),
    { check: isPost, error: new PostReviewError("github-request-failed", "connection reset") },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot(ADVANCED_HEAD) },
  ]);

  await assert.rejects(
    postPullRequestReview(input(), { request: script.request }),
    (error: any) => error instanceof PostReviewError && error.code === "snapshot-changed",
  );
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("does not retry when first reconciliation is unavailable", async () => {
  const script = scripted([
    ...baseSteps(),
    { check: isPost, error: new PostReviewError("github-request-failed", "connection reset") },
    { check: isReviews, error: new PostReviewError("github-request-failed", "offline") },
  ]);

  await assert.rejects(
    postPullRequestReview(input(), { request: script.request }),
    (error: any) => (
      error instanceof PostReviewError
      && error.code === "submission-ambiguous"
      && error.details.attempts === 1
    ),
  );
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("performs no third submission after two definite pre-dispatch failures", async () => {
  const notStarted = new PostReviewError("github-request-failed", "spawn failed", {
    dispatchState: "not-started",
  });
  const script = scripted([
    ...baseSteps(),
    { check: isPost, error: notStarted },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot() },
    { check: isPost, error: notStarted },
    { check: isReviews, result: [[]] },
    { check: isPull, result: snapshot() },
  ]);

  await assert.rejects(
    postPullRequestReview(input(), { request: script.request }),
    (error: any) => (
      error instanceof PostReviewError
      && error.code === "submission-failed"
      && error.details.attempts === 2
      && error.details.remoteState === "confirmed-absent"
    ),
  );
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 2);
});

test("reconciles a malformed successful response without retrying when the marker exists", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    ...baseSteps(),
    { check: isPost, result: { unexpected: true } },
    { check: isReviews, result: [[review(`${fixture.report}\n\n${marker}`)]] },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "posted-reconciled");
  assert.equal(result.attempts, 1);
  assert.equal(script.calls.filter((call) => call.method === "POST").length, 1);
});

test("finds an owned marker on a later paginated review page", async () => {
  const fixture = input();
  const marker = reviewMarker(fixture);
  const script = scripted([
    { check: isUser, result: { login: "reviewer" } },
    { check: isPull, result: snapshot() },
    {
      check: isReviews,
      result: [[review("unrelated review")], [review(`${fixture.report}\n\n${marker}`)]],
    },
    { check: isPull, result: snapshot() },
  ]);

  const result = await postPullRequestReview(fixture, { request: script.request });

  assert.equal(result.status, "already-posted");
  assert.equal(script.calls.some((call) => call.method === "POST"), false);
});

test("rejects an unverified inline finding before any GitHub request", async () => {
  const fixture = input({
    findings: [{
      severity: "Major",
      path: "src/index.ts",
      line: 1,
      side: "RIGHT",
      body: "claim",
      verified: false,
    }],
  });
  let called = false;

  assert.throws(
    () => validatePostReviewInput(fixture),
    (error: any) => error instanceof PostReviewError && error.code === "unverified-finding",
  );
  await assert.rejects(
    postPullRequestReview(fixture, { request: async () => { called = true; } }),
    (error: any) => error instanceof PostReviewError && error.code === "unverified-finding",
  );
  assert.equal(called, false);
});

test("rejects a report above the GitHub review body bound before any request", async () => {
  const fixture = input({ report: "x".repeat(65_001) });
  let called = false;

  await assert.rejects(
    postPullRequestReview(fixture, { request: async () => { called = true; } }),
    (error: any) => (
      error instanceof PostReviewError
      && error.code === "limit-exceeded"
      && error.details.actual === 65_001
      && error.details.maximum === 65_000
    ),
  );
  assert.equal(called, false);
});

test("builds gh api argv without a shell or report text in arguments", () => {
  const args = buildGhApiArgs({
    endpoint: "repos/octo/example/pulls/42/reviews",
    method: "POST",
    hasInput: true,
  });

  assert.deepEqual(args.slice(0, 2), ["api", "repos/octo/example/pulls/42/reviews"]);
  assert.ok(args.includes("--method"));
  assert.deepEqual(args.slice(-2), ["--input", "-"]);
  assert.equal(args.some((arg) => arg.includes("APPROVE: keep the change")), false);
});

test("passes the review payload to gh through stdin", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-pr-review-gh-"));
  const executable = join(root, "fake-gh.mjs");
  await writeFile(executable, `#!/usr/bin/env node
let input = "";
for await (const chunk of process.stdin) input += chunk;
process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), input: JSON.parse(input) }));
`);
  await chmod(executable, 0o700);

  try {
    const payload = { event: "COMMENT", body: "complete report" };
    const result = requestWithGh({
      endpoint: "repos/octo/example/pulls/42/reviews",
      method: "POST",
      body: payload,
    }, { executable });

    assert.deepEqual(result.input, payload);
    assert.deepEqual(result.argv.slice(0, 2), ["api", "repos/octo/example/pulls/42/reviews"]);
    assert.deepEqual(result.argv.slice(-2), ["--input", "-"]);
    assert.equal(result.argv.includes("complete report"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("input-file guard rejects unsafe filesystem shapes and accepts the size boundary", async (t) => {
  if (process.platform === "win32") t.skip("POSIX mode bits and symlink behavior are platform-specific");

  const root = await mkdtemp(join(tmpdir(), "pi-forge-pr-review-input-"));
  const valid = join(root, "valid.json");
  const permissive = join(root, "permissive.json");
  const oversized = join(root, "oversized.json");
  const symlink = join(root, "symlink.json");
  const directory = join(root, "directory");
  await writeFile(valid, JSON.stringify(input()), { mode: 0o600 });
  await writeFile(permissive, JSON.stringify(input()), { mode: 0o644 });
  await writeFile(oversized, "x".repeat(2 * 1024 * 1024 + 1), { mode: 0o600 });
  await import("node:fs/promises").then(({ mkdir, symlink: makeSymlink }) => Promise.all([
    mkdir(directory),
    makeSymlink(valid, symlink),
  ]));

  try {
    assert.equal((await loadInput(valid)).repository, "octo/example");
    for (const path of [permissive, oversized, symlink, directory]) {
      await assert.rejects(
        loadInput(path),
        (error: any) => error instanceof PostReviewError && error.code === "invalid-input-file",
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI publishes through the fake gh transport with a protected input file", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-pr-review-cli-"));
  const executable = join(root, "gh");
  const inputPath = join(root, "review.json");
  const scriptPath = join(
    process.cwd(),
    "skills/pr-review/scripts/post-review.mjs",
  );
  const fixture = input();

  await writeFile(executable, `#!/usr/bin/env node
const args = process.argv.slice(2);
const endpoint = args[1];
let input = "";
for await (const chunk of process.stdin) input += chunk;
if (endpoint === "user") {
  process.stdout.write(JSON.stringify({ login: "reviewer" }));
} else if (endpoint === "repos/octo/example/pulls/42") {
  process.stdout.write(JSON.stringify({ head: { sha: "${HEAD}" }, base: { sha: "${BASE}" } }));
} else if (endpoint.endsWith("reviews?per_page=100")) {
  process.stdout.write("[[]]");
} else if (endpoint.endsWith("/reviews") && args.includes("POST")) {
  const payload = JSON.parse(input);
  process.stdout.write(JSON.stringify({
    id: 321,
    html_url: "https://github.com/octo/example/pull/42#pullrequestreview-321",
    user: { login: "reviewer" },
    state: "COMMENTED",
    body: payload.body,
    commit_id: payload.commit_id,
  }));
} else {
  process.stderr.write("unexpected fake gh request");
  process.exitCode = 1;
}
`);
  await chmod(executable, 0o700);
  await writeFile(inputPath, JSON.stringify(fixture), { mode: 0o600 });

  try {
    const result = spawnSync(process.execPath, [scriptPath, "--input", inputPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PATH: `${root}:${process.env.PATH ?? ""}` },
      timeout: 10_000,
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "posted");
    assert.equal(output.attempts, 1);
    assert.equal(output.review.id, 321);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
