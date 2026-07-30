# ABOUTME: Repository checks for package structure, generated resources, extension syntax, and tests.
# ABOUTME: Keeps the public Pi package self-contained and free from private machine paths.

.PHONY: check test test-e2e test-upgrade generate

check:
	@npm run check

test:
	@npm test

test-e2e:
	@npm run test:e2e

test-upgrade:
	@npm run test:pi-subagents-upgrade -- latest

generate:
	@node scripts/build-second-opinion.mjs
	@node scripts/build-reviewers.mjs
	@node scripts/build-tech-writer.mjs
