# Protected Resume Contract Proposal

## Problem

A parent `tool_call` policy can validate a new launch because the requested agent and capabilities are present in the call. A resume call contains only a run id, child index, and follow-up. Pi Forge therefore cannot determine the persisted agent contract from the tool input alone.

Pi-subagents 0.37.2 records `launchContractDigest` and, for async single runs, a recovery descriptor. These are useful evidence but not an authorization gate:

- resume resolves the target inside the executor after parent tool hooks run;
- current agent discovery can still depend on caller-controlled scope;
- the source launch digest is not compared before revival;
- foreground, parallel, chain, and nested children do not share one complete recovery projection;
- the follow-up changes the task digest, so the original launch digest cannot simply be reused.

## Required API

Add a public preflight operation using the same target resolver as execution:

```typescript
resolveSubagentResumeContract({
  id,
  index,
  message,
  overrides,
  parentSessionId,
})
```

The result should contain:

- canonical full run id and child index;
- original agent name, source, package, and real path;
- original definition digest and immutable capability projection;
- persisted model, thinking, context, skills, tools, extensions, MCP, acceptance, output, sharing, and capability ceiling;
- the effective requested overrides;
- source session real path and source launch digest;
- follow-up task digest;
- a versioned resume contract digest;
- an opaque, session-bound, short-lived, single-use token.

## Atomic execution

`resume` should accept the opaque token instead of caller-supplied contract fields. Immediately before acquiring the revival lease and spawning the child, pi-subagents should:

1. resolve the exact target again;
2. reconstruct the resume contract from persisted data;
3. compare it with the server-side token record;
4. consume the token atomically;
5. abort before spawn on any mismatch or expiry.

A digest supplied directly by the caller is insufficient because it does not prove that a trusted policy approved that digest.

## Persisted contract

Every resumable child mode should persist one versioned private projection:

- foreground;
- async single;
- parallel;
- chain, including dynamic groups;
- nested runs.

The projection should include every launch-affecting field used by `agentDefinitionDigest`, plus resolved skills, acceptance role, effective acceptance, output behavior, artifact behavior, sharing, session destination, capability ceiling, and the original package file digest.

Resume should rebuild from this persisted projection. Current discovery should only verify that the original package resource still exists with the same identity and digest. It should never silently replace the persisted definition with a higher-precedence project agent.

## Override policy

The resume contract should distinguish follow-up content from capability changes. The default safe allowlist is:

- follow-up message;
- exact child index;
- a reduced timeout or remaining deadline.

Model, thinking, skills, tools, extensions, MCP, acceptance commands, output persistence, sharing, session destinations, agent scope, attached chains, and relaxed budgets require a new launch rather than resume.

Capability ceilings must be intersected with the source ceiling and can only become narrower.

## Pi Forge integration

Once this API is released and passes the dependency upgrade gate, Pi Forge can:

1. request a resume contract;
2. validate package identity and its protected-agent invariants;
3. submit the returned opaque token;
4. allow the protected resume only when execution consumes that exact token.

Until then, Pi Forge permits resume only for run ids attested as entirely generic in the current Pi session. Foreground attestations are valid only while the originating policy runtime remains active. Restored async attestations additionally require the exact canonical async directory to exist. Protected, unknown, stale foreground, missing-source async, directory-addressed, and chain-attaching resumes use a new preflighted launch with the prior result and follow-up embedded in the task.

## Required tests

- qualified project-agent shadow between source launch and resume;
- project and user agent overrides;
- token replay, expiry, wrong session, wrong run, wrong index, and prefix ambiguity;
- mutation between resume preflight and spawn;
- foreground, async, parallel, chain, dynamic, and nested recovery;
- share, output, session destination, acceptance, model, skill, tool, extension, MCP, and attached-chain escalation;
- source descriptor truncation, corruption, symlink escape, and version mismatch;
- capability ceiling preservation and narrowing;
- legacy runs without a complete projection fail closed with actionable guidance.
