# Using the companion book with Codex

## 1. Recommendation

Provide Codex with the full current book PDF as a private mathematical reference when convenient. For each implementation milestone, direct it to a small set of relevant chapters/sections and the public acceptance fixtures. Supply current LaTeX files and figure/data sources when accurate equation or schematic reconstruction actually needs them.

A broad lab specification plus piecemeal chat instructions is enough to start Phase 0 because its equations and tests are self-contained. It is not the best long-term reference arrangement. Explicit book access reduces repeated explanations and helps preserve definitions, source/load assumptions, signs, model boundaries, and examples across sessions.

Conversely, handing over an entire source tree with the instruction “implement the book” does not define a manageable software milestone. Reference access and implementation scope are separate.

## 2. Public versus private files

| Public repository | Private reference material |
| --- | --- |
| Lab vision, active milestone, conventions, decisions | Current complete book PDF |
| Independently stated fixtures and derivations | Current book master plan |
| Original code and tests | Selected LaTeX source, macros, figures, data, bibliography |
| Model provenance and compatible licenses | Unpublished research papers and private notes |

The public repository must remain buildable and testable without private materials. Public tests contain the circuit topology, units, model parameters, experiment, and independent expected result needed to check the implementation. Do not publish large copied book passages merely to supply an agent with context.

## 3. Local Codex workflow

For a local checkout, put reference copies under the already ignored directory:

```text
circuits/
  .local-reference/
    book/
      book.pdf
      book-master-plan.md
      source/                optional selected current files
```

Use copies or a deliberately configured read-only reference location. The author's current source tree remains authoritative and should not be reorganized by lab implementation work.

Give the task the exact path, baseline date/hash, and relevant sections. Codex should check that the file exists and that it is the requested version before relying on it. The directory is read-only for agent tasks unless an explicit separate request authorizes a book edit.

Before a commit, inspect the staged file list. Ignore rules do not remove previously tracked files or prevent an explicitly forced addition. Do not add this directory, full manuscripts, or private references to Git.

## 4. Cloud Codex workflow

A cloud task receives the files actually available in its selected environment. It does not automatically inherit this ChatGPT project's uploads or a directory on the author's computer.

Provide the PDF/excerpts through a supported private attachment or environment-file mechanism, and have Codex confirm the resulting readable path. If the current client cannot make private reference files available, either use a local checkout with `.local-reference/` or keep the task self-contained using the public fixtures and a narrowly supplied reference brief. Do not make the book public merely to solve an access problem.

A separate private reference repository may become useful later if several tasks need the same versioned source. It is optional, and its permissions must remain separate from the public application. Ordinary implementation artifacts must not embed or redistribute its files.

When a reference is attached privately to a task, retain any exact source files needed by the author separately; a task attachment is not the manuscript's authoritative archive. Record mathematical choices and accepted fixtures in public lab documents so continuity does not rely only on a disappearing task workspace.

## 5. PDF versus LaTeX

| Need | Preferred input |
| --- | --- |
| Understand chapter organization and example intent | Current PDF and section pointers |
| Check equation signs, accents, superscripts, or circuit polarity | Rendered PDF; source when available |
| Reproduce an exact schematic or numerical experiment | Relevant LaTeX/figure source plus parameters/data |
| Follow shared macros or notation | Relevant preamble/macro definitions |
| Implement an ordinary numerical milestone | Public lab specification and tests, with selected book references |
| Edit the book itself | Explicit separate authorization and current editable source |

PDF text extraction can corrupt signs, transpose marks, derivatives, and winding annotations. If an implementation depends on such details, inspect the rendered equation or schematic. A PDF's date alone is not proof that it matches a newer local source.

## 6. Baseline and relevant reference map

The supplied book baseline for these starter documents is:

```text
Title: Circuit Theory: Structure, Response, and Synthesis
       A Mathematical Treatment of Lumped Electrical Networks
Author: Tsogtgerel Gantumur
Baseline: supplied main(10).pdf, treated as canonical main.PDF
Pages: 508
SHA-256: b1147616cf6517e71b83177746570bbe7a3f90726cfcc18d551b12081ee99466
Companion plan: version 1.2, effective 18 September 2026
```

The hash was checked while preparing this bundle. It identifies a reference snapshot; it does not certify that every book result or exercise has been audited.

| Lab task | Starting book sections |
| --- | --- |
| Phase 0 topology and assembly | Chapters 1–3; Appendix C.1–C.4 |
| Solve/scale/diagnose | Appendix C.2 |
| Kron and response fixtures | Appendix C.3–C.4 |
| Initial conditions and integrators | Appendix C.6 and relevant Chapter 3 examples |
| Theorems and local reductions | Chapters 1–2 and 7; relevant Appendix A/D entries |
| Passive synthesis | Chapters 4–7; Appendix C synthesis discussion |
| Amplifiers and feedback | Chapters 9–10; relevant Chapter 11 linearization |
| Nonlinear bias and models | Chapter 11; Appendix C.5 |
| Transients and oscillators | Chapter 12; Appendix C.6 |
| System lessons | Chapters 14–15 as specific tasks require them |

In the checked baseline, printed page 1 is physical PDF page 9. Appendix C starts on printed page 461, physical page 469. This offset must be rechecked after repagination. Prefer section titles and semantic labels over brittle page numbers.

## 7. Reference brief for each task

Supply the following information when a task depends on the book:

1. exact reference file/path and version or hash;
2. chapter/section and figure/equation identifiers;
3. circuit topology or source files;
4. model parameters and units;
5. source, load, output, and initial-state conventions;
6. the claim or example to implement;
7. an independent expected identity, invariant, or refinement check;
8. any known unresolved issue in that passage.

The book is a reference, not an unquestionable test oracle. If code, analysis, and the manuscript disagree, reproduce the discrepancy and explain it before changing the expected answer or silently correcting the book.

## 8. Recommended setup now

Phase 0 can proceed from this starter pack alone. If working locally, add a private reference copy of the current PDF and master plan. For a cloud task, provide the PDF only when the client/environment can actually expose it privately; otherwise the public Phase 0 definitions are sufficient.

Later, give Codex selected current source for each mathematically demanding module. Keep long-term choices and validated examples in the repository so piece-by-piece instructions improve an existing shared specification rather than replace it.
