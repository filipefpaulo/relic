#!/usr/bin/env bash
# scaffold-spec.sh — Ensure spec folder and files exist; create if needed.
#
# For new specs (specify workflow): generates spec ID from --title.
# For existing specs (plan/tasks): resolves from --spec, RELIC_SPEC, or git branch.
#
# Usage:
#   bash .relic/scripts/scaffold-spec.sh --title "User Authentication"  # new spec
#   bash .relic/scripts/scaffold-spec.sh --spec 001-auth                # existing spec
#
# JSON output:
#   {
#     "spec_id":      "001-user-authentication",
#     "spec_dir":     "/abs/path/.relic/specs/001-user-authentication",
#     "title":        "User Authentication",
#     "date":         "2026-04-10",
#     "was_new":      true,
#     "files_created": ["spec.md", "plan.md", "tasks.md", "artifacts.json"]
#   }

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

#------------------------------------------------------------------------------
# Parse arguments
#------------------------------------------------------------------------------
SPEC_ARG=""
TITLE_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --spec)   SPEC_ARG="$2";  shift 2 ;;
    --title)  TITLE_ARG="$2"; shift 2 ;;
    --json)   shift ;;   # JSON is always the output format
    --text)   shift ;;   # ignored — kept for consistency with other scripts
    *)        shift ;;
  esac
done

#------------------------------------------------------------------------------
# Find .relic/
#------------------------------------------------------------------------------
RELIC_DIR=$(find_relic_dir) || {
  echo '{"error":"Could not find .relic/ directory. Run: relic init"}' >&2
  exit 1
}

DATE=$(date +%Y-%m-%d)

#------------------------------------------------------------------------------
# Helpers
#------------------------------------------------------------------------------

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//; s/-$//'
}

# Scan specs/ for highest existing NNN prefix; return next ID as NNN-slug
next_spec_id() {
  local slug="$1"
  local max=0
  local specs_dir="$RELIC_DIR/specs"

  if [ -d "$specs_dir" ]; then
    for d in "$specs_dir"/*/; do
      [ -d "$d" ] || continue
      local base n
      base=$(basename "$d")
      n=$(echo "$base" | grep -oE '^[0-9]+' || echo "0")
      # strip leading zeros for arithmetic
      n=$((10#$n))
      [ "$n" -gt "$max" ] && max="$n"
    done
  fi

  printf "%03d-%s" $((max + 1)) "$slug"
}

# Derive display title from spec ID slug (e.g. "001-user-auth" → "User Auth")
title_from_spec_id() {
  echo "$1" \
    | sed 's/^[0-9]*-//' \
    | sed 's/-/ /g' \
    | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}

#------------------------------------------------------------------------------
# Resolve spec ID and title
#------------------------------------------------------------------------------

if [ -n "$TITLE_ARG" ]; then
  # New spec — generate ID from title
  SLUG=$(slugify "$TITLE_ARG")
  SPEC_ID=$(next_spec_id "$SLUG")
  TITLE="$TITLE_ARG"

elif [ -n "$SPEC_ARG" ]; then
  # Existing spec — use provided ID
  SPEC_ID="$SPEC_ARG"
  TITLE=$(title_from_spec_id "$SPEC_ID")

else
  # Fall back to env / git branch
  SPEC_ID=$(resolve_spec_id "" "$RELIC_DIR") || {
    echo '{"error":"Cannot resolve spec ID. Use --title for new specs or --spec for existing ones."}' >&2
    exit 1
  }
  TITLE=$(title_from_spec_id "$SPEC_ID")
fi

SPEC_DIR="$RELIC_DIR/specs/$SPEC_ID"
TEMPLATES_DIR="$RELIC_DIR/templates"

#------------------------------------------------------------------------------
# Create spec directory if needed
#------------------------------------------------------------------------------

WAS_NEW="false"
if [ ! -d "$SPEC_DIR" ]; then
  mkdir -p "$SPEC_DIR"
  WAS_NEW="true"
fi

#------------------------------------------------------------------------------
# Create missing files
#------------------------------------------------------------------------------

FILES_CREATED=()

create_from_template() {
  local tmpl="$1"
  local dest="$2"

  if [ -f "$TEMPLATES_DIR/$tmpl" ]; then
    sed \
      -e "s|{{SPEC_ID}}|$SPEC_ID|g" \
      -e "s|{{TITLE}}|$TITLE|g" \
      -e "s|{{DATE}}|$DATE|g" \
      "$TEMPLATES_DIR/$tmpl" > "$dest"
  else
    # Minimal fallback if .relic/templates/ is missing the file
    {
      echo "# ${tmpl%.md}: $TITLE"
      echo ""
      echo "**Spec ID:** $SPEC_ID"
      echo "**Date:** $DATE"
    } > "$dest"
  fi
}

for fname in spec.md plan.md tasks.md; do
  if [ ! -f "$SPEC_DIR/$fname" ]; then
    create_from_template "$fname" "$SPEC_DIR/$fname"
    FILES_CREATED+=("$fname")
  fi
done

ARTIFACTS_FILE="$SPEC_DIR/artifacts.json"
if [ ! -f "$ARTIFACTS_FILE" ]; then
  printf '{"owns":[],"reads":[],"touches_files":[]}\n' > "$ARTIFACTS_FILE"
  FILES_CREATED+=("artifacts.json")
fi

#------------------------------------------------------------------------------
# Track active spec
#------------------------------------------------------------------------------

printf '%s' "$SPEC_ID" > "$RELIC_DIR/current-spec"

#------------------------------------------------------------------------------
# Build JSON output
#------------------------------------------------------------------------------

# Build files_created JSON array
files_json="["
first=true
for f in "${FILES_CREATED[@]+"${FILES_CREATED[@]}"}"; do
  $first || files_json+=","
  files_json+="\"$(json_escape "$f")\""
  first=false
done
files_json+="]"

cat <<EOF
{
  "spec_id":               "$(json_escape "$SPEC_ID")",
  "spec_dir":              "$(json_escape "$SPEC_DIR")",
  "title":                 "$(json_escape "$TITLE")",
  "date":                  "$(json_escape "$DATE")",
  "was_new":               $WAS_NEW,
  "current_spec_updated":  true,
  "files_created":         $files_json
}
EOF
