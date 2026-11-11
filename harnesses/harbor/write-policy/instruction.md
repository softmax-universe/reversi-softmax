# Write a Reversi policy

Write `/workspace/policy.js` as an ECMAScript module exporting a default `decide(input)` function. Return
`{ action: { row, column }, memory }`. Rows and columns are zero based. `input.observation` contains the board,
current player, legal actions, piece counts, and terminal flag. Choose one of `input.actionSpace.actions`.
`input.memory` is the JSON value returned by your previous move, or `null` at the start.

The verifier freezes your file by content hash and evaluates it against the seeded reference in eight games.
Seeds 42 through 45 are each played in both seats. Win, draw, and loss score 1, 0.5, and 0. The task succeeds with
an average score of at least 0.5 across all eight completed games. An incomplete evaluation does not earn a score.

The policy runs in a restricted Worker with public observations, legal actions, and JSON memory. It receives no
filesystem, network, model endpoint, credentials, or scorer store. Work within the decision's time and CPU limits.
The runtime's bundled author stays idle: your Harbor agent owns the outer task.
