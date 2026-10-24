# Handbook publishing review: table controls

Production preview of the replacement Habit handbook revealed that the paragraph checkbox importer intercepted complete Word tables. The behaviour baseline became one dropdown containing table separators and neighbouring row text. Experiment tracker and observation table choices were affected by the same ordering error. No replacement edition was published with this defect.

The shared handbook adapter now recognises tables before paragraph choices. The authored frequency matrix keeps all ten statements, the original five frequency options, and a separate private response per row. Tracker dates, blank entry cells and cell-specific checkbox options remain associated with their authored row and column. Merged Word tables retain their existing geometry. The original manuscripts and approved Career/Launch schedules are unchanged.

The same review found inline multiple-choice lines being collapsed into one option and printed response labels receiving an extra control before their writing line. Inline choices now remain separate, a label and its writing line share one response, and already-answered narrative examples do not create an extra learner question. A focused source regression checks those distinctions.

The baseline uses two associated columns (behaviour and frequency), keeping all five authored choices in each dropdown. This makes the complete control reachable at phone widths without horizontal scrolling. Browser assertions check its viewport bounds and wait for each specific response to reach the save handler before reloading; an earlier saved baseline must not accidentally satisfy the later free-text save assertion.

All 44 saved packages are regenerated through the shared compiler. Acceptance coverage checks the actual baseline options and per-row controls in every supplied edition, including experiment dates and observation choices. Responsive browser journeys now select, save and restore a baseline rating and capture the baseline layout before continuing through the existing navigation and free-text persistence checks.

The owner approved production sign-in, review and publication of all 44 editions. Initial production preparation created review versions, but publishing remains on hold until the corrected build passes verification and the updated source packages have been prepared and previewed through Content Studio. Existing learner evidence remains untouched.
