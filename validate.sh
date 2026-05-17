#!/bin/bash
cd "$(git rev-parse --show-toplevel)"
echo "=== TypeScript Check ==="
npm run typecheck
echo ""
echo "=== Dashboard Tests ==="
npm test -- --testPathPattern=dashboard --run
