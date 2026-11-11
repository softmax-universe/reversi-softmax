#!/bin/sh
set -eu
cat > /workspace/policy.js <<'POLICY'
export default function decide(input) {
  const positionalWeights = [
    [100, -25, 10, 5, 5, 10, -25, 100],
    [-25, -40, -2, -2, -2, -2, -40, -25],
    [10, -2, 4, 2, 2, 4, -2, 10],
    [5, -2, 2, 1, 1, 2, -2, 5],
    [5, -2, 2, 1, 1, 2, -2, 5],
    [10, -2, 4, 2, 2, 4, -2, 10],
    [-25, -40, -2, -2, -2, -2, -40, -25],
    [100, -25, 10, 5, 5, 10, -25, 100],
  ];
  const action = input.actionSpace.actions.reduce((best, candidate) =>
    positionalWeights[candidate.row][candidate.column] > positionalWeights[best.row][best.column]
      ? candidate : best);
  return { action, memory: null };
}
POLICY
