// ABOUTME: Pure lifecycle-policy helpers for source verification, Git mutation, and sensitive-path guards.
// ABOUTME: Shared by the Pi extension and deterministic tests without executing shell commands.

import { basename, extname, isAbsolute, normalize, relative, resolve, sep } from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".astro", ".bash", ".c", ".cc", ".cjs", ".cpp", ".cs", ".css", ".dart", ".ex", ".exs",
  ".go", ".graphql", ".h", ".hpp", ".html", ".java", ".js", ".json", ".jsx", ".kt", ".kts",
  ".m", ".mjs", ".mm", ".php", ".proto", ".py", ".rb", ".rs", ".scala", ".sh", ".sql",
  ".svelte", ".swift", ".toml", ".ts", ".tsx", ".vue", ".xml", ".yaml", ".yml", ".zsh",
]);

const EXEMPT_SOURCE_ROOTS = new Set([
  ".git", ".next", ".venv", "__pycache__", "build", "dist", "node_modules", "out", "target", "vendor",
]);
const SOURCE_BASENAMES = new Set([
  "cmakelists.txt", "dockerfile", "gemfile", "gnumakefile", "go.mod", "go.sum", "justfile", "makefile",
  "package-lock.json", "pnpm-lock.yaml", "poetry.lock", "pyproject.toml", "rakefile", "requirements.txt",
  "yarn.lock",
]);

const VERIFY_PATTERNS = [
  /^(?:g?make)\s+(?:[\w./-]*?(?:check|test|lint|build|e2e|verify|evidence))[\w./:-]*(?:\s|$)/i,
  /^(?:npm|pnpm|yarn|bun)\s+(?:(?:run|exec)\s+)?(?:test|lint|check|typecheck|build)[\w:.-]*(?:\s|$)/i,
  /^(?:uv\s+run\s+)?(?:pytest|tox|ruff|mypy|pyright|flake8)(?:\s|$)/i,
  /^(?:uv\s+run\s+)?python(?:3(?:\.\d+)?)?\s+-m\s+(?:pytest|unittest)(?:\s|$)/i,
  /^go\s+(?:test|vet|build)(?:\s|$)/i,
  /^(?:golangci-lint|staticcheck)(?:\s|$)/i,
  /^cargo\s+(?:test|check|clippy|build)(?:\s|$)/i,
  /^(?:node\s+(?:--[\w-]+\s+)*--test|vitest|jest|tsc|eslint|biome)(?:\s|$)/i,
  /^(?:bundle\s+exec\s+)?(?:rspec|rubocop)(?:\s|$)/i,
  /^(?:rails\s+test|mix\s+test|gradlew?\s+\S*(?:test|check|build|lint)|mvn\s+\S*(?:test|verify))(?:\s|$)/i,
  /^(?:swift\s+(?:test|build)|xcodebuild|dotnet\s+(?:test|build)|phpunit|shellcheck|hadolint)(?:\s|$)/i,
  /^terraform\s+(?:validate|plan)(?:\s|$)/i,
];

