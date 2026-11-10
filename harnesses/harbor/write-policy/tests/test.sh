#!/bin/sh
set -eu
mkdir -p /logs/verifier
printf '0\n' > /logs/verifier/reward.txt
/opt/reversi/bin/reversi-harbor-verify --policy /workspace/policy.js --output /logs/verifier
