# Phase 3B2 — browser Ebers–Moll laboratory

Task branch descends from accepted Phase 3B1 `eeb4bee`. Public main remains Phase 3A4. No kernel, tolerance, native-schema, merge, or deployment changes are included.

## Contract

Route strict native v1/v2/v3 through their own validators. Invalid imports/edits preserve the applied document; valid edits advance revision and invalidate bias/tangents. Exact IDs, editor drafts/conflicts, independent panel IDs/settings, and explicit missing-reference selection remain. V3 Form construction is deferred with a translated notice; JSON editing and source/component/model inspector editing are supported. Never represent Q as a two-terminal proxy.

Use the accepted headless BJT APIs for bounded DC (64 unknowns and 128 components), current-bias tangent, configured RMS AC and unit-input frequency sweep (existing 241-point bound). DC shows all entering terminal currents, voltage differences, transport terms, region descriptions, signed power and physical diagnostics. Equations show the three terminal laws and labeled full derivatives. Regions describe the continuous law; cutoff leakage and nonzero saturation voltage remain. Frequency dependence comes only from external storage in this memoryless model. Model parameters must remain positive finite; pending invalid text remains correctable.

Provide NPN common emitter, emitter follower, saturation, cutoff and PNP counterpart presets, bilingual baseline explanations, suggested DC/frequency panels, and topology-matched connected conventional symbols. Changed topology uses exact c/b/e tables. Existing v1/v2 features including diode transient workers remain operational. V3 transient, characteristic/source sweep, port and Transform tools report translated unavailability.

## Acceptance

Independent references: CE gain −47.6190476531; follower .9756097561; saturation (.875,.035,−.910) mA; cutoff (.125,−.130,.005) pA. Check current conservation/signs, PNP mirror, source/load/model edits, complex external-storage and terminal-current responses, strict imports and invalid edits, stale/missing references, drafts and existing v1/v2 workers. No hardcoded live answers.

Run clean installation, focused/full tests, typecheck, kernel/app/site builds, all nonlinear demos, DOM-free bundle smoke and diff check. Separately record actual packaged-browser evidence in English/Mongolian at desktop, 390 and 320 px: drawings, edits, results/failures, JSON round trips, drafts, console/overflow. File selection/download completion must not be inferred from serialization tests. Independent controller audit precedes publication.

## Task verification

Thirteen focused production-path regressions and the full 230-test suite passed; the old Phase 3B1 browser rejection test moved to the Phase 3B2 strict-routing acceptance test. Existing example counts changed from 30 to 35; previous scientific expectations did not change. Kernel sources are unchanged. Typecheck, kernel/app/site builds, all nonlinear demos and DOM-free bundle checks are recorded in DECISIONS along with actual browser evidence.

Actual packaged Chrome checks covered all five examples in both languages at desktop, 390 and 320 px; the diagram scrolls locally and document width did not overflow. Model/load edits, literal-ID JSON application and rejection, draft conflicts, keyboard selection, current-output RMS analysis, explicit Transform unavailability, linear RC and divider behavior and the v2 worker transient were exercised. Browser file-chooser and completed-download events were not available in this session; JSON editor and serialization checks do not establish those interactions. The startup Chrome message-channel errors are recorded separately from application results. No merge or deployment occurred.

## Focused acceptance review — 13 October 2026

The follow-up to `5b108a2` fixes the Form visibility guard: clean builders synchronize first, and only the unsupported v3 placeholder is hidden. An existing edited v1/v2 draft remains visible with its exact text and stale-base conflict, including through language/navigation changes. Apply still rejects stale bases; explicit New creates an editable v1 draft and Discard restores the appropriate current-document state.

Mixed Q/D inspectors use the accepted full v3 operating point for diode terminal/junction voltage, signed current and differential resistance. No Q-deleted proxy solve is used. Mixed-system diode Jacobian contribution tables are not exposed; the limitation is labeled explicitly. V2 contribution tables retain their existing path. Failed Q inspectors use a BJT-specific bilingual message, and the DC unknowns heading now includes branch currents as well as node voltages.

Validation: 17 focused tests (14 Phase 3B2 plus 3 production BuilderUI interaction tests), all 232 tests, typecheck, kernel/application/site builds, three nonlinear demos, DOM-free BJT/diode bundle execution and diff check passed after clean installation. Kernel, native schema and existing scientific expectations are unchanged.

Isolated Chrome verified visible Form conflicts/New, mixed-device edits and failures, exact IDs, all five presets/lessons with suggested DC/frequency panels, missing observations, unsupported v3 tools, and v2 worker cancellation/completion. Both languages at 1400, 390 and 320 px stayed within the viewport. Actual downloaded v1/v2/v3 JSON bytes round-tripped via protocol file selection; malformed and invalid v3 imports preserved the applied document. Completed BJT frequency CSVs included A/V and V/V units, complex values and explicit numerical-failure rows. A v2 transient CSV retained 52 samples and event sides.

The earlier Chrome message-channel errors did not recur in a fresh isolated profile on blank, simple, packaged or published pages, but their historical origin remains unattributed. Startup captured favicon 404s on the packaged and published applications; no application runtime exceptions or console messages occurred during the subsequent audited interactions. Protocol selection is not a human-operated OS-picker check. See the appended decision record for precise evidence and limits. This remains an unmerged, unpublished task branch for a separate publication decision.
