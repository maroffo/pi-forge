// ABOUTME: Inspects conservative literal Make target definitions shared by score and project onboarding.
// ABOUTME: Rejects ambiguous syntax and reports duplicate definitions without executing Make.

export function inspectLiteralMakeTargets(content) {
  const targets = new Set();
  const definitionCounts = new Map();
  const includeDirectives = [];
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed || line.startsWith("\t")) continue;
    if (line.trimEnd().endsWith("\\")) {
      return {
        targets: new Set(),
        duplicateTargets: new Set(),
        includeDirectives,
        unsupportedReason: `line ${index + 1} uses continuation syntax`,
      };
    }
    if (trimmed.startsWith("#")) continue;
    if (/^\s/.test(line)) {
      return {
        targets: new Set(),
        duplicateTargets: new Set(),
        includeDirectives,
        unsupportedReason: `line ${index + 1} uses leading whitespace`,
      };
    }
    if (/^(?:override\s+)?(?:ifeq|ifneq|ifdef|ifndef|else|endif|define|endef)\b/.test(trimmed)) {
      return {
        targets: new Set(),
        duplicateTargets: new Set(),
        includeDirectives,
        unsupportedReason: `line ${index + 1} uses conditional or define syntax`,
      };
    }
    if (/^(?:-?include|sinclude)\s+/.test(trimmed)) {
      includeDirectives.push({ line: index + 1 });
      continue;
    }
    const colon = line.indexOf(":");
    if (colon <= 0 || line[colon + 1] === "=") continue;
    const left = line.slice(0, colon).trim();
    if (
      !left
      || left.includes("%")
      || left.includes("$")
      || left.includes("=")
      || left.includes("\\")
    ) continue;
    for (const target of left.split(/\s+/)) {
      targets.add(target);
      definitionCounts.set(target, (definitionCounts.get(target) ?? 0) + 1);
    }
  }
  return {
    targets,
    includeDirectives,
    duplicateTargets: new Set(
      [...definitionCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([target]) => target),
    ),
  };
}

export function discoverLiteralMakeTargets(content) {
  return inspectLiteralMakeTargets(content).targets;
}
