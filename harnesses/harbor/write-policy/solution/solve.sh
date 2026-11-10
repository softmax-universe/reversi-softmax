#!/bin/sh
set -eu
cat > /workspace/policy.js <<'POLICY'
export default function decide(input) {
  const corners = input.legalActions.filter(({ row, column }) =>
    (row === 0 || row === 7) && (column === 0 || column === 7));
  return { action: corners[0] ?? input.legalActions[0], memory: null };
}
POLICY
