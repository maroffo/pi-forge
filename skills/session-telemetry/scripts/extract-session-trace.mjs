#!/usr/bin/env node
// ABOUTME: Extracts a sanitized active-branch trace or aggregate summary from one Pi session JSONL file.
// ABOUTME: Never emits prompt text, thinking, paths, commands, tool arguments, output, or findings.

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractTrace, isCanonicalTimestamp, summarizeTrace } from "../../../src/session-telemetry.js";

export const MAX_SESSION_BYTES = 250 * 1024 * 1024;
export const MAX_LINE_BYTES = 2 * 1024 * 1024;

function usage() {
  return "Usage: extract-session-trace.mjs [session.jsonl] [--summary] [--output <file>] [--force]";
}

export function parseArguments(argv, environment = process.env) {
  let sessionPath;
  let outputPath;
  let summary = false;
  let force = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--summary") summary = true;
    else if (argument === "--force") force = true;
    else if (argument === "--output") {
      outputPath = argv[index + 1];
      if (!outputPath) throw new Error(usage());
      index += 1;
    } else if (argument.startsWith("-")) throw new Error(usage());
    else if (sessionPath) throw new Error(usage());
    else sessionPath = argument;
  }
  sessionPath ??= environment.PI_SESSION_FILE;
  if (!sessionPath) throw new Error(usage());
  if (force && !outputPath) throw new Error("--force requires --output");
  return {
    sessionPath: resolve(sessionPath),
    ...(outputPath ? { outputPath: resolve(outputPath) } : {}),
    summary,
    force,
  };
}

export function parseSessionDocument(text) {
  const entries = [];
  const ids = new Set();
  let headerId;
  let headerSeen = false;
  let roots = 0;
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
      throw new Error(`session line ${index + 1} exceeds the 2MB safety limit`);
    }
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      throw new Error(`session line ${index + 1} is not valid JSON`);
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.type !== "string") {
      throw new Error(`session line ${index + 1} is not a valid entry`);
    }
    if (!headerSeen) {
      if (
        entry.type !== "session"
        || ![2, 3].includes(entry.version)
        || typeof entry.id !== "string"
        || !entry.id
        || typeof entry.cwd !== "string"
        || !isCanonicalTimestamp(entry.timestamp)
      ) throw new Error("session must start with one valid version 2 or 3 header");
      headerId = entry.id;
      headerSeen = true;
      continue;
    }
    if (entry.type === "session") throw new Error(`session line ${index + 1} contains a duplicate header`);
    if (typeof entry.id !== "string" || !entry.id || entry.id.length > 256 || ids.has(entry.id)) {
      throw new Error(`session line ${index + 1} has a missing or duplicate entry id`);
    }
    if (entry.parentId !== null && (typeof entry.parentId !== "string" || !ids.has(entry.parentId))) {
      throw new Error(`session line ${index + 1} has a dangling or non-prior parent`);
    }
    if (!isCanonicalTimestamp(entry.timestamp)) throw new Error(`session line ${index + 1} has an invalid timestamp`);
    if (entry.parentId === null) roots += 1;
    ids.add(entry.id);
    entries.push(entry);
  }
  if (!headerSeen) throw new Error("session header is missing");
  if (entries.length > 0 && roots !== 1) throw new Error("session entries must form one rooted tree");
  return { headerId, entries };
}

export function parseSessionText(text) {
  return parseSessionDocument(text).entries;
}

async function readBounded(handle, maximumBytes) {
  const chunks = [];
  let total = 0;
  while (true) {
    const remaining = maximumBytes - total;
    const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining + 1));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > maximumBytes) throw new Error("session input exceeds the active byte safety limit");
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
  }
  return Buffer.concat(chunks, total);
}

export async function readSessionFileSafely(sessionPath, maximumBytes = MAX_SESSION_BYTES) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0 || maximumBytes > MAX_SESSION_BYTES) {
    throw new Error("invalid session byte limit");
  }
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("safe no-follow input is unsupported on this platform");
  let handle;
  try {
    handle = await open(sessionPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    throw new Error("session input could not be opened as a regular non-symlink file");
  }
  try {
    const inputStats = await handle.stat();
    if (!inputStats.isFile()) throw new Error("session input is not a regular file");
    if (inputStats.size > maximumBytes) throw new Error("session input exceeds the active byte safety limit");
    const buffer = await readBounded(handle, maximumBytes);
    const document = parseSessionDocument(buffer.toString("utf8"));
    return { ...document, inputStats, bytes: buffer.byteLength };
  } finally {
    await handle.close();
  }
}

export async function writeOutputSafely(inputStatsList, outputPath, output, force) {
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("safe no-follow output is unsupported on this platform");
  const createFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK;
  let handle;
  try {
    if (force) {
      try {
        handle = await open(outputPath, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          if (error?.code === "ELOOP") throw new Error("output path must not be a symbolic link");
          throw new Error("output path could not be opened safely");
        }
        try {
          handle = await open(outputPath, createFlags, 0o600);
        } catch {
          throw new Error("output path could not be created safely");
        }
      }
    } else {
      try {
        handle = await open(outputPath, createFlags, 0o600);
      } catch (error) {
        if (error?.code === "EEXIST") throw new Error("output path already exists; use --force only with explicit approval");
        throw new Error("output path could not be created safely");
      }
    }
    const outputStats = await handle.stat();
    if (!outputStats.isFile()) throw new Error("output path is not a regular file");
    if (outputStats.nlink !== 1) throw new Error("output path has multiple hard links");
    const inputs = Array.isArray(inputStatsList) ? inputStatsList : [inputStatsList];
    if (inputs.some((inputStats) => outputStats.dev === inputStats.dev && outputStats.ino === inputStats.ino)) {
      throw new Error("output path resolves to an input session file");
    }
    await handle.chmod(0o600);
    await handle.truncate(0);
    await handle.writeFile(output, "utf8");
  } finally {
    await handle?.close();
  }
}

export async function runExtraction(options) {
  const { entries, inputStats } = await readSessionFileSafely(options.sessionPath);
  const records = options.summary ? [summarizeTrace(entries)] : extractTrace(entries);
  const output = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  if (options.outputPath) await writeOutputSafely([inputStats], options.outputPath, output, options.force);
  return output;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const output = await runExtraction(options);
    if (!options.outputPath) process.stdout.write(output);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
