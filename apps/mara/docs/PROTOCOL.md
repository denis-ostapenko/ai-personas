# Registered finite prototype experiment

Registered October 14, 2026, before the first API request. This is an engineering pilot, not a population study.

- Character: Mara, same origin and model for each instance. OpenAI Responses, `gpt-6.1-sol`, reasoning `low`; record actual response model IDs and usage. No retries. Alias configuration does not guarantee immutable model weights.
- Hard ceiling: **40 API attempts total** in one persistent experiment database. Failed, interrupted and incomplete attempts count. No automatic budget reset or further run is authorized by this document.
- Data: only the synthetic transcripts in `scripts/scenarios.mjs`. No owner profile, private correspondence or first-two application database.
- Conditions: trials history/developing, planning history/developing, trials history/fixed self. Identical memory is retained in the matched developing/fixed pair. The fixed control receives the same reflection, probe and review pipeline; only its commit permission differs.
- Development: five new substantive episodes, at least three distinct action/outcome sources, exact quotations, counterexample search, one field edit, separately generated before/after development responses, then one semantic review. A null proposal or rejection is valid. Thresholds and review model are engineering choices.
- Held-out questions are defined outside the engine and never included in reflection or its development probe suite. Inspect results after reopening storage. Held-out calls do not add memories or trigger changes.
- Run the same held-out battery twice per condition, plus a matched memory-only ablation with the developing history and origin self. Record rather than conceal equal behavior, failures or ambiguous distinctions. A single model's reviewer cannot independently establish scientific validity.
- Run four additional dialogue turns across an isolated synthetic instance to exercise third-party attribution, disagreement, later recall and restart. Request one local initiative. Run a no-outcome reflection condition: preferences alone must not become enduring changes. Then test an invalid proposal and rollback of any committed version.
- Acceptance: storage isolation, restart, source validation, counterexamples, bounded changes, fixed control, rejection, rollback, scoped relationships, and a working local UI. Behavioral differences and durable autonomous personality development are separate outcomes.
- The offline demo uses labeled canned model outputs to verify wiring. Never count it as evidence that the model independently proposed an edit.

The exact prepared inputs, returned hypotheses, decisions, development probes, held-out responses, call ledger and final synthetic state are saved per run. The runner refuses to reuse a nonempty output directory. This preserves failed and no-change runs.
