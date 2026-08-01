// ABOUTME: Canonical protected Pi Forge agent identities and private contract assignments.
// ABOUTME: Shared by parent launch policy, packed-artifact verification, and tests.

import { REVIEWER_DEFINITIONS } from "./reviewer-config.js";

export const REVIEWER_LOCAL_NAMES = Object.freeze(
  REVIEWER_DEFINITIONS.map((reviewer) => reviewer.name),
);

export const REVIEWER_AGENT_NAMES = Object.freeze(
  REVIEWER_LOCAL_NAMES.map((name) => `pi-forge.${name}`),
);

export const TECH_WRITER_LOCAL_NAME = "tech-writer";
export const TECH_WRITER_AGENT_NAME = `pi-forge.${TECH_WRITER_LOCAL_NAME}`;
export const SOCRATIC_ANALYST_LOCAL_NAME = "socratic-analyst";
export const SOCRATIC_ANALYST_AGENT_NAME = `pi-forge.${SOCRATIC_ANALYST_LOCAL_NAME}`;
export const ARTIFACT_AGENT_NAMES = Object.freeze([
  ...REVIEWER_AGENT_NAMES,
  TECH_WRITER_AGENT_NAME,
  SOCRATIC_ANALYST_AGENT_NAME,
]);
export const WRITER_AGENT_NAME = "pi-forge.software-engineer";
export const REVIEW_CONTRACT_NAME = "pi-forge-review-contract";
export const WRITING_CONTRACT_NAME = "pi-forge-writing-contract";
export const IMPLEMENTATION_CONTRACT_NAME = "pi-forge-implementation-contract";