const SAFE_VERIFY_PREFIX = /^(?:(?:cd\s+[^;&|\n]+|(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=[^;&|\n]+)\s*&&\s*)*/;
const SHELL_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
export const PRIMARY_BRANCH_NAMES = Object.freeze(["dev", "main", "master"]);
const PRIMARY_BRANCHES = new Set(PRIMARY_BRANCH_NAMES);

export function isPrimaryBranch(branch) {
  return typeof branch === "string" && PRIMARY_BRANCHES.has(branch);
}

export function isSourcePath(path, projectRoot) {
  if (typeof path !== "string" || !path.trim()) return false;
  const normalizedPath = normalize(path);
  let scopedPath = normalizedPath;
  if (typeof projectRoot === "string" && projectRoot) {
    const absolute = isAbsolute(normalizedPath) ? normalizedPath : resolve(projectRoot, normalizedPath);
    const candidate = relative(resolve(projectRoot), absolute);
    if (candidate && candidate !== ".." && !candidate.startsWith(`..${sep}`) && !isAbsolute(candidate)) scopedPath = candidate;
  }
  const segments = scopedPath.split(/[\\/]+/).filter(Boolean);
  if (!isAbsolute(scopedPath) && segments.length > 0 && EXEMPT_SOURCE_ROOTS.has(segments[0])) return false;
  return SOURCE_EXTENSIONS.has(extname(normalizedPath).toLowerCase())
    || SOURCE_BASENAMES.has(basename(normalizedPath).toLowerCase());
}

export function isVerificationCommand(command) {
  if (typeof command !== "string") return false;
  const value = command.trim();
  if (!value || value.length > 20_000 || /[;\n]|\|\||(^|[^|])\|($|[^|])/.test(value)) return false;
  const withoutPrefix = value.replace(SAFE_VERIFY_PREFIX, "").trim();
  const segments = withoutPrefix.split(/\s*&&\s*/).filter(Boolean);
  if (segments.length === 0) return false;
  return segments.every((segment) => VERIFY_PATTERNS.some((pattern) => pattern.test(segment.trim())));
}

function shellSegments(command) {
  const output = [];
  let words = [];
  let word = "";
  let quote = "";
  let escaped = false;

  const pushWord = () => {
    if (word) words.push(word);
    word = "";
  };
  const pushSegment = () => {
    pushWord();
    if (words.length > 0) output.push(words);
    words = [];
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      word += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      else word += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      pushWord();
      if (char === "\n") pushSegment();
      continue;
    }
    if (";|&()".includes(char)) {
      pushSegment();
      continue;
    }
    word += char;
  }
  pushSegment();
  return output;
}

function commandName(value) {
  return basename(value ?? "").toLowerCase();
}

function directInvocation(command) {
  if (typeof command !== "string" || command.length > 20_000) return undefined;
  const segments = shellSegments(command);
  if (segments.length !== 1 || segments[0].length === 0) return undefined;
  return { executable: commandName(segments[0][0]), words: segments[0] };
}

function isSafeRefName(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 255
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    && !value.includes("..")
    && !value.includes("//")
    && !value.includes("@{")
    && !value.endsWith("/")
    && !value.endsWith(".")
    && !value.endsWith(".lock");
}

