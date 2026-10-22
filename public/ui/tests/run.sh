#!/bin/sh
# macOS/Linux counterpart of run.ps1. Usage: ./public/ui/tests/run.sh [runtime|browser|all]
set -e
dir=$(cd "$(dirname "$0")" && pwd)
case "${1:-all}" in
  runtime) set -- "$dir/runtime.test.cjs" ;;
  browser) set -- "$dir/browser.test.cjs" ;;
  all) set -- "$dir/runtime.test.cjs" "$dir/browser.test.cjs" ;;
  *) echo "Usage: $0 [runtime|browser|all]" >&2; exit 2 ;;
esac
command -v node >/dev/null || { echo 'Node 22+ is required for automated tests; the UI itself needs only a browser.' >&2; exit 1; }
exec node --test --test-reporter=spec "$@"
