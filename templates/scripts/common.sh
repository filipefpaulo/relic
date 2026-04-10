#!/usr/bin/env bash
# Relic common utilities — sourced by all Relic scripts
# Do not run directly.

# Walk up from $1 (default: cwd) until .relic/ is found.
# Prints the absolute path to the .relic/ directory.
find_relic_dir() {
  local dir="${1:-$(pwd)}"
  dir="$(cd -- "$dir" 2>/dev/null && pwd)" || return 1
  local prev=""
  while true; do
    [ -d "$dir/.relic" ] && echo "$dir/.relic" && return 0
    [ "$dir" = "/" ] || [ "$dir" = "$prev" ] && break
    prev="$dir"
    dir="$(dirname "$dir")"
  done
  echo "ERROR: .relic/ directory not found. Run: relic init" >&2
  return 1
}

# Resolve spec ID from: explicit arg > RELIC_SPEC env > git branch inference.
# Usage: resolve_spec_id "<explicit_or_empty>" "<relic_dir>"
# Prints the spec ID string or exits non-zero with an error message.
resolve_spec_id() {
  local explicit="${1:-}"
  local relic_dir="$2"
  local spec_id=""

  if [ -n "$explicit" ]; then
    spec_id="$explicit"
  elif [ -n "${RELIC_SPEC:-}" ]; then
    spec_id="$RELIC_SPEC"
  else
    local branch=""
    branch=$(git branch --show-current 2>/dev/null) || true
    if [ -n "$branch" ]; then
      spec_id=$(echo "$branch" | grep -oE '[0-9]{3}-[a-z0-9-]+' | head -1 || true)
    fi
  fi

  if [ -z "$spec_id" ]; then
    echo "ERROR: Cannot resolve spec ID." >&2
    echo "       Use --spec <id>, set RELIC_SPEC, or be on a branch named NNN-slug." >&2
    echo "" >&2
    echo "Available specs:" >&2
    ls "$relic_dir/specs/" 2>/dev/null | grep -E '^[0-9]{3}-' | sed 's/^/  /' >&2 || true
    return 1
  fi

  echo "$spec_id"
}

# Output all spec-related paths as printf %q shell variable assignments.
# Callers should: eval "$(get_spec_paths "$relic_dir" "$spec_id")"
get_spec_paths() {
  local relic_dir="$1"
  local spec_id="$2"
  local spec_dir="$relic_dir/specs/$spec_id"

  printf 'RELIC_DIR=%q\n'       "$relic_dir"
  printf 'SPEC_ID=%q\n'         "$spec_id"
  printf 'SPEC_DIR=%q\n'        "$spec_dir"
  printf 'SPEC_FILE=%q\n'       "$spec_dir/spec.md"
  printf 'PLAN_FILE=%q\n'       "$spec_dir/plan.md"
  printf 'TASKS_FILE=%q\n'      "$spec_dir/tasks.md"
  printf 'ARTIFACTS_JSON=%q\n'  "$spec_dir/artifacts.json"
  printf 'CHANGELOG=%q\n'       "$relic_dir/changelog.md"
  printf 'PREAMBLE=%q\n'        "$relic_dir/preamble.md"
  printf 'CONSTITUTION=%q\n'    "$relic_dir/constitution.md"
}

# Escape a string for safe embedding in a JSON value.
# No jq dependency required.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\r'/\\r}"
  printf '%s' "$s"
}

# Returns 0 if jq is available
has_jq() { command -v jq >/dev/null 2>&1; }

# Print a JSON boolean value
json_bool() { [ "$1" = "true" ] && printf 'true' || printf 'false'; }
