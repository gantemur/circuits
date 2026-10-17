# Contributing to Circuits Unfolded

The maintained TypeScript in `src/` is mathematical teaching material, not merely a production artifact. Favor explicit stages, meaningful names, finite-dimensional units and independent numerical checks over clever compression. Generated browser bundles may be optimized.

## Scientific and numerical invariants

- Before changing element laws, read [mathematical conventions](MATHEMATICAL_CONVENTIONS.md), [kernel API](KERNEL_API.md), and the relevant published phase specification.
- Ordered two-terminal conventions are `v = V(p)-V(n)`, current positive from `p` to `n`, and absorbed power `p=vi`. The descriptor residual is `E xdot + K x = B u`; the book state-form convention has `A=-K`.
- Preserve algebraic constraints. A singular derivative matrix in modified nodal analysis is expected; do not invert or arbitrarily regularize it.
- Separate independent source coordinates from DC, AC and transient source values. Include connected loading, output and initial conditions in experiment definitions.
- Solve finite linear systems rather than constructing unnecessary inverses. Distinguish exact identities, floating-point diagnostics, time-discretization error and device-model accuracy.
- Preserve strict native JSON validation and exact scientific meaning across graphical edits. Electrical connectivity follows declared wires, not coincident drawing coordinates.
- Unsupported models and ambiguous configurations should fail explicitly, never silently substitute a different ideal model.

## Code and evidence

- Document mathematical and numerical assumptions, dimensions, units, signs, algorithms and meaningful limitations close to each substantial implementation.
- Introduce a device stamp with an independently derived circuit expectation and polarity/power check. Do not generate an expected number from the same algorithm being tested.
- Do not lower tolerances, suppress validation or remove a failing test merely to make checks pass.
- Use the committed native fixtures and tests; see the [fixture manifest](../fixtures/README.md) and [code reading map](CODE_GUIDE.md).
- Run `npm ci`, `npm test`, `npm run typecheck` and `npm run build:site` when appropriate. GitHub Actions runs under Node 24 and publishes only from `main`.
- Public source, tests and documentation must be independently usable without unpublished book files. Handle external material according to [the public reference policy](REFERENCE_WORKFLOW.md).
- Respect the repository [MIT license](../LICENSE); the independently authored companion book and third-party material are not included in that grant.

These are product and contribution contracts, not private agent instructions or task authorization. Source changes should use reviewable commits and retain the published scientific behavior unless expressly scoped otherwise.
