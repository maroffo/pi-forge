# PR Finding Evidence Gate

Critical and Major are blocking labels. A claim receives one only after the parent verifies the cited source and the first applicable evidence type below.

| Finding class | Required evidence |
|---|---|
| Correctness or executable security behavior | A focused reproduction that fails for the claimed reason on the PR |
| Correctness when execution is prohibited | Exact changed lines plus a complete reachable control-flow, data-flow, type, or language-rule derivation showing the wrong outcome |
| Security not safely executable | CWE identifier, exact reachable source path, and boundary crossed |
| Performance | Measurement or explicit complexity/resource derivation |
| Dependency | Advisory or upstream metadata tied to the resolved version and reachable use |
| Convention | Exact project rule and a concrete violating line |
| Architecture | Named principle plus the concrete maintenance or correctness cost |

If none applies, downgrade to Minor, label it unverified, or drop it.

## Candidate execution

A reproduction is candidate-code execution. Run it only after the gate in `../SKILL.md` allows execution. A test must fail for the claimed assertion, not because setup, compilation, credentials, or fixtures are broken.

When execution is allowed:

1. Reproduce on the PR head in the throwaway clone.
2. Test the same condition at the merge base when practical.
3. Classify it as introduced by PR, pre-existing, or inconclusive.
4. Record the command, relevant output, and exact commit.
5. Do not keep evidence mutations in the active repository or push them.

When execution is not allowed, a complete static correctness derivation may remain Critical or Major. It must identify the changed entry path, every relevant branch or type rule, and the inevitable wrong result; suspicion or an omitted runtime assumption is insufficient. Otherwise use another non-executable evidence class or report the claim as unverified. Never describe an unrun test as failing.

## Commit context

A tracked deferral or justified design choice may reduce urgency, but it does not make unsafe behavior safe. An incomplete fix remains at the demonstrated severity. A pre-existing blocker is labeled pre-existing and does not become the PR author's defect, but it can still make merging unsafe.