function hasUnsafeShellExpansion(value) {
  return typeof value !== "string" || /[$`<>!*?\[\]{}~\u0000-\u001f\u007f]/.test(value);
}

function isExplicitRepository(value) {
  if (typeof value !== "string" || hasUnsafeShellExpansion(value)) return false;
  const parts = value.split("/");
  return parts.length === 2
    && parts.every((part) => /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(part) && part !== "." && part !== "..");
}

export function parseStandingAuthorizedBranchCreate(command) {
  const invocation = directInvocation(command);
  if (!invocation || invocation.words[0] !== "git") return undefined;
  const words = invocation.words;
  if (
    words.length !== 8
    || words[1] !== "-c"
    || words[2] !== "core.hooksPath="
    || words[3] !== "-c"
    || words[4] !== "core.fsmonitor=false"
    || words[5]?.toLowerCase() !== "switch"
    || words[6] !== "-c"
    || !isSafeRefName(words[7])
    || isPrimaryBranch(words[7])
  ) return undefined;
  return { branch: words[7] };
}

export function parseStandingAuthorizedWorktreeCreate(command) {
  const invocation = directInvocation(command);
  if (!invocation || invocation.words[0] !== "git") return undefined;
  const words = invocation.words;
  const branch = words[8];
  const targetPath = words[9];
  if (
    words.length !== 11
    || words[1] !== "-c"
    || words[2] !== "core.hooksPath="
    || words[3] !== "-c"
    || words[4] !== "core.fsmonitor=false"
    || words[5]?.toLowerCase() !== "worktree"
    || words[6]?.toLowerCase() !== "add"
    || words[7] !== "-b"
    || !isSafeRefName(branch)
    || isPrimaryBranch(branch)
    || typeof targetPath !== "string"
    || targetPath.length === 0
    || targetPath.length > 4_096
    || !isAbsolute(targetPath)
    || hasUnsafeShellExpansion(targetPath)
    || words[10] !== "HEAD"
  ) return undefined;
  const normalizedTarget = resolve(targetPath);
  if (normalizedTarget === resolve(normalizedTarget, "..")) return undefined;
  return { branch, targetPath: normalizedTarget };
}

export function isStandingAuthorizedBranchPush(command, currentBranch) {
  if (
    typeof currentBranch !== "string"
    || !currentBranch
    || !isSafeRefName(currentBranch)
    || isPrimaryBranch(currentBranch)
  ) return false;

  const invocation = directInvocation(command);
  if (!invocation || invocation.words[0] !== "git") return false;

  const words = invocation.words;
  let index = 1;
  const requiredConfig = new Set([
    "push.followTags=false",
    "push.gpgSign=false",
    "push.pushOption=",
    "push.recurseSubmodules=no",
    "push.useForceIfIncludes=false",
  ]);
  while (words[index] === "-c") {
    const config = words[index + 1];
    if (!requiredConfig.delete(config)) return false;
    index += 2;
  }
  if (requiredConfig.size > 0 || words[index]?.toLowerCase() !== "push") return false;

  const args = words.slice(index + 1);
  let setUpstreamSeen = false;
  while (args[0]?.startsWith("-")) {
    const option = args.shift();
    if ((option === "-u" || option === "--set-upstream") && !setUpstreamSeen) {
      setUpstreamSeen = true;
      continue;
    }
    return false;
  }
  if (args.length !== 2) return false;
  const [remote, refspec] = args;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(remote) || remote === "." || remote === "..") return false;
  return refspec === `refs/heads/${currentBranch}:refs/heads/${currentBranch}`;
}

export function parseStandingAuthorizedPullRequestCreate(command, currentBranch) {
  if (
    typeof currentBranch !== "string"
    || !isSafeRefName(currentBranch)
    || isPrimaryBranch(currentBranch)
  ) return undefined;

  const invocation = directInvocation(command);
  if (
    !invocation
    || invocation.words[0] !== "gh"
    || invocation.words[1]?.toLowerCase() !== "pr"
    || invocation.words[2]?.toLowerCase() !== "create"
  ) return undefined;

  const values = new Map();
  const names = new Map([
    ["--base", "base"], ["-B", "base"],
    ["--head", "head"], ["-H", "head"],
    ["--title", "title"], ["-t", "title"],
    ["--body", "body"], ["-b", "body"],
    ["--repo", "repository"], ["-R", "repository"],
  ]);
  const args = invocation.words.slice(3);
  for (let index = 0; index < args.length; index += 2) {
    const name = names.get(args[index]);
    const value = args[index + 1];
    if (!name || typeof value !== "string" || !value || values.has(name)) return undefined;
    values.set(name, value);
  }
  if (
    values.size !== 5
    || values.get("head") !== currentBranch
    || !isSafeRefName(values.get("base"))
    || values.get("base") === currentBranch
    || typeof values.get("title") !== "string"
    || values.get("title").trim().length === 0
    || hasUnsafeShellExpansion(values.get("title"))
    || typeof values.get("body") !== "string"
    || values.get("body").trim().length === 0
    || values.get("body").length > 10_000
    || hasUnsafeShellExpansion(values.get("body"))
    || !isExplicitRepository(values.get("repository"))
  ) return undefined;
  return {
    repository: values.get("repository"),
    base: values.get("base"),
    head: values.get("head"),
    title: values.get("title"),
    body: values.get("body"),
  };
}

export function isStandingAuthorizedPullRequestCreate(command, currentBranch) {
  return parseStandingAuthorizedPullRequestCreate(command, currentBranch) !== undefined;
}

function unwrapCommand(words) {
  let index = 0;
  while (index < words.length && SHELL_ASSIGNMENT.test(words[index])) index += 1;
  while (["command", "builtin", "nohup"].includes(commandName(words[index]))) index += 1;
  if (commandName(words[index]) === "env") {
    index += 1;
    while (index < words.length && (words[index].startsWith("-") || SHELL_ASSIGNMENT.test(words[index]))) index += 1;
  }
  if (commandName(words[index]) === "sudo") {
    index += 1;
    while (index < words.length && words[index].startsWith("-")) index += 1;
  }
  return { index, words };
}

function branchArgumentsAreReadOnly(args) {
  if (args.length === 0) return true;
  const noValueOptions = new Set([
    "--color", "--column", "--ignore-case", "--no-abbrev", "--no-color", "--no-column",
    "--omit-empty", "--show-current", "--verbose", "-v", "-vv",
  ]);
  const listOptions = new Set(["--all", "--list", "--remotes", "-a", "-l", "-r"]);
  const requiredValueOptions = new Set(["--abbrev", "--format", "--sort"]);
  const optionalSelectorOptions = new Set([
    "--contains", "--merged", "--no-contains", "--no-merged",
  ]);
  let listMode = false;
  for (let index = 0; index < args.length;) {
    const token = args[index];
    if (token === "--") return listMode;
    if (!token.startsWith("-")) {
      if (!listMode) return false;
      index += 1;
      continue;
    }
    if (listOptions.has(token)) {
      listMode = true;
      index += 1;
      continue;
    }
    if (/^-[alrv]+$/.test(token)) {
      if (/[alr]/.test(token)) listMode = true;
      index += 1;
      continue;
    }
    if (noValueOptions.has(token) || /^(?:--color|--column)(?:=.+)?$/.test(token)) {
      index += 1;
      continue;
    }
    if (/^(?:--abbrev|--format|--sort)=.+$/.test(token)) {
      index += 1;
      continue;
    }
    if (requiredValueOptions.has(token)) {
      if (!args[index + 1] || args[index + 1].startsWith("-")) return false;
      index += 2;
      continue;
    }
    if (token === "--points-at" || token.startsWith("--points-at=")) {
      if (token === "--points-at" && (!args[index + 1] || args[index + 1].startsWith("-"))) return false;
      listMode = true;
      index += token === "--points-at" ? 2 : 1;
      continue;
    }
    if (optionalSelectorOptions.has(token) || /^(?:--contains|--merged|--no-contains|--no-merged)=.+$/.test(token)) {
      listMode = true;
      if (optionalSelectorOptions.has(token) && args[index + 1] && !args[index + 1].startsWith("-")) index += 2;
      else index += 1;
      continue;
    }
    return false;
  }
  return true;
}

function gitAction(words, start) {
  let index = start + 1;
  while (index < words.length) {
    const token = words[index];
    if (["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"].includes(token)) {
      index += 2;
      continue;
    }
    if (token === "--") {
      index += 1;
      break;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    break;
  }
  const action = (words[index] ?? "").toLowerCase();
  const args = words.slice(index + 1);
  if (action === "branch" && branchArgumentsAreReadOnly(args)) return undefined;
  if (action === "config") {
    const modifiers = new Set([
      "--fixed-value", "--global", "--includes", "--local", "--name-only", "--no-includes",
      "--null", "--show-names", "--show-origin", "--show-scope", "--system", "--worktree", "-z",
    ]);
    const valuedModifiers = new Set(["--blob", "--default", "--file", "--type", "-f"]);
    let configIndex = 0;
    while (configIndex < args.length) {
      const token = args[configIndex];
      if (modifiers.has(token) || /^(?:--blob|--default|--file|--type)=/.test(token)) {
        configIndex += 1;
        continue;
      }
      if (valuedModifiers.has(token) && args[configIndex + 1] !== undefined) {
        configIndex += 2;
        continue;
      }
      break;
    }
    const configArgs = args.slice(configIndex);
    const queryActions = new Set([
      "--get", "--get-all", "--get-regexp", "--get-urlmatch", "--list", "-l",
      "get", "get-all", "get-regexp", "get-urlmatch", "list",
    ]);
    if (!configArgs[0] || queryActions.has(configArgs[0])) return undefined;
    if (configArgs.length === 1 && !configArgs[0].startsWith("-")) return undefined;
  }
  if (action === "remote" && !args.some((arg) => ["add", "remove", "rename", "set-url"].includes(arg))) return undefined;
  if (action === "stash" && ["list", "show"].includes(args[0])) return undefined;
  if (action === "tag" && !args.some((arg) => arg === "--delete" || arg.startsWith("--delete=") || /^-d.+/.test(arg) || arg === "-d")) return undefined;
  if (action === "worktree" && (!args[0] || args[0] === "list")) return undefined;
  return action;
}

export function findGitMutations(command, depth = 0) {
  if (typeof command !== "string" || depth > 2) return [];
  const mutations = [];
  for (const segment of shellSegments(command)) {
    const { index, words } = unwrapCommand(segment);
    const executable = commandName(words[index]);
    if (["bash", "sh", "zsh"].includes(executable)) {
      const shellCommandIndex = words.findIndex((word, position) => position > index && word === "-c");
      if (shellCommandIndex >= 0 && words[shellCommandIndex + 1]) {
        mutations.push(...findGitMutations(words[shellCommandIndex + 1], depth + 1));
      }
      continue;
    }
    if (executable === "eval" && words[index + 1]) {
      mutations.push(...findGitMutations(words.slice(index + 1).join(" "), depth + 1));
      continue;
    }
    if (executable === "gh") {
      const ghArgs = words.slice(index + 1).map((word) => word.toLowerCase());
      if (ghArgs.some((word, position) => word === "pr" && ghArgs[position + 1] === "create")) {
        mutations.push({ kind: "remote", action: "pr-create" });
      }
      continue;
    }
    if (executable !== "git") continue;
    const action = gitAction(words, index);
    if (!action) continue;
    if (action === "commit") mutations.push({ kind: "commit", action });
    else if (action === "push") mutations.push({ kind: "remote", action });
    else if ([
      "branch", "checkout", "clean", "config", "merge", "rebase", "remote", "reset", "restore", "revert",
      "stash", "switch", "tag", "worktree",
    ].includes(action)) mutations.push({ kind: "destructive", action });
  }
  return mutations;
}

export function dangerousCommandReason(command) {
  if (typeof command !== "string") return undefined;
  if (/(?:^|[;&|\s])sudo(?:\s|$)/i.test(command)) return "privilege escalation";
  if (/\brm\s+(?:-[A-Za-z]*r[A-Za-z]*f?|--recursive)(?:\s|$)/i.test(command)) return "recursive deletion";
  if (/\b(?:chmod|chown)\b[^\n;]*(?:777|a\+rwx)/i.test(command)) return "broad permission change";
  return undefined;
}

export function sensitivePathReason(absolutePath, homeDirectory, piAgentDirectory) {
  if (typeof absolutePath !== "string" || !absolutePath) return undefined;
  const normalized = normalize(absolutePath);
  const portable = normalized.split(sep).join("/");
  const home = typeof homeDirectory === "string" ? normalize(homeDirectory).split(sep).join("/").replace(/\/$/, "") : "";
  const relativeHome = home && portable.startsWith(`${home}/`) ? portable.slice(home.length + 1) : "";
  const agentDirectory = typeof piAgentDirectory === "string" && piAgentDirectory
    ? normalize(piAgentDirectory).split(sep).join("/").replace(/\/$/, "")
    : home ? `${home}/.pi/agent` : "";
  const base = basename(normalized).toLowerCase();

  if (base === ".git" || /(?:^|\/)\.git\/(?:hooks(?:\/|$)|config(?:\.worktree)?$|credentials$)/.test(portable)) {
    return "Git control or credential file";
  }
  if (base === ".env" || base.startsWith(".env.") || [".netrc", ".npmrc", ".pypirc"].includes(base)) {
    return "environment or credential file";
  }
  if (agentDirectory && (portable === agentDirectory || portable.startsWith(`${agentDirectory}/`))) {
    return "Pi agent configuration or consent file";
  }
  if (relativeHome && /^(?:\.ssh|\.aws|\.gnupg|\.kube)(?:\/|$)/.test(relativeHome)) return "credential store";
  if (relativeHome && /^(?:\.config\/gh|\.docker)(?:\/|$)/.test(relativeHome)) return "credential-bearing configuration";
  return undefined;
}
