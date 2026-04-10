#!/usr/bin/env bash
# check-context.sh — Resolve and validate Relic spec context
#
# Usage: bash .relic/scripts/check-context.sh [--spec <id>] [--json]
#
# Outputs the spec ID, all relevant file paths, and which files exist.
# Also reads artifacts.json to report which shared artifacts are referenced
# and whether they exist on disk.
#
# AI agents should run this before every command to get structured context
# without exploring the filesystem manually (saves tokens).
#
# Exit codes:
#   0  — spec resolved and context output produced
#   1  — .relic/ not found or spec could not be resolved

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

#------------------------------------------------------------------------------
# Parse arguments
#------------------------------------------------------------------------------
SPEC_ARG=""
JSON_MODE=true  # JSON is the default for AI consumption

while [[ $# -gt 0 ]]; do
  case "$1" in
    --spec)   SPEC_ARG="${2:-}"; shift 2 ;;
    --spec=*) SPEC_ARG="${1#--spec=}"; shift ;;
    --json)   JSON_MODE=true; shift ;;
    --text)   JSON_MODE=false; shift ;;
    --help|-h)
      echo "Usage: bash .relic/scripts/check-context.sh [--spec <id>] [--json|--text]"
      echo ""
      echo "Options:"
      echo "  --spec <id>   Spec ID to use (overrides RELIC_SPEC and git branch)"
      echo "  --json        Output as JSON (default)"
      echo "  --text        Output as human-readable text"
      echo "  --help        Show this help"
      exit 0
      ;;
    *) shift ;;
  esac
done

#------------------------------------------------------------------------------
# Resolve paths
#------------------------------------------------------------------------------
RELIC_DIR=$(find_relic_dir) || exit 1

# Detect source before calling resolve_spec_id (subshell can't propagate the global)
if [ -n "$SPEC_ARG" ]; then
  SPEC_ID_SOURCE="arg"
elif [ -n "${RELIC_SPEC:-}" ]; then
  SPEC_ID_SOURCE="env"
elif [ -f "$RELIC_DIR/current-spec" ]; then
  SPEC_ID_SOURCE="current-spec"
else
  SPEC_ID_SOURCE="git-branch"
fi

SPEC_ID=$(resolve_spec_id "$SPEC_ARG" "$RELIC_DIR") || exit 1

SPEC_DIR="$RELIC_DIR/specs/$SPEC_ID"
SPEC_FILE="$SPEC_DIR/spec.md"
PLAN_FILE="$SPEC_DIR/plan.md"
TASKS_FILE="$SPEC_DIR/tasks.md"
ARTIFACTS_JSON="$SPEC_DIR/artifacts.json"
CHANGELOG="$RELIC_DIR/changelog.md"
PREAMBLE="$RELIC_DIR/preamble.md"
CONSTITUTION="$RELIC_DIR/constitution.md"

# Validate spec directory exists
if [ ! -d "$SPEC_DIR" ]; then
  echo "ERROR: Spec directory not found: $SPEC_DIR" >&2
  echo "       Run: relic specify --title \"Your Feature\"" >&2
  exit 1
fi

#------------------------------------------------------------------------------
# Check file existence
#------------------------------------------------------------------------------
f_preamble=false;    [ -f "$PREAMBLE" ]      && f_preamble=true
f_constitution=false; [ -f "$CONSTITUTION" ] && f_constitution=true
f_spec=false;        [ -f "$SPEC_FILE" ]     && f_spec=true
f_plan=false;        [ -f "$PLAN_FILE" ]     && f_plan=true
f_tasks=false;       [ -f "$TASKS_FILE" ]    && f_tasks=true
f_artifacts=false;   [ -f "$ARTIFACTS_JSON" ] && f_artifacts=true
f_changelog=false;   [ -f "$CHANGELOG" ]     && f_changelog=true

#------------------------------------------------------------------------------
# Parse artifacts.json for shared artifact references
#------------------------------------------------------------------------------
owns_list=()
reads_list=()

