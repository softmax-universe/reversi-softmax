# Third-party notices

`reversi@3.0.0` is by **kjirou**. Its npm metadata declares the **MIT** license.

- [Source repository](https://github.com/kjirou/reversi)
- [Pinned source commit](https://github.com/kjirou/reversi/tree/52064c1c552ff8a97749d70f0e7ae57e82082738)
- [Published package metadata](https://registry.npmjs.org/reversi/3.0.0)

The published tarball contains no separate license file. The game package consumes its unmodified engine source.
The compiled application bundles that source for the local Worker. Its package attribution, metadata, and original
`reversi` terminal executable are preserved in the installed game dependency. The browser interface and Universe
adapter are new integration code.

The engine is an old pilot dependency with legacy transitive packages. Its selection demonstrates integration with an
existing game; it does not establish that the engine is actively maintained.
