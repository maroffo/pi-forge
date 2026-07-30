// ABOUTME: Tests a pi-subagents release against Pi Forge in an isolated temporary checkout.
// ABOUTME: Updates only the temporary copy, runs package tests, and cancels before any provider call.

import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SELECTOR_PATTERN = /^(?:latest|next|beta|canary|\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
const EXCLUDED_NAMES = new Set([".git", ".pi-subagents", "coverage", "node_modules"]);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
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
  });
}

async function resolveVersion(selector) {
  if (!SELECTOR_PATTERN.test(selector)) {
    throw new Error(`Unsupported version selector: ${selector}`);
  }
  if (VERSION_PATTERN.test(selector)) return selector;

  const { stdout } = await run(
    "npm",
    ["view", `pi-subagents@${selector}`, "version", "--json"],
    { capture: true },
  );
  const resolved = JSON.parse(stdout);
  if (typeof resolved !== "string" || !VERSION_PATTERN.test(resolved)) {
    throw new Error(`npm returned an invalid pi-subagents version for ${selector}`);
  }
  return resolved;
}

async function updateStagedVersion(stageRoot, currentVersion, targetVersion) {
  const packagePath = join(stageRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.dependencies["pi-subagents"] = targetVersion;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const replacements = [
    "src/second-opinion-config.js",
    "README.md",
    "docs/second-opinion.md",
  ];
  for (const relativePath of replacements) {
    const path = join(stageRoot, relativePath);
    const content = await readFile(path, "utf8");
    if (!content.includes(currentVersion)) {
      throw new Error(`${relativePath} does not contain pinned version ${currentVersion}`);
    }
    await writeFile(path, content.replaceAll(currentVersion, targetVersion));
  }
}

async function probeIsolatedRuntime(stageRoot, targetVersion) {
  const configDir = await mkdtemp(join(tmpdir(), "pi-forge-upgrade-config-"));
  await writeFile(join(configDir, "settings.json"), `${JSON.stringify({
    packages: [stageRoot],
  }, null, 2)}\n`);

  try {
    await new Promise((resolve, reject) => {
      const childEnvironment = Object.fromEntries(
        ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "CI", "GITHUB_ACTIONS"]
          .filter((name) => process.env[name] !== undefined)
          .map((name) => [name, process.env[name]]),
      );
      const child = spawn("pi", [
        "--mode",
        "rpc",
        "--no-session",
        "--no-extensions",
        "--extension",
        join(stageRoot, "node_modules", "pi-subagents", "index.ts"),
        "--extension",
        join(stageRoot, "extensions", "second-opinion.ts"),
      ], {
        cwd: stageRoot,
        env: {
          ...childEnvironment,
          HOME: configDir,
          PI_CODING_AGENT_DIR: configDir,
          PI_OFFLINE: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      const output = [];
      let stderr = "";
      let sawConsent = false;
      let sawCancellation = false;
      let reportedError;
      let settled = false;

      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(new Error(`isolated Pi RPC probe timed out:\n${stderr}\n${output.join("\n")}`));
      }, 60_000);

      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", finish);
      createInterface({ input: child.stdout }).on("line", (line) => {
        output.push(line);
        if (output.length > 30) output.shift();
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === "extension_ui_request" && event.method === "confirm") {
          sawConsent = String(event.message).includes("anthropic/claude-fable-5")
            && String(event.message).includes("receives the target again plus all four reports");
          child.stdin.write(`${JSON.stringify({
            type: "extension_ui_response",
            id: event.id,
            confirmed: false,
          })}\n`);
        }
        if (event.type === "extension_ui_request" && event.method === "notify") {
          if (/cancelled/i.test(String(event.message ?? ""))) {
            sawCancellation = true;
            child.stdin.end();
          } else if (event.notifyType === "error") {
            reportedError = String(event.message ?? "unknown extension error");
            child.stdin.end();
          }
        }
      });
      child.on("close", (code, signal) => {
        if (code !== 0 || reportedError || !sawConsent || !sawCancellation) {
          finish(new Error(
            `isolated Pi RPC probe failed for pi-subagents ${targetVersion} `
            + `(${signal ?? `exit ${code}`}): consent=${sawConsent}, cancellation=${sawCancellation}`
            + `${reportedError ? `, error=${reportedError}` : ""}\n${stderr}\n${output.join("\n")}`,
          ));
          return;
        }
        finish();
      });

      child.stdin.write(`${JSON.stringify({
        type: "prompt",
        message: "/second-opinion public compatibility probe",
      })}\n`);
    });
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
}

async function assertPackContents(stageRoot) {
  const { stdout } = await run("npm", ["pack", "--dry-run", "--json"], {
    cwd: stageRoot,
    capture: true,
  });
  const [pack] = JSON.parse(stdout);
  const paths = new Set(pack.files.map((file) => file.path));
  if (!pack.bundled.includes("pi-subagents")) {
    throw new Error("candidate package does not bundle pi-subagents");
  }
  if (!paths.has("node_modules/pi-subagents/src/api/preflight.ts")) {
    throw new Error("candidate package omits the bundled preflight API");
  }
  return {
    packedBytes: pack.size,
    unpackedBytes: pack.unpackedSize,
    entryCount: pack.entryCount,
  };
}

async function main() {
  const selector = process.argv.find((argument, index) => index > 1 && !argument.startsWith("--")) ?? "latest";
  const force = process.argv.includes("--force");
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const currentVersion = packageJson.dependencies?.["pi-subagents"];
  if (typeof currentVersion !== "string" || !VERSION_PATTERN.test(currentVersion)) {
    throw new Error("package.json must pin pi-subagents to an exact semantic version");
  }

  const targetVersion = await resolveVersion(selector);
  if (
    targetVersion !== currentVersion
    && process.env.CI !== "true"
    && process.env.PI_FORGE_ALLOW_CANDIDATE_CODE !== "1"
  ) {
    throw new Error(
      "Testing a new candidate executes its Pi extension with your user permissions. "
      + "Use the ephemeral CI workflow, or explicitly set PI_FORGE_ALLOW_CANDIDATE_CODE=1.",
    );
  }
  if (targetVersion === currentVersion && !force) {
    console.log(`pi-subagents ${targetVersion} is already pinned; no upgrade candidate to test.`);
    return;
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "pi-forge-upgrade-"));
  const stageRoot = join(temporaryRoot, "pi-forge");
  try {
    await cp(ROOT, stageRoot, {
      recursive: true,
      filter: (source) => !EXCLUDED_NAMES.has(source.split("/").at(-1)),
    });
    await updateStagedVersion(stageRoot, currentVersion, targetVersion);
    await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: stageRoot });
    await run("npm", ["run", "test:e2e"], { cwd: stageRoot });
    await probeIsolatedRuntime(stageRoot, targetVersion);
    const pack = await assertPackContents(stageRoot);

    console.log(JSON.stringify({
      status: "compatible",
      from: currentVersion,
      to: targetVersion,
      consentDeclinedBeforeSpawn: true,
      isolatedRpcConsentProbe: "passed",
      ...pack,
    }, null, 2));
  } finally {
    if (process.env.PI_FORGE_KEEP_UPGRADE_STAGE === "1") {
      console.log(`Kept upgrade stage at ${temporaryRoot}`);
    } else {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

await main();
