// ABOUTME: Provides structural, advisory freshness, and explicit refresh commands for the project Behavior Map.
// ABOUTME: Keeps stale behavior cards out of trusted routing without adding them to the package runtime.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BehaviorMapValidationError,
  checkBehaviorMapFreshness,
  refreshBehaviorMapFingerprints,
  validateBehaviorMap,
} from "./lib/behavior-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const modes = process.argv.slice(2);
const mode = modes.length === 0 ? "--structure" : modes[0];
if (modes.length > 1 || !["--structure", "--freshness", "--refresh-fingerprints"].includes(mode)) {
  console.error("usage: node scripts/check-behavior-map.mjs [--structure|--freshness|--refresh-fingerprints]");
  process.exit(1);
}

try {
  if (mode === "--structure") {
    const result = await validateBehaviorMap({ root: ROOT });
    console.log(`behavior map structure passed: ${result.behaviors.length} behaviors, ${result.discovered.size} discovered surfaces`);
  } else if (mode === "--freshness") {
    const result = await checkBehaviorMapFreshness({ root: ROOT });
    if (!result.fresh) {
      for (const stale of result.stale) {
        console.error(`STALE ${stale.path}: freeze ${stale.behaviorIds.join(", ")} until source review and explicit refresh`);
      }
      console.error("fingerprint drift is a review signal, not proof that behavior prose is incorrect");
      process.exitCode = 2;
    } else {
      console.log(`behavior map freshness passed: ${result.fingerprintPaths.size} canonical files`);
    }
  } else {
    const result = await refreshBehaviorMapFingerprints({ root: ROOT });
    console.log(`behavior map fingerprints refreshed: ${Object.keys(result.files).length} canonical files`);
    console.log("refresh records review state; it does not prove that behavior prose matches source");
  }
} catch (error) {
  if (error instanceof BehaviorMapValidationError) {
    for (const issue of error.issues) console.error(`ERROR ${issue.code}: ${issue.message}`);
  } else {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
  process.exitCode = 1;
}
