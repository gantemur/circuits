# Interface terminology and data conventions

Phase 1A supports English (`en`) and Mongolian Cyrillic (`mn`). New user-facing features should add both translations to the typed catalog in `web/i18n.ts`, keep interpolation placeholders aligned, and use stable diagnostic codes rather than parsing English messages. Technical wording here is a reviewable working glossary.

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

Component IDs, node IDs, user-provided labels, device codes, equations, and SI symbols remain unchanged in both languages. Native JSON uses the version-1 English field names and finite JSON numbers. Frequency and transient CSV headers, statuses, decimal points, and numerical values are likewise locale-neutral so exports round-trip and compare identically across languages. The interface translates labels and diagnostic summaries; expandable **Technical details (English)** retains original kernel messages where useful.

An explicit language choice is stored under `circuits-unfolded-language` in browser localStorage. If storage is unavailable, the in-memory choice still works for the current visit. Without a saved choice, the first browser-preferred language selects Mongolian when its tag is `mn` or `mn-*`; English is the fallback.