if [ -f "$ARTIFACTS_JSON" ] && command -v python3 >/dev/null 2>&1; then
  # Use python3 to parse JSON reliably
  while IFS= read -r line; do
    role="${line%%:*}"
    path="${line#*:}"
    case "$role" in
      owns)  owns_list+=("$path") ;;
      reads) reads_list+=("$path") ;;
    esac
  done < <(python3 -c "
import json, sys
try:
    with open('$ARTIFACTS_JSON') as f:
        d = json.load(f)
    for p in d.get('owns', []):
        print('owns:' + p)
    for p in d.get('reads', []):
        print('reads:' + p)
except Exception as e:
    sys.stderr.write('Warning: could not parse artifacts.json: ' + str(e) + '\n')
" 2>/dev/null)
fi

#------------------------------------------------------------------------------
# Output
#------------------------------------------------------------------------------
if $JSON_MODE; then
  # Build shared_artifacts JSON array
  artifacts_json_array="["
  first=true
  for path in "${owns_list[@]+"${owns_list[@]}"}"; do
    exists=false; [ -f "$RELIC_DIR/$path" ] && exists=true
    $first && first=false || artifacts_json_array+=","
    if has_jq; then
      artifacts_json_array+=$(jq -cn --arg p "$path" --arg r "owns" --argjson e "$exists" \
        '{path:$p,role:$r,exists:$e}')
    else
      artifacts_json_array+="{\"path\":\"$(json_escape "$path")\",\"role\":\"owns\",\"exists\":$exists}"
    fi
  done
  for path in "${reads_list[@]+"${reads_list[@]}"}"; do
    exists=false; [ -f "$RELIC_DIR/$path" ] && exists=true
    $first && first=false || artifacts_json_array+=","
    if has_jq; then
      artifacts_json_array+=$(jq -cn --arg p "$path" --arg r "reads" --argjson e "$exists" \
        '{path:$p,role:$r,exists:$e}')
    else
      artifacts_json_array+="{\"path\":\"$(json_escape "$path")\",\"role\":\"reads\",\"exists\":$exists}"
    fi
  done
  artifacts_json_array+="]"

  if has_jq; then
    jq -cn \
      --arg relic_dir "$RELIC_DIR" \
      --arg spec_id "$SPEC_ID" \
      --arg spec_id_source "$SPEC_ID_SOURCE" \
      --arg spec_dir "$SPEC_DIR" \
      --argjson files "{
        \"preamble\":$f_preamble,
        \"constitution\":$f_constitution,
        \"spec\":$f_spec,
        \"plan\":$f_plan,
        \"tasks\":$f_tasks,
        \"artifacts_json\":$f_artifacts,
        \"changelog\":$f_changelog
      }" \
      --argjson shared_artifacts "$artifacts_json_array" \
      '{relic_dir:$relic_dir,spec_id:$spec_id,active_spec_source:$spec_id_source,spec_dir:$spec_dir,files:$files,shared_artifacts:$shared_artifacts}'
  else
    cat <<EOF
{
  "relic_dir": "$(json_escape "$RELIC_DIR")",
  "spec_id": "$(json_escape "$SPEC_ID")",
  "active_spec_source": "$(json_escape "$SPEC_ID_SOURCE")",
  "spec_dir": "$(json_escape "$SPEC_DIR")",
  "files": {
    "preamble": $f_preamble,
    "constitution": $f_constitution,
    "spec": $f_spec,
    "plan": $f_plan,
    "tasks": $f_tasks,
    "artifacts_json": $f_artifacts,
    "changelog": $f_changelog
  },
  "shared_artifacts": $artifacts_json_array
}
EOF
  fi

else
  # Human-readable output
  echo "Spec:       $SPEC_ID"
  echo "Relic dir:  $RELIC_DIR"
  echo "Spec dir:   $SPEC_DIR"
  echo ""
  echo "Files:"
  $f_preamble      && echo "  ✓ preamble.md"      || echo "  ✗ preamble.md"
  $f_constitution  && echo "  ✓ constitution.md"  || echo "  ✗ constitution.md"
  $f_spec          && echo "  ✓ spec.md"          || echo "  ✗ spec.md"
  $f_plan          && echo "  ✓ plan.md"          || echo "  ✗ plan.md"
  $f_tasks         && echo "  ✓ tasks.md"         || echo "  ✗ tasks.md"
  $f_artifacts     && echo "  ✓ artifacts.json"   || echo "  ✗ artifacts.json"
  $f_changelog     && echo "  ✓ changelog.md"     || echo "  ✗ changelog.md"

  if [ ${#owns_list[@]} -gt 0 ] || [ ${#reads_list[@]} -gt 0 ]; then
    echo ""
    echo "Shared artifacts:"
    for path in "${owns_list[@]+"${owns_list[@]}"}"; do
      [ -f "$RELIC_DIR/$path" ] && echo "  ✓ $path (owns)" || echo "  ✗ $path (owns — missing)"
    done
    for path in "${reads_list[@]+"${reads_list[@]}"}"; do
      [ -f "$RELIC_DIR/$path" ] && echo "  ✓ $path (reads)" || echo "  ✗ $path (reads — missing)"
    done
  fi
fi
