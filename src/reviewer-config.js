// ABOUTME: Canonical descriptions and domain focus appended to the shared review contract.
// ABOUTME: Drives deterministic generation of all seven tool-less reviewer agents.

export const REVIEWER_DEFINITIONS = Object.freeze([
  {
    name: "architecture-reviewer",
    description: "Artifact-only structural review of boundaries, coupling, APIs, error handling, and maintainability",
    title: "Architecture Review",
    focus: "Focus on module boundaries, dependency direction, coupling, cohesion, API compatibility, error semantics, fail-open or silent-success paths, and abstractions whose cost exceeds their demonstrated need. Check build-time configuration chains when supplied. Report structural defects with a concrete caller or maintenance impact, not syntax, formatting, personal preference, or speculative future architecture.",
  },
  {
    name: "database-reviewer",
    description: "Artifact-only database review of migration safety, integrity, indexing, queries, and transactions",
    title: "Database Review",
    focus: "Focus on migration rollout and rollback, destructive operations, table locks, backfills, constraints, indexes matched to real queries, transaction ordering, deadlocks, N+1 patterns, and data retention or privacy. Evaluate risk at the supplied production cardinality and during mixed-version deployments. State database assumptions and propose an operationally safe sequence.",
  },
  {
    name: "dependency-reviewer",
    description: "Artifact-only dependency review of vulnerabilities, provenance, maintenance, licenses, pinning, and bloat",
    title: "Dependency Review",
    focus: "Focus on direct dependency necessity, exact resolved versions, lockfile consistency, supplied vulnerability evidence, package provenance, maintainer or archive status, license compatibility, install scripts, and disproportionate transitive cost. Never claim current vulnerability, release, or license status unless authoritative evidence is included in the artifact.",
  },
  {
    name: "dx-reviewer",
    description: "Artifact-only developer-experience review of onboarding, documentation, configuration, and errors",
    title: "Developer Experience Review",
    focus: "Apply newcomer and incident-response tests to the supplied material. Focus on actionable errors, configuration and environment documentation, examples that match behavior, non-obvious comments, ADR or diagram drift, and complete build-time configuration chains. Do not demand documentation for self-evident code; name the exact missing or stale instruction.",
  },
  {
    name: "performance-reviewer",
    description: "Artifact-only performance review of complexity, memory, concurrency, caching, I/O, and bounds",
    title: "Performance Review",
    focus: "Focus on measurable bottlenecks: algorithmic complexity, N+1 or full-scan queries, unbounded memory or concurrency, lock contention, cache invalidation and growth, blocking I/O, serialization churn, and missing resource limits. Use supplied hot-path reachability and input cardinality. Estimate impact or request the measurement evidence needed.",
  },
  {
    name: "security-reviewer",
    description: "Artifact-only security review of trust boundaries, injection, authorization, secrets, and fail-closed behavior",
    title: "Security Review",
    focus: "Focus on reachable injection, authentication and authorization, tenant or privilege boundaries, secret handling, validation, CSRF and CORS, cryptography, path traversal, supply-chain execution, and fail-open enforcement. Every finding must name the attacker, malicious input, crossed trust boundary, reachable sink, and violated property. Drop claims requiring capabilities the attacker already legitimately possesses.",
  },
  {
    name: "test-reviewer",
    description: "Artifact-only test review of failure detection, coverage, integration gaps, flakiness, and assertions",
    title: "Test Review",
    focus: "Focus on whether supplied tests detect the intended failure, not merely whether tests exist. Examine boundary and error paths, integration seams hidden by mocks, concurrency and time dependence, shared state, weak assertions, mutation resistance, platform assumptions, and regression coverage. Name a specific test and the defect or mutation it would catch.",
  },
]);
