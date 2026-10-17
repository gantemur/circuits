# Public technical decisions and published status

This page records the stable **product** contract. Detailed historical implementation discussions and execution logs from before the public/private migration remain accessible through the repository's [historical Git revision](https://github.com/gantemur/circuits/blob/86a64932cee48d60acf9c8f6e333a97293a70318/docs/DECISIONS.md); migration did **not** rewrite Git history. Current internal coordination and executor reports are kept separately from public product documentation.

## Architecture and mathematical commitments

| Decision | Public contract |
| --- | --- |
| Product identity | `Circuits Unfolded` is the working title; repository slug stays `circuits` |
| Hosting | Static browser application on GitHub Pages, no runtime backend or external AI dependency |
| Implementations | Inspectable TypeScript numerical kernel, independently testable without the DOM; bilingual English/Mongolian browser lab |
| Scientific definition | Strict native `{circuit, experiment}` document; ordered terminal roles, explicit sources, measurements and initial states |
| Descriptor system | `E xdot + K x = B u`, with `A = -K` when translating the book's state form |
| Conventions | Voltage `V(p)-V(n)`, current positive `p→n`, absorbed power positive, exact ground node `0` |
| Calculations | Small dense linear/nonlinear solvers with finite checks and physical residuals; explicit unsupported cases |
| Geometry | Ideal wires define topology; crossings and coincident coordinates do not connect automatically; Apply is separate from Save |
| Preservation | Original scientific IDs, source/storage definitions and observations are retained through strict round trips |
| References | Book/manuscript material and unrelated research remain outside the public product; public fixtures and contracts are self-contained |
| Readability | Maintained mathematical and numerical methods are teaching source, with derivations, signs, units, limitations and independent checks |
| License | Original public source and documentation use MIT; companion manuscript and third-party material retain separate rights |

See [CONTRIBUTING.md](CONTRIBUTING.md), [MATHEMATICAL_CONVENTIONS.md](MATHEMATICAL_CONVENTIONS.md), [KERNEL_API.md](KERNEL_API.md), [PROJECT_FORMAT.md](PROJECT_FORMAT.md) and [WIRING_API.md](WIRING_API.md) for binding technical details.

## Published scope

- **Phase 0–2:** strict linear R/C/L and controlled-source kernel, labeled MNA, DC/complex frequency, backward Euler transients, one-port reductions, resistance transformations, visual learning and example library.
- **Phase 3A:** strictly validated diode model and browser DC/frequency/transient workflow with model-specific limitations.
- **Phase 3B:** strictly validated BJT DC/local small-signal workflow; unsupported transient/port cases remain explicit.
- **Phase 5A:** exact RC Cauer and Foster I/II synthesis with mathematical certificates, strict native realization and independent numerical verification; certificates never automatically transfer to edited circuits.
- **Phase 6A:** native-v1 R/C/L/V/I Graphical editor, explicit wire connectivity, independent Form/JSON/Graphical drafts, guarded Apply, portable versioned `.cuf.json` project Save/Open and verified deterministic initial layouts with preview, consent and exact geometry/history.

The latest published baseline before this documentation-only migration is [`86a64932cee48d60acf9c8f6e333a97293a70318`](https://github.com/gantemur/circuits/commit/86a64932cee48d60acf9c8f6e333a97293a70318), preserving all **35 examples**. Latest accepted 6A3c1–6A3c2 layout implementation was `dcde3d2c10ce06e34672cef40a611c18372f9c54`, validated with **542 tests**, including 69 focused expectations. See [published browser evidence](evidence/phase-6a3c-release/README.md), [headless layout evidence](evidence/phase-6a3c1/README.md) and [initial browser evidence](evidence/phase-6a3c2/README.md). The accepted public HTML/JS/CSS package is versioned by content hash; phase specs remain technical records, not authorization to implement unapproved future work.

## Build and release integrity

- GitHub Actions [Validate](../.github/workflows/validate.yml) runs on push and PR with Node 24: `npm ci`, all tests, typecheck and application build.
- [Pages](../.github/workflows/pages.yml) publishes **only on `main`**, after the validation and package jobs succeed; the site consists of `index.html`, `app.js`, `style.css`.
- A documentation-only change must not alter native formats, numerical tolerance, physical result or production assets. Recompute and compare the actual source build/package against its accepted baseline before declaring publication.
- Representative independent expectations include divider 8 V / 4 mA; RC `H(i1000)=0.5−0.5i`; RLC `H(i10000)=−10i`; balanced bridge 5/5 V and unbalanced 70/13, 80/13 V with cross-current −1/1300 A; and Cauer/Foster `Z(i1000)=1200−1600i Ω` on the documented examples.

The [README](../README.md), [phase specifications](./), [fixture manifest](../fixtures/README.md), and [public release evidence](evidence/phase-6a3c-release/README.md) describe published features and historical evidence. Development-only operational briefs, locks and working reports are not stored in this public tree.

## Known limitations

Graphical editing currently supports strict native v1 R/C/L/V/I, not controlled-source v1 or nonlinear v2/v3 editing. Large networks may require horizontal scrolling, component labels retain provisional formatting, and generalized autorouting, autosave and crash recovery are not claimed. Numerical conditioning evidence is diagnostic rather than a general certification of accuracy or physical device fidelity.
