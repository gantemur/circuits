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
| Transform workspace | Хувиргах ажлын талбар | DC Thévenin/Norton comparison and passive resistor methods |
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

Component IDs, node IDs, user-provided labels, device codes, equations, and SI symbols remain unchanged in both languages. Native v1, v2 and v3 JSON retain their declared English field names and finite JSON numbers. Frequency, transient, and diode-sweep CSV headers, statuses, decimal points, and numerical values are likewise locale-neutral so exports round-trip and compare identically across languages. The interface translates labels and diagnostic summaries; expandable **Technical details (English)** retains original kernel messages where useful.

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

## Phase 2D2 filter and impedance terms

| English | Монгол | Use |
| --- | --- | --- |
| Passive filter | Идэвхгүй шүүлтүүр | R/C/L network without the ideal follower |
| Active filter | Идэвхтэй шүүлтүүр | Baseline RC filter using an ideal powered VCVS follower |
| Butterworth baseline | Баттервортын суурь | Flat-magnitude component ratio at the stated fixture values; edits need not retain it |
| Follower | Дагагч | Ideal unity-gain voltage-controlled voltage source, not a realistic op-amp |
| Band-pass | Зурвас нэвтрүүлэх | Series RLC resistor-voltage measurement |
| Notch / band-stop | Зурвас хориглох | Series RLC L+C-voltage cancellation measurement |
| Impedance ladder | Импедансын шаталсан сүлжээ | Source-free driving-point RC or RL network |
| Continued fraction | Үргэлжилсэн бутархай | Tail-first series/shunt expression for driving-point Z |
| Cutoff | Заагийн давтамж | Overall −3 dB point, distinct from an individual element break |

The translated filter guides keep native IDs such as `resistorVoltage`, SI coefficients, and normalized variables `s` and `z` exact. They distinguish an authored baseline from the live numerical result and describe undefined phase at an ideal zero without inventing a plotted value.

## Phase 3A2 diode terminology

The published browser uses **диодын ажлын цэг** for operating point Q, **орон нутгийн дифференциал эсэргүүцэл** for `rd=dV/dI`, **диодын тодорхойломж** for the terminal I–V characteristic, and **ачааллын шулуун** for an externally proved resistor/source load line. `Rs` is **дотоод цуваа эсэргүүцэл**; it is distinct from the external resistor and from the bias ratio `V/I`. **Бага дохионы хариу** means the local incremental response around a specific DC bias, not the absolute nonlinear response. A **DC үүсгүүрийн мужийн тооцоо** samples source values, not physical time or certified hysteresis. Keep `Is`, `Rs`, `rd`, `Q`, exact device IDs, equations, SI units, JSON names, and CSV headers unchanged across languages. Failure details and progress labels must re-render when language changes while preserving pending drafts.

The reviewed previews say **Анхны хэвийлтийн үүсгүүр** for an original DC bias source and **Өсөлтийн үүсгүүр** for its zero-DC small-signal counterpart. The latter's AC value is RMS. **Лавлах зангилааны гишүүн** identifies a formal ground contribution shown for teaching but absent as an independent reduced-MNA row or voltage coordinate. A missing selected diode requests reselection; translation must not substitute another device's metrics. A plotting-range message states a display limitation rather than inventing a zero sample.

## Phase 3A4 nonlinear transient terms

| English | Монгол | Use |
| --- | --- | --- |
| Run transient | Шилжилтийн тооцоог эхлүүлэх | Explicit action; rendering never starts a solve |
| Actual time source | Бодит хугацааны үүсгүүр | Waveform value driving the transient, distinct from declared DC and RMS AC |
| Prescribed storage | Өгсөн хадгалалтын төлөв | Specified capacitor voltage or inductor current at start |
| Compatible instantaneous rate | Нийцтэй агшин зуурын хурд | Initial/right-event storage rate, not an interval difference |
| Accepted sample | Зөвшөөрсөн сорьц | Successful kernel state; failed iterates are never samples |
| Left/right event values | Үйл явдлын зүүн/баруун утга | Separate values at the same exact source-step time |
| Arithmetic allowance | Арифметикийн зөвшөөрөл | Estimated rounding budget, not a certified error bound |
| Numerical failure | Тоон бодолтын алдаа | Stable stage/code and accepted prefix shown outside collapsed details |
| Ripple | Долгиолол | Smoothed rectifier variation; displayed cycles do not prove periodic state |

Keep exact IDs, SI units, equation symbols, native field names, CSV headers, side/status codes and decimal points unchanged. Translate status and failure summaries when language changes, including completed and obsolete runs. Sinusoidal `amplitudePeak` is **оргил далайц**; Frequency's AC phasor remains RMS. Backward Euler remains **Далд Эйлерийн арга (Backward Euler)** in explanatory text.


## Phase 3B2 transistor terminology

