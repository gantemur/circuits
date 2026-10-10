# Phase 1A: browser linear circuit laboratory

Version 0.1, 10 October 2026. Active scope for `codex/phase-1-browser-lab`, based on Phase 0 commit `02671bf`.

## Outcome and boundary

Deliver a static, responsive browser application that uses the Phase 0 TypeScript kernel for every numerical result. Its first six editable examples are the validated RC, loaded RC, directly connected two-stage RC, RL, series RLC, and loaded VCVS amplifier fixtures. The app runs locally and builds static assets whose relative URLs work at `/circuits/` on GitHub Pages. This milestone does not deploy them.

The kernel stays headless. Browser rendering, controls, preset drawing geometry, file handling, and exports live outside `src/`. No backend, account, runtime AI service, graphical wiring editor, new device law, general symbolic analysis, eigenvalue solver, theorem UI, or synthesis is in scope.

## Native documents, inputs, and drawing

- Reuse the strict version-1 `{circuit,experiment}` format without extra UI fields. The selected preset and drawing coordinates are separate browser metadata. Import validates a complete native document before replacing the current one; invalid imports preserve the last valid document and explain the failure. Export returns the current validated document. Reset restores the selected example's original document.
- For each supported preset topology, render a readable SVG showing nodes, ground, ordered terminal orientation, labels, rectangular European resistors, and selected output. Component selection works by pointer and keyboard. If an import has no matching supported topology, show an honest named node/component table instead of a preset drawing.
- Edit positive R/C/L values and finite controlled-source gains with units. Edit independent source DC, optional RMS complex AC values, and one supported time waveform (constant, step, or sinusoid, with peak amplitude and radians for phase). Show and edit equilibrium or complete storage initial values. Let users select one independent transfer input and one observation output. All changes pass kernel validation.
- Validate user-entered fields before analysis. Show errors beside the control. Hide or mark prior results stale as soon as an edit is invalid. A valid edit recomputes immediately. Apply workload limits: 2–241 sweep points and at most 3000 transient steps, including shortened intervals at source events.

## Analyses and presentation

- DC view lists labeled node voltages and signed branch currents. Source/load topology remains visible. A solver failure appears as a status and explanation, not a numeric result.
- The logarithmic frequency sweep selects one unit input and one output. Plot magnitude and phase with readable axes, units, and point statuses. Use dB only for dimensionless V/V or A/A gains; dimensionful V/A or A/V values retain explicit physical ratio units. Zero magnitude has no logarithmic magnitude or defined phase. Failed samples break plotted lines and carry their status into CSV. Clearly distinguish the unit-input transfer from the configured RMS AC phasor response at an inspect frequency.
- Plot the selected output's transient response with time in seconds, the actual measurement unit, requested backward Euler step, and explicit initial policy. A transient failure shows its time and reason; available earlier samples may be displayed without implying later samples succeeded.
- Display the restricted first-order algebraic transfer expression only when the kernel returns `ok`. Otherwise show the kernel's `not-supported` reason while retaining numerical results. Do not infer internal stability from its denominator root.
- Show `E*xdot + K*x = B*u`, deterministic row/unknown/input labels, output relation, and matrix values. Selecting a component highlights only its kernel-recorded contributions and displays its terminal law. Display physical row and ground-KCL residuals plus numerical diagnostics and explanation of units/scaling.
- Export CSV for frequency and transient data with headers including units, sample status, and failed/undefined values. CSV contains data from the current valid run only.

## Continuing interface language requirement

Every new user-facing feature must provide complete English (`en`) and Mongolian Cyrillic (`mn`) interface text through the shared typed localization catalog. The browser remembers an explicit language choice, otherwise follows a Mongolian browser preference and defaults to English. Language changes preserve the native document, analysis state, and uncommitted input drafts. Scientific identifiers, SI symbols, native JSON, and CSV data conventions are language-independent. Diagnostic summaries use stable codes or statuses; technical English details may appear in a clearly labeled expandable section. Maintain the terminology in [LOCALIZATION.md](LOCALIZATION.md).

## Acceptance and verification

Keep Phase 0 tests passing. Add focused browser model/integration tests with independent formulas for:

1. RC magnitude `1/sqrt(2)` and phase `-pi/4` at `1/(2*pi*RC)`.
2. Changing R recomputes transfer and transient values; no result from the previous value is shown as current.
3. Loaded RC has `1/(1+R/RL+sRC)` and direct cascade has `1/(1+3sRC+(sRC)^2)`, differing from isolated stage multiplication.
4. The one-volt RC step follows `1-(1+h/RC)^(-n)` at discrete times, with the visible step size.
5. Native JSON import/export round-trip, invalid-import preservation, and topology fallback.
6. Solver failures appear as error statuses/gaps, never as valid plotted samples.

Check source/time parameter validation, explicit AC versus transfer distinction, provenance highlighting, zero magnitude/undefined phase, CSV statuses, and workload bounds where practical. Run tests, typecheck, kernel and app builds, and `git diff --check`. Exercise the actual app in a browser at the `/circuits/` path on a laptop and narrow viewport; report any unavailable check rather than claiming success. Document local development, build, preview, limitations, and the next unresolved milestone in README and DECISIONS.

For language support, verify dictionary and placeholder parity, saved/preferred language behavior, preservation of valid and invalid edits while switching, Mongolian controls/plots/SVG/error messages, and language-independent JSON/CSV exports. Exercise all six examples and narrow-window layout in both languages.
