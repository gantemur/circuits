# Interface terminology and data conventions

The UX workspaces branch continues English (`en`) and Mongolian Cyrillic (`mn`) from Phase 2A. New user-facing features should add both translations to the typed catalog in `web/i18n.ts`, keep interpolation placeholders aligned, and use stable diagnostic codes rather than parsing English messages. Technical wording here is a reviewable working glossary.

| English | Монгол | Use |
| --- | --- | --- |
| Voltage | Хүчдэл | Node and element voltage |
| Current | Гүйдэл | Branch and source current |
| Frequency | Давтамж | Hz, including log sweeps |
| Frequency sweep | Давтамжийн мужийн тооцоо | Samples across a chosen frequency range; specify a logarithmic scale when used |
| Transfer function | Дамжуулах функц | Algebraic relation (H(s)) |
| Transfer response | Дамжуулалтын хариу | Numerical unit-input sweep |
| Magnitude | Модуль | `\|H\|`; dB only for dimensionless ratios |
| Phase | Фаз | Degrees in plots; radians for sinusoid input phase |
| Initial conditions | Анхны нөхцөл | Storage state or pre-start equilibrium |
| Equilibrium | Тэнцвэр | Pre-start constant-source state |
| Storage state | Хадгалалтын төлөв | Capacitor voltage or inductor current |
| Peak amplitude | Оргил далайц | Time-domain sinusoid parameter |
| RMS phasor | RMS фазор | Complex AC source parameter |
| Backward Euler | Далд Эйлерийн арга | First-order implicit time integration; retain “Backward Euler” in explanatory text |
| Damped oscillation | Далайц нь буурах хэлбэлзэл | Default underdamped series RLC example; damping need not imply oscillation in every circuit |
| Residual | Үлдэгдэл | Physical or scaled numerical diagnostic |
| Backward residual | Буцах үлдэгдэл | Numerical solve diagnostic, not a matrix inverse |
| Pivot ratio | Гол элементүүдийн харьцаа (pivot ratio) | Smallest/largest accepted Gaussian-elimination pivots; not a circuit pole or condition number |
| Ground / reference node | Газардалт / лавлах зангилаа | Native node ID `0` |
| Component contribution | Элементийн хувь нэмэр | Kernel-recorded matrix provenance |
| Circuit builder | Хэлхээ бүтээгч | Form-based entry, without a wiring canvas |
| Unapplied draft | Хэрэглэгдээгүй ноорог | Editable form or JSON text that is not the analyzed circuit |
| Controlling branch | Удирдах салаа | Retained voltage-type branch for CCVS/CCCS control |
| Ordered terminals | Эрэмбэлсэн туйлууд | `V(p)−V(n)` and positive current `p→n` |
| Equivalent circuit | Эквивалент хэлхээ | DC one-port terminal behavior |
| Thévenin | Тевенен | Signed open-circuit voltage and equivalent resistance |
| Norton | Нортон | Current-source arrow `q→p`, signed current `IN` |
| Open circuit | Нээлттэй хэлхээ | No **additional** external port load; existing branches remain |
| Short circuit | Богино холболт | Added zero-volt source across the port |
| Test source | Туршилтын үүсгүүр | Inject current `q→p` after zeroing independent DC coordinates |
| Load current | Ачааллын гүйдэл | External resistor current `p→q`, opposite injected port current |
| Agreement criterion | Нийцлийн нөхцөл | Separate voltage/current absolute floors and relative terms |
| Analyze workspace | Шинжлэх ажлын талбар | Circuit view and independently configurable result panels |
| Transform workspace | Хувиргах ажлын талбар | DC Thévenin/Norton comparison and task-branch passive resistor methods |
| Retained terminals | Хадгалах туйлууд | Ordered boundary set `B` in a resistor response matrix |
| Internal node | Дотоод зангилаа | Eliminated set `I`; a native preview keeps node `0` |
| Conductance | Дамжуулалт | Siemens; reciprocal of resistance |
| Terminal response matrix | Туйлын хариу матриц | `i_B=Λu_B`, currents entering the network |
| Star–delta / delta–star | Од–гурвалжин / гурвалжин–од | Three-neighbor passive resistor identities |
| Star–mesh | Од–тор | Eliminating one center and adding pair couplings |
| Kron reduction | Кроны бууруулалт | Schur complement computed by linear solves |
| Circuit editor | Хэлхээ засварлагч | Dedicated Form and JSON views with separate unapplied drafts |
| Panel settings | Самбарын тохиргоо | Per-instance controls; no shared global sweep settings |
| Last valid result | Сүүлчийн зөв үр дүн | Kept visible while invalid pending panel text is corrected |
| Suggested layout | Санал болгосон байрлал | Preset's two-panel starting point, restored explicitly after customization |
| DC port characteristics | DC туйлын үзүүлэлт | Compact Phase 2A result, not general impedance analysis |
| Port analysis — frequency | Туйлын шинжилгээ — давтамж | Phase 2C one/two-port Z and Y experiments |
| Impedance | Импеданс | Z matrix; port voltage divided by entering port current, Ω |
| Admittance | Адмиттанс | Y matrix; entering port current divided by port voltage, S |
| External voltage drive | Гадаад хүчдэлийн үүсгүүр | Explicitly excluded independent voltage branch across port 1 |
| Loading comparison | Ачааллын харьцуулалт | Parameter prediction checked against a directly connected circuit |
| Source resistance / load resistance | Үүсгүүрийн эсэргүүцэл / ачааллын эсэргүүцэл | Finite Rs and RL; open load is a separate choice |

Component IDs, node IDs, user-provided labels, device codes, equations, and SI symbols remain unchanged in both languages. Native JSON uses the version-1 English field names and finite JSON numbers. Frequency and transient CSV headers, statuses, decimal points, and numerical values are likewise locale-neutral so exports round-trip and compare identically across languages. The interface translates labels and diagnostic summaries; expandable **Technical details (English)** retains original kernel messages where useful.

An explicit language choice is stored under `circuits-unfolded-language` in browser localStorage. If storage is unavailable, the in-memory choice still works for the current visit. Without a saved choice, the first browser-preferred language selects Mongolian when its tag is `mn` or `mn-*`; English is the fallback.

## Phase 2D1 visual-learning terms

| English | Монгол | Use |
| --- | --- | --- |
| Preview transformation | Хувиргалтыг урьдчилан харах | Explicit operation before any circuit replacement |
| Use transformed circuit | Хувиргасан хэлхээг хэрэглэх | Revalidated resistor result only |
| Return to original circuit | Анхны хэлхээнд буцах | Session snapshot, with draft protection |
| Local rewrite illustration | Хэсэгчилсэн хувиргалтын зураг | Only the changed subnetwork; never the full circuit |
| Terminal equations | Туйлын тэгшитгэл | Ordered `I_B=ΛV_B`, Λ in S, current in A |
| Clamped terminal | Тогтоон барьсан туйл | Set to 0 V in the illustrative experiment, not left open |
| Baseline fixture target | Суурь жишээний зорилт | Authored reference, not a recalculation after edits |
| Study guide | Математик ба санал болгох туршилтууд | Shared Analyze/Transform lesson |

Exact node/component IDs, generated resistor names, equations, units, and JSON remain untranslated. The 1 V boundary experiment is explained separately from the existing independent equivalence checks. Source/storage blocker labels are translated, but the native device codes remain exact.
