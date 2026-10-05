# BIS programme intelligence and reporting implementation

Repository: PDthePlug/PDthePlug-bis-behaviour-intelligence. Branch: implementation/programme-intelligence-reporting. Implements the architecture checkpoint in BIS_PROGRAMME_INTELLIGENCE_REPORTING_20261005.md.

## Behaviour

Facilitators receive cohort-scoped, named check-in suggestions from their existing authorised progress and observation counts, with a neutral group-position chart. Participant actions preserve navigation/history. No private responses are analysed.

Programme owners receive exact observations, comparison context, bounded interpretation, evidence basis/coverage, suggested actions and interpretation limits. The pure `buildProgrammeReport` model drives dashboard findings, programme decision prompts, chart values and exported PDF findings. It uses only existing authorised aggregate inputs. No AI, personality inference or inferred competency bands are introduced.

Universal Lab evidence counts never inherit legacy Habit/Decision/Money behavioural or organisational-learning calculations. Their coverage, programme activity, structured questions and explicitly shared task assessments can still generate findings. Existing assessment aggregates are now included in the staff snapshot using the request-scoped `bis_assessment_report` RPC. Its existing role, consent, current-sharing, version and sample protections remain authoritative.

PDFKit replaces the hand-written PDF command encoder and estimated character widths. Bundled DejaVu fonts preserve local-language names and brand symbols. Server asset tracing includes the fonts for both export routes. The asynchronous renderer is awaited by the authorised staff route and illustrative route. Reports contain a profile, executive findings, charts, detailed evidence explanations, responsible-team recommendations, recorded programme decisions/reviews and methodology. Illustrative status repeats on every page. Long tables repeat headers; unavailable information is not drawn as zero.

## Rule policy

All rules are version 1 under report model `bis-programme-report:1`. No presentation-based success thresholds remain in the narrative model. Existing privacy minimums are retained: at least 5 eligible participants (or the larger supplied minimum), and at least 3 contributing records/participants per small cell (or the larger supplied minimum). Missing, suppressed and zero values remain distinct. Hidden counts are never reconstructed by subtraction.

Experiment starts do not prove real-world opportunities. Learning activity is separate from attendance. Reached/completed counts do not certify understanding. Paired comparisons describe the same supplied self-report measure, not an acquired skill. Saved rubric totals describe reviewed tasks, not durable or newly acquired capability. Coverage is not improvement. A difference between predictions and observations is not a causal explanation. Support request/acknowledgement/resolution counts are separate from unique participants.

Free-text answers, private support messages, Companion content and sensitive personal evidence stay outside automatic group interpretation. Structured categorical and numeric summaries retain the published question's meaning; no classification or curriculum interpretation is invented.

## Verification

Executed report fixtures cover zero starters, missing/small/suppressed populations and cells, paired self-report arithmetic, Universal-versus-legacy separation, authored assessment sample checks, exclusion of private text and facilitator action routing. PDF tests parse real documents with PDF.js, compare every canonical finding field, verify Unicode, check glyph bounds/page geometry, pagination and illustrative labelling. Browser cases exercise the actual staff components and production PDF handler at 360px, 430px and 1280px, including accessible tables, privacy boundaries and Back navigation.

Two existing SQL history tests depended on the runner's default timezone for date-only fixtures. Their database is now explicitly UTC; application SQL and production data were not changed.

Release verification results and deployment status are recorded in PR #119. The build uses isolated CI backend values; browser tests use controlled fixtures, not production participant records. The reporting preview reuses the established BIS staging backend with production access disabled. No database migration or production mutation is included.

## Remaining evidence boundaries

Attendance/held-session totals are not yet included in the aggregate reporting payload and are identified as unavailable rather than inferred from page activity. Criterion-level longitudinal capability development, Universal behavioural measure adapters and approved free-text categorisation remain later work. Current rubric averages cannot legitimately support inferred capability tiers or skills-gained claims. This release improves reporting of evidence BIS already supplies; it does not claim to finish those measurement contracts.
