// ABOUTME: Confirms ordinary Pi Forge tag creation and npm publication in the trusted source project.
// ABOUTME: Blocks risky Bash-tool calls headless while leaving public package lifecycle policy unchanged.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { classifyReleaseCommand } from "../../scripts/lib/release-policy.mjs";

function safeDisplay(value: string): string {
  const printable = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return printable.length <= 800 ? printable : `${printable.slice(0, 797)}...`;
}

export default function piForgeReleaseGuard(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const command = (event.input as { command?: unknown }).command;
    if (typeof command !== "string") return { block: true, reason: "Pi Forge release guard received an invalid Bash command." };
    const actions = classifyReleaseCommand(command);
    if (actions.length === 0) return;
    if (actions.includes("git-tag-force")) {
      return { block: true, reason: "Forced Git tag creation is unsupported. Preserve release tag provenance and reconcile existing state." };
    }
    const label = actions.map((action) => action === "npm-publish" ? "npm publication" : "local Git tag creation").join(", ");
    if (!ctx.hasUI) {
      return { block: true, reason: `${label} requires interactive confirmation in the Pi Forge source project.` };
    }
    const approved = await ctx.ui.confirm(
      "Pi Forge release mutation",
      `This ordinary Bash-tool call performs: ${label}.\n\n${safeDisplay(command)}\n\nThis guard does not prove that release preflight passed. Allow this one call?`,
    );
    return approved ? undefined : { block: true, reason: "Pi Forge release mutation was not approved." };
  });
}
