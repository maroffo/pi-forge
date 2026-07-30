// ABOUTME: Persists aggregate, sanitized Pi session telemetry as custom entries outside model context.
// ABOUTME: Exposes a local diagnostic command without storing prompts, paths, commands, output, or findings.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { deriveMetrics, TELEMETRY_ENTRY } from "../src/session-telemetry.js";

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function formatMetrics(metrics: ReturnType<typeof deriveMetrics>): string {
  const toolCalls = Object.entries(metrics.toolCalls)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ") || "none";
  return [
    "Pi Forge session telemetry (local, sanitized)",
    `User turns: ${metrics.userTurns}`,
    `Assistant messages: ${metrics.assistantMessages}`,
    `Tool calls: ${toolCalls}`,
    `Tool errors: ${metrics.toolErrors}`,
    `Source mutations: ${metrics.sourceMutations}`,
    `Successful verification runs: ${metrics.successfulVerifications}`,
    `Subagent launches: ${metrics.subagentLaunches}`,
    `Compactions/model changes: ${metrics.compactions}/${metrics.modelChanges}`,
    `Tokens: ${metrics.totalTokens} (cache read ${metrics.cacheReadTokens})`,
    `Cost: $${metrics.costTotal.toFixed(8)}`,
    "Stored data excludes prompts, message text, thinking, paths, shell commands, tool output, findings, and secrets.",
  ].join("\n");
}

export default function telemetryExtension(pi: ExtensionAPI): void {
  let lastFingerprint = "";
  let started = false;

  const current = (ctx: any) => deriveMetrics(ctx.sessionManager.getBranch());
  const checkpoint = (ctx: any, force = false) => {
    if (!started) return;
    const metrics = current(ctx);
    const next = fingerprint(metrics);
    if (!force && next === lastFingerprint) return;
    lastFingerprint = next;
    pi.appendEntry(TELEMETRY_ENTRY, {
      version: 1,
      capturedAt: new Date().toISOString(),
      metrics,
    });
  };

  pi.on("session_start", (_event, ctx) => {
    started = true;
    lastFingerprint = fingerprint(current(ctx));
  });
  pi.on("session_tree", (_event, ctx) => checkpoint(ctx, true));
  pi.on("agent_settled", (_event, ctx) => checkpoint(ctx));
  pi.on("session_compact", (_event, ctx) => checkpoint(ctx));
  pi.on("model_select", (_event, ctx) => checkpoint(ctx));
  pi.on("session_shutdown", (_event, ctx) => {
    checkpoint(ctx);
    started = false;
  });

  pi.registerCommand("forge-telemetry", {
    description: "Show sanitized local Pi Forge session counters",
    handler: async (args, ctx) => {
      if (args.trim()) {
        const message = "Usage: /forge-telemetry";
        if (ctx.hasUI) ctx.ui.notify(message, "warning");
        else process.stdout.write(`${message}\n`);
        return;
      }
      const report = formatMetrics(current(ctx));
      if (ctx.hasUI) ctx.ui.notify(report, "info");
      else process.stdout.write(`${report}\n`);
    },
  });
}
