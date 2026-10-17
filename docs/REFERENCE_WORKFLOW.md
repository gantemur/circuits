# Mathematical references and reproducibility

Circuits Unfolded accompanies an independently authored circuit-theory book, but the public browser application **does not require that book** or any private manuscript to build, run, or pass its tests.

The public [mathematical conventions](MATHEMATICAL_CONVENTIONS.md), [kernel API](KERNEL_API.md), [source-reading guide](CODE_GUIDE.md) and [independently derived fixtures](../fixtures/README.md) state the accepted laws, units, modeling boundaries and reference results used by the application.

Private book PDF/LaTeX drafts, master plans, unpublished research notes and restricted third-party sources must not be committed to this public repository or included in generated site assets. The project may keep a local ignored `.local-reference/` directory when references are deliberately supplied for separate author-approved work, but normal development and testing must not depend on it. A missing reference is not evidence for reconstructing an unseen equation or changing a scientific expected value.

When adapting material, verify the author's rights and attribute externally licensed sources. Treat a supplied book result as a reference to check, not as an unquestionable numerical oracle. Preserve evidence and model limitations in public tests and specifications.

Historical internal instructions for supplying private references are not part of the public product workflow. This page intentionally contains no book-source paths, access tokens or operational cloud setup details.
