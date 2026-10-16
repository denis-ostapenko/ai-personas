# Language and license revision: October 14, 2026

## October 15, 2026: external-memory revision

Persona 0.5.0 and Home Repair Advisor 0.4.0 add original-message retrieval and authored external-memory policies. The new deterministic checks cover omitted source details, scope filtering, exact IDs, whole-message UTF-8 budgets, duplicate source IDs, evidence-only handling of quoted commands, Persona correction/forgetting and case/job boundaries. New tests bring the suites to 103 Persona and 51 Advisor checks.

A separate bounded synthetic live smoke check covers English and Brazilian Portuguese recall of original-source facts and a Sunday exception. Advisor passed both language checks in the first run. Persona initially failed because original-source citations were not admitted by the reference validator; the failure was preserved, the validator and forgetting dependency handling were repaired, and a four-call retry passed both languages with the core unchanged. The combined three-app run and repair used 12 calls, including two Mara calls. Do not treat earlier live evidence below as a test of this revision. No contractor search, paid booking or publication is part of the smoke test.

## October 14, 2026: preserved prior evidence


Persona 0.4.2 and Home Repair Advisor 0.3.2 introduce bilingual conversation instructions and MIT licensing. Offline checks cover integrity-preserving upgrade of a pinned Persona chat, retained settings, rejection of damaged cores, migration of the exact previous Advisor identity and preservation of Portuguese source quotations. The clean-copy suite contains 94 Persona and 42 Advisor checks. It also checks syntax, links, file provenance and environment-only startup.

No additional live API run was made for this revision. The reports below document 0.4.1 and 0.3.1; they do not measure the revised prompts' bilingual fluency. Prompt instructions specify language behavior, while original source quotations remain verbatim.

# Previous release evidence: October 14, 2026

Recorded source: Persona 0.4.1 and Home Repair Advisor 0.3.1. Node 24.11.1 on Apple Silicon macOS. Synthetic temporary profiles/cases only; owner data was not used or rewritten.

## Offline checks

Persona: 93 tests, including all 75 previous regressions, 16 attribution/forgetting contrasts and two complete snapshot/restore checks. Advisor: 41 tests, including all 40 previous regressions and a complete case snapshot/restore check. All pass. Coverage includes corrections, forgetting, session isolation, source evidence, rollback, malformed output, concurrent actions, core integrity, exact restoration and refusal to overwrite existing data.

The attribution contrasts distinguish reporting, admitting, quoting, being the victim, supporting a victim, mixed actors, user pressure, external and personal apology, cell-only boosts, legacy friction and zero confidence. Stored trust deltas remain historical; tests do not pretend to retroactively repair old profiles.

A fresh temporary copy passed all 134 tests, package syntax/JSON/link/manifest scans and both environment-only HTTP startup checks without API credentials. The preparation record also verifies repeatable export. These checks are separate from API behavior.

## Persona live run

Thirteen synthetic turns completed with 26 attempted model calls, under a preregistered limit of 28 and no retries. All appraisals validated and the runtime source hashes remained unchanged throughout. Reporting third-party wrongdoing, quoting pressure and supporting a victim incurred no partner trust penalty or interpersonal friction. Admitting one's own wrongdoing lowered trust. Direct pressure opened friction; an outsider's apology did not count as partner repair, while the user's targeted apology closed the conflict. Routine arithmetic, correction, recall after runtime reconstruction and selected forgetting passed.

Median end-to-end turn latency: 12.238 seconds; range 6.438-19.114 seconds. Total reported usage across both calls per turn: 88,037 tokens. These are observed run values, not a billing forecast or a production latency percentile.

The mixed-actor scene was compressed by the model into one `agency=user`, `target=situation` interpretation. The reply distinguished the actions and trust fell, but no targeted conflict opened. The runtime preserves separate interpretations when supplied; natural-language decomposition remains imperfect. This is a specific remaining limitation, not an assertion that all actor-rich messages are solved. The criteria above do not establish psychological validity, long-term identity fidelity or cross-model portability.

## Advisor live run

One photo-backed synthetic door case, one correction and a live local search completed. Attempts: 6 model, 7 Tavily search/extract, 1 ZIP; registered ceilings: 8/8/2. The licensed public photo remained attached after correction, the bottom-rubbing detail entered quoted memory, source grounding passed and the stored case survived reconstruction. Temporary cases were removed.

The run returned 4 supported provider cards from 16 source records. The planning estimate was USD 70-330 under recorded labor/material assumptions. It is not a confirmed invoice or a present offer. A partial full-review-page warning was retained. Availability and exact ZIP coverage remained unconfirmed. Google Places was not called; the old IP-blocked result is historical only.

## Post-live regression repair

After the live run, a focused forgetting check found that removing the source of interpersonal friction could leave its numeric strength behind. The final source rebuilds friction from surviving attributed events and preserves unrelated general emotions. A new deterministic regression passes. This patch and extraction of the unchanged friction formula happened after the recorded live run: the raw run's source hashes describe that earlier release candidate, not every final file. No additional paid run is claimed for this isolated forgetting repair.

## Evidence and reproducibility

Each app includes its bounded `scripts/release-live.mjs`, raw synthetic release report and runtime source hashes where recorded. Reports are written before requests and refuse overwrite on a rerun. Use a fresh PERSONA_RELEASE_OUTPUT directory. No new subscription, purchase, key restriction change, contractor communication, remote repository or deployment occurred.

Historical 0.4.0 Persona (14 turns), 0.3.0 Persona (51 exchanges), 0.2.0 Persona (43 exchanges) and Advisor 0.3.0 memory checks (17 accepted turns) are not fresh release tests. Their development significance is summarized in the repository history; originals remain in the research workspace.
