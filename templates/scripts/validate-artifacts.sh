#!/usr/bin/env bash
# validate-artifacts.sh — Validate Relic shared brain integrity
#
# Usage: bash .relic/scripts/validate-artifacts.sh [--json]
#
# Checks:
#   1. Ownership conflicts     — two specs own the same shared artifact
#   2. Missing owned artifacts — owned artifact path doesn't exist in shared/
#   3. Missing read artifacts  — read artifact path doesn't exist in shared/
#   4. Illegal spec files      — files in specs/<id>/ other than the four allowed
#   5. Invalid artifact paths  — paths in owns/reads that don't point into shared/
#
# Exit codes:
#   0 — validation ran (check "valid" field in JSON for result)
#   1 — could not run (e.g. .relic/ not found, no python3)

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

#------------------------------------------------------------------------------
# Parse arguments
#------------------------------------------------------------------------------
JSON_MODE=true

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    --text) JSON_MODE=false ;;
    --help|-h)
      echo "Usage: bash .relic/scripts/validate-artifacts.sh [--json|--text]"
      echo ""
      echo "Options:"
      echo "  --json   Output as JSON (default)"
      echo "  --text   Output as human-readable text"
      exit 0
      ;;
    *) ;;
  esac
done

#------------------------------------------------------------------------------
# Resolve relic dir
#------------------------------------------------------------------------------
RELIC_DIR=$(find_relic_dir) || exit 1
SPECS_DIR="$RELIC_DIR/specs"
SHARED_DIR="$RELIC_DIR/shared"

#------------------------------------------------------------------------------
# Require python3 for reliable JSON parsing
#------------------------------------------------------------------------------
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required for validate-artifacts.sh" >&2
  exit 1
fi

#------------------------------------------------------------------------------
# Run validation via python3 (handles JSON parsing cleanly)
#------------------------------------------------------------------------------
RESULT=$(python3 - "$RELIC_DIR" "$SPECS_DIR" <<'PYEOF'
import json, os, sys

relic_dir = sys.argv[1]
specs_dir = sys.argv[2]

ALLOWED_FILES = {"spec.md", "plan.md", "tasks.md", "artifacts.json"}

conflicts     = []
missing_owned = []
missing_reads = []
illegal_files = []
invalid_paths = []

# Map artifact path -> [spec_ids that own it]
ownership: dict[str, list[str]] = {}

specs = []
if os.path.isdir(specs_dir):
    for name in sorted(os.listdir(specs_dir)):
        spec_dir = os.path.join(specs_dir, name)
        if not os.path.isdir(spec_dir):
            continue
        af = os.path.join(spec_dir, "artifacts.json")
        try:
            with open(af) as f:
                data = json.load(f)
        except Exception:
            data = {"owns": [], "reads": [], "touches_files": []}
        specs.append((name, spec_dir, data))

for spec_id, spec_dir, data in specs:
    owns  = data.get("owns", [])
    reads = data.get("reads", [])

    # 1. Ownership conflicts + 5. Invalid paths (for owns)
    for path in owns:
        if not path.startswith("shared/"):
            invalid_paths.append({"path": path, "spec": spec_id, "field": "owns"})
            continue
        ownership.setdefault(path, []).append(spec_id)

    # 5. Invalid paths (for reads)
    for path in reads:
        if not path.startswith("shared/"):
            invalid_paths.append({"path": path, "spec": spec_id, "field": "reads"})

    # 2. Missing owned artifacts
    for path in owns:
        if not path.startswith("shared/"):
            continue
        full = os.path.join(relic_dir, path)
        if not os.path.isfile(full):
            missing_owned.append({"artifact": path, "spec": spec_id})

    # 3. Missing read artifacts
    for path in reads:
        if not path.startswith("shared/"):
            continue
        full = os.path.join(relic_dir, path)
        if not os.path.isfile(full):
            missing_reads.append({"artifact": path, "spec": spec_id})

    # 4. Illegal spec files
    try:
        for fname in os.listdir(spec_dir):
            if fname not in ALLOWED_FILES:
                illegal_files.append({
                    "file": os.path.join(spec_dir, fname).replace(relic_dir + "/", ".relic/"),
                    "spec": spec_id
                })
    except OSError:
        pass

# Resolve ownership conflicts
for path, owners in ownership.items():
    if len(owners) > 1:
        conflicts.append({"artifact": path, "specs": owners})

valid = (
    len(conflicts) == 0 and
    len(missing_owned) == 0 and
    len(missing_reads) == 0 and
    len(illegal_files) == 0 and
    len(invalid_paths) == 0
)

result = {
    "valid": valid,
    "conflicts": conflicts,
    "missing_owned": missing_owned,
    "missing_reads": missing_reads,
    "illegal_files": illegal_files,
    "invalid_paths": invalid_paths,
}
print(json.dumps(result, indent=2))
PYEOF
)

#------------------------------------------------------------------------------
# Output
#------------------------------------------------------------------------------
if $JSON_MODE; then
  echo "$RESULT"
else
  # Parse with python3 for human output
  python3 - "$RESULT" <<'PYEOF'
import json, sys
d = json.loads(sys.argv[1])

if d["valid"]:
    print("✓ Shared brain is valid — no issues found.")
else:
    print("✗ Shared brain has issues:\n")

for c in d["conflicts"]:
    print(f'  [CONFLICT] "{c["artifact"]}" is owned by: {", ".join(c["specs"])}')

for m in d["missing_owned"]:
    print(f'  [MISSING]  "{m["artifact"]}" is owned by {m["spec"]} but does not exist in shared/')

for m in d["missing_reads"]:
    print(f'  [MISSING]  "{m["artifact"]}" is read by {m["spec"]} but does not exist in shared/')

for f in d["illegal_files"]:
    print(f'  [ILLEGAL]  "{f["file"]}" is inside spec folder {f["spec"]} (not one of the 4 allowed files)')

for p in d["invalid_paths"]:
    print(f'  [INVALID]  "{p["path"]}" in {p["spec"]}.{p["field"]} does not point into shared/')
PYEOF
fi
