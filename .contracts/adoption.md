# Adopted architectural contracts

Reviewed Tenet Contracts v13.0.1, commit 01e7ac85f524a5446d04941e7db895af0b24f817, through Universe's
reviewed public copy at [774ca88](https://github.com/softmax-universe/universe/tree/774ca882fbb05c6e3faabf4df8ed6366ece0a030/.contracts).
Upstream: https://github.com/macromackie/tenet-contracts. The .tenet.lock records exact selected sources and assets.

Adopted 008 dependency boundaries, 009 TypeScript modules, 010 entry points, 011 file roles, and 012 folder size,
including their portable checkers. No skills or unrelated contracts were copied. Local configuration declares the
game/application graph, browser/Node/Worker lanes, and the two actual runtime entry points. Game rules and recording
requirements remain local contracts. Source size is limited to 300 lines; Python class/function conventions remain
reviewed because the adopted structural lint covers JavaScript and TypeScript.
