#!/usr/bin/env bash
# ABOUTME: Executes one local commit only after an enforcing branch and argument safety gate.
# ABOUTME: Refuses protected branches, empty indexes, hook bypasses, amend, and implicit staging.

set -euo pipefail

allowed_branch=""
if [[ "${1:-}" == "--allow-branch" ]]; then
  [[ -n "${2:-}" ]] || { printf 'missing value for --allow-branch\n' >&2; exit 2; }
  allowed_branch="$2"
  shift 2
fi
[[ "${1:-}" == "--" ]] || { printf 'usage: %s [--allow-branch <exact-branch>] -- <git-commit-args...>\n' "$0" >&2; exit 2; }
shift
[[ $# -gt 0 ]] || { printf 'at least one git commit argument is required\n' >&2; exit 2; }

commit_arguments=()
message_count=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      [[ $# -ge 2 ]] || { printf 'missing commit message value for %s\n' "$1" >&2; exit 2; }
      commit_arguments+=("$1" "$2")
      message_count=$((message_count + 1))
      shift 2
      ;;
    --message=*)
      [[ -n "${1#--message=}" ]] || { printf 'commit message must not be empty\n' >&2; exit 2; }
      commit_arguments+=("$1")
      message_count=$((message_count + 1))
      shift
      ;;
    *)
      printf 'refusing unsupported git commit argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done
[[ $message_count -gt 0 ]] || { printf 'at least one commit message is required\n' >&2; exit 2; }

git rev-parse --is-inside-work-tree >/dev/null
branch="$(git symbolic-ref --quiet --short HEAD)" || { printf 'refusing commit on detached HEAD\n' >&2; exit 1; }
[[ -n "$branch" ]] || { printf 'refusing commit on detached HEAD\n' >&2; exit 1; }
git show-ref --verify --quiet "refs/heads/$branch" || {
  printf 'refusing commit on unborn branch: %s\n' "$branch" >&2
  exit 1
}

case "$branch" in
  dev|main|master)
    [[ "$allowed_branch" == "$branch" ]] || {
      printf 'refusing commit on protected branch: %s\n' "$branch" >&2
      exit 1
    }
    ;;
  *)
    if [[ -n "$allowed_branch" && "$allowed_branch" != "$branch" ]]; then
      printf 'current branch %s does not match authorized branch %s\n' "$branch" "$allowed_branch" >&2
      exit 1
    fi
    ;;
esac

if git diff --cached --quiet; then
  printf 'refusing empty staged payload\n' >&2
  exit 1
fi

exec git commit "${commit_arguments[@]}"
