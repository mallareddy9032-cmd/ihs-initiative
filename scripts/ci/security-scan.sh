#!/usr/bin/env bash
# ============================================================================
# Store-compliance security scanner for IHS Phase 5 portal workspace.
# Fails the build if eval() or dynamic remote script injection patterns are found
# in application / shared package source.
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SCAN_ROOTS=(
  "apps/patient-portal"
  "apps/clinical-workspace"
  "apps/operations-hub"
  "packages/types"
  "packages/auth-client"
  "packages/db"
)

INCLUDE_GLOBS=(
  --include='*.ts'
  --include='*.tsx'
  --include='*.js'
  --include='*.jsx'
  --include='*.mjs'
  --include='*.cjs'
)

EXCLUDE_DIRS=(
  --exclude-dir=node_modules
  --exclude-dir=.next
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=coverage
  --exclude-dir=public
)

violations=0

fail_match() {
  local label="$1"
  shift
  local output
  if output="$(grep -RInE "$@" "${EXCLUDE_DIRS[@]}" "${INCLUDE_GLOBS[@]}" "${SCAN_ROOTS[@]}" 2>/dev/null || true)"; then
    if [[ -n "${output}" ]]; then
      echo "SECURITY VIOLATION: ${label}"
      echo "${output}"
      echo
      violations=$((violations + 1))
    fi
  fi
}

echo "==> IHS store-compliance security scan"
echo "    Roots: ${SCAN_ROOTS[*]}"

# 1) Direct eval() usage
fail_match \
  "eval() is forbidden in portal/package source" \
  '(^|[^A-Za-z0-9_$])eval\s*\('

# 2) Function constructor dynamic code execution
fail_match \
  "new Function(...) dynamic code execution is forbidden" \
  'new\s+Function\s*\('

# 3) Dynamic remote script injection via createElement('script')
fail_match \
  "Dynamic <script> element creation is forbidden" \
  'createElement\s*\(\s*['\''"]script['\''"]\s*\)'

# 4) Assigning remote script src (http/https/protocol-relative)
fail_match \
  "Remote script src assignment is forbidden" \
  '\.src\s*=\s*['\''"](https?:)?//'

# 5) document.write script injection
fail_match \
  "document.write script injection is forbidden" \
  'document\.write\s*\(\s*['\''"][^'\''"]*<script'

# 6) import() of remote http(s) modules
fail_match \
  "Remote dynamic import() is forbidden" \
  'import\s*\(\s*['\''"]https?:'

if [[ "${violations}" -gt 0 ]]; then
  echo "==> FAILED: ${violations} security rule group(s) reported findings."
  exit 1
fi

echo "==> PASSED: no eval() or dynamic remote script injection patterns detected."
exit 0
