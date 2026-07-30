// ABOUTME: Canonical model and runtime-name assignments for the four-provider second-opinion workflow.
// ABOUTME: Shared by generation, disclosure validation, and tests so the consent boundary cannot drift.

export const PI_SUBAGENTS_VERSION = "0.37.2";
export const CRITIC_AGENT = "pi-forge.independent-critic";
export const SYNTHESIZER_AGENT = "pi-forge.opinion-synthesizer";
export const SYNTHESIZER_MODEL = "openai-codex/gpt-5.6-sol";
export const OPINION_MODELS = Object.freeze([
  "openai-codex/gpt-5.6-sol",
  "anthropic/claude-fable-5",
  "google/gemini-3.6-flash",
  "deepseek/deepseek-v4-pro",
]);
