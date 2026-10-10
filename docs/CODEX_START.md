# Initial commit and first Codex tasks

## 1. Put this bundle in the repository

Extract the contents of the supplied `circuits-initial-commit` folder into the root of the existing `circuits` repository. The root should contain `README.md`, `AGENTS.md`, `LICENSE`, `.gitignore`, and `docs/`.

If any files already exist, compare and merge them rather than overwriting existing user work. In particular, reconcile a pre-existing license. The starter bundle is documentation, not an initialized Git repository or a tested application.

Inspect the staged files and commit the documentation. Suggested commit message:

```text
docs: define Circuits Unfolded vision and Phase 0 specification
```

Keep the companion book, private master plan, and research papers outside the public repository. A local `.local-reference/` directory is already ignored; see `REFERENCE_WORKFLOW.md`.

## 2. Connect Codex

For local work, open a checkout of `circuits` in Codex with ordinary GitHub authentication configured for that checkout. The ignored private-reference folder is convenient in this arrangement.

For cloud work, create a Codex cloud environment selecting the GitHub `circuits` repository and grant it access to that repository. Follow the current client setup flow. Verify that a task can read the committed documents and report the repository/branch before implementation. A generic ChatGPT repository-reading connection is not the same thing as a writable coding checkout.

Official setup references:

- [Codex cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)
- [Codex local/cloud environment choices](https://learn.chatgpt.com/docs/environments/modes)

Connecting the repository does not require making it public. Cloud tasks do not automatically inherit the book files in another ChatGPT conversation or on your computer.

## 3. Optional architecture-only first task

Use this when you want to inspect the design before code is written:

```text
Work in my circuits repository.

Read AGENTS.md, docs/DECISIONS.md, docs/MVP_SPECIFICATION.md,
docs/MATHEMATICAL_CONVENTIONS.md, docs/REFERENCE_WORKFLOW.md,
and docs/VISION.md. Inspect the actual repository and existing changes.

Perform a bounded Phase 0 architecture review. Do not implement code yet.
Check the sign conventions, descriptor formulation, controlled-source
currents, single-storage transfer reduction, initialization restrictions,
numerical diagnostics, and acceptance-test coverage.

Return a concrete module/data-model plan and any substantive issues that
must be resolved. Routine dependency and module choices should have a
recommended default rather than becoming a long approval questionnaire.
Do not expand the milestone to UI, nonlinear devices, general symbolic
analysis, or synthesis. Do not edit the book or publish private references.
```

The documents already settle the principal architecture. This review is useful for catching inconsistencies, not for generating another unconstrained project vision.

## 4. Phase 0 implementation task

Use this when you want Codex to build the first complete milestone:

```text
Implement Phase 0 in my circuits repository.

Read AGENTS.md and the documents in docs/. Inspect the actual worktree,
preserve existing user changes, and follow docs/MVP_SPECIFICATION.md as
the active scope and acceptance contract.

Start with a brief architecture check. Resolve ordinary implementation
choices yourself within the specification, record consequential choices,
and continue through implementation and verification. Do not stop merely
to ask approval for routine modules or tests. If a substantive mathematical
contradiction or genuinely missing requirement blocks correctness, report
it precisely and continue independent parts where possible.

Build the browser-compatible TypeScript headless kernel: circuit data and
validation, R/C/L and independent/controlled sources, labeled MNA assembly,
DC and complex-frequency solves, numerical transfer evaluation, the
restricted single-storage algebraic transfer calculation, fixed-step
backward Euler with supported initialization/breakpoints, and the small
resistor Kron helper.

Implement every analytic acceptance fixture in the MVP, including loaded
RC stages, controlled-source signs, singular/contradictory constraints,
transient refinement, orientation invariance, matrix provenance, and JSON
round-trip. Use independent expected formulas. Do not hardcode answers
from circuit names and do not loosen tests just to make them pass.

The public specification is self-contained for this milestone. If a
private book reference is actually readable, use relevant Appendix C
sections as additional context; do not require a missing book attachment
to begin ordinary Phase 0 work.

Provide an executable headless demonstration and documented test,
typecheck, and build commands. Run them. Update README and DECISIONS
with actual implemented status and limitations. Do not implement the
graphical editor, nonlinear models, general synthesis, or later phases.

Use a task branch if supported. Finish with a reviewable change and report
what was implemented, validation results, limitations, and the next
bounded milestone. Do not merge to main, change repository visibility,
or deploy the site as part of this task.
```

If you want remote saving or a pull request in that task, add explicit instructions naming the desired branch/push or draft PR. Implementation alone should not be interpreted as permission to publish every reference or deploy a release.

## 5. Supplying a book reference

Add a short paragraph using the actual readable path, for example:

```text
The private reference PDF is available at .local-reference/book/book.pdf.
Confirm it is readable before using it. Start with Appendix C.1–C.4 and
C.6. Follow the public conventions and active MVP; reference access does
not authorize modifying or committing the manuscript. If the file is not
available in this environment, say so and proceed from the self-contained
Phase 0 specification.
```

Use this exact local path only when you have really created it. For a cloud attachment, substitute the path actually returned by the task environment. Selected chapter source, macros, and figure/data files can be supplied privately for later specific modules.

## 6. Following milestones

After reviewing Phase 0, give the next task a new bounded acceptance contract. An example order is browser linear lab, theorem/reduction interface, nonlinear bias and compact devices, nonlinear transients/oscillators, then selected passive synthesis.

Do not ask an agent to implement the whole book or every vision feature in one task. Keep the repository documents current as piece-by-piece discussions settle new requirements.