| English | Монгол | Meaning |
| --- | --- | --- |
| Common-emitter amplifier | Ерөнхий эмиттертэй өсгөгч | Inverting voltage stage with actual source/load connections |
| Emitter follower | Эмиттерийн дагагч | Loaded voltage follower; gain is calculated |
| Collector / base / emitter | Коллектор / бааз / эмиттер | Exact terminal symbols c/b/e remain unchanged |
| Forward / reverse active | Шууд / урвуу идэвхтэй | Junction-bias description, not a separate model |
| Saturation | Ханалт | Both junctions forward biased; Vce is not forced to zero |
| Cutoff (BJT) | Хаалт | Leakage remains; distinct from a filter's заагийн давтамж |
| Transport saturation current | Зөөгдөлтийн ханалтын гүйдэл | Canonical IS, not a separately fitted junction current |
| Forward / reverse current gain | Шууд / урвуу гүйдлийн өсгөлт | βF / βR |
| Signed absorbed power | Тэмдэгтэй шингээсэн чадал | Entering-current convention |
| Local terminal derivatives | Туйлын орон нутгийн уламжлалууд | All nine entries ∂i/∂V, in S |

NPN/PNP, Ebers–Moll equations, native IDs/JSON and SI symbols are invariant. σ changes polarity; every numerical terminal current still enters the transistor. Exponentially tiny derivative underflow is explained separately from exact zero current. The bilingual guides label baseline references explicitly; edited responses always come from the kernel.

## Phase 5A3 synthesis terminology (task branch)

The focused catalog is `web/synthesis-copy.ts`; the shared navigation label remains in `web/i18n.ts`. Exact rational strings, scientific IDs, units and formula constants never depend on language. Raw kernel diagnostics and certificate fields remain inside explicitly labeled English technical disclosures; status summaries, actions, limits and construction-step explanations are translated at render time.

| English | Mongolian | Meaning |
| --- | --- | --- |
| Synthesize | Нийлэгжүүлэх | Construct a circuit from its prescribed terminal response |
| Driving-point impedance | Оролтын импеданс | Port voltage divided by positive entering-port current |
| Admittance | Адмиттанс | Reciprocal of impedance |
| Exact rational number | Яг рационал тоо | Fraction represented exactly, not a binary64 approximation |
| Cauer extraction | Кауэрын задаргаа | Alternating series R and shunt C extraction |
| Foster decomposition | Фостерын задаргаа | Exact supplied pole/section coefficients |
| Exact identity | Яг адилтгал | Polynomial reconstruction, distinct from sampled evidence |
| Numerically unresolved | Тоон шалгалт шийдэгдээгүй | A numerical diagnostic did not establish agreement |
| Pole order | Туйлын эрэмбэ | Endpoint asymptotic order, not a matrix pivot |
| Rounding discrepancy | Тоймлолтын зөрүү | Exact SI rational versus its finite native value |

Foster II coefficients refer to the positive `a*z/(z+p)` branch coefficients, not ordinary partial-fraction residues. The two finite-term labels explicitly distinguish impedance residue from admittance branch coefficient, while preserving the positive pole-rate convention.

## Phase 6A2 graphical editor

`web/wiring-copy.ts` is a typed EN/MN catalog using the shared current language.
Controls, accessible names, completion states, conflicts and diagnostic categories
translate on rendering; expandable model details retain the established English
convention. Exact IDs, p/n roles, coordinates, SI values and native JSON do not
translate. Names/property text remain intact across language changes.

| English | Mongolian | Meaning |
| --- | --- | --- |
| Graphical | Зургаар | Third independent editing context |
| Junction | Уулзвар | Explicit connected graph vertex, not a visual crossing |
| Net name | Зангилааны нэр | Electrical connected-component identity |
| Set reference | Лавлах зангилаа болгох | Explicit reassignment of node 0 |
| Intentionally open | Зориуд задгай | Deliberate open terminal, distinct from pending |
| Pending | Дуусаагүй | Construction requires completion |
| Surviving net name | Үлдэх зангилааны нэр | Explicit naming choice when nets merge |
| Restore uncommitted text | Батлаагүй текстийг сэргээх | Discard only Graphical text edits |

Current Chrome evidence covers English/Mongolian desktop and 390/320 CSS pixels,
local canvas scrolling, visible focus and retained invalid property text. This is
not a translation review of the existing historical technical details.

## Phase 6A3b portable projects (published)

`web/project-copy.ts` translates Save project (**Төслийг хадгалах**), Open project
(**Төсөл нээх**), export initiation, independent applied/export checkpoints,
incomplete drafts, replacement consent, stale operations, resource/format/scientific/
connectivity/anchor failures and nonfatal incomplete visual inspection. Codes and
retained diagnostics are translated on render; expandable details remain English.
`.cuf.json`, native keys and exact IDs remain invariant and HTML-escaped. The
provisional native-only fallback explicitly says the rejected drawing is not kept.

## Phase 6A3c2 layout terminology

`web/layout-copy.ts` holds the typed English/Mongolian layout catalog. Rendering
translates status identifiers at display time and escapes exact native IDs.
“Suggest layout” / “Байрлал санал болгох” and “Use suggested layout” /
“Санал болгосон байрлалыг хэрэглэх” describe geometry, not electrical Apply.
Ordered “layout ports” / “зургийн портын туйлууд” do not redefine ground.
“Recognized and verified” separates structural recognition and bounded geometry
checks from synthesis certification. Independent drawing, missing/invalid port,
unsupported template, rejected geometry, incomplete draft and stale preview have
distinct messages. EN/MN desktop, 390 and 320 px were exercised in Chrome; retained
proposals survive language switching. Raw SI labels and very small fitted bridge
labels remain renderer limitations, not translated engineering-unit formatting.
