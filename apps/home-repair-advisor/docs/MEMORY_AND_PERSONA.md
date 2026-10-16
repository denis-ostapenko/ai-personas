# Case memory and authored-persona continuity

Implemented October 12, 2026. App 0.3.0; prompts 1.2.0; authored identity remains 1.0.0; memory schema 1. Owner-authorized improvement to the repair consultant. [Architecture](ARCHITECTURE.md), [verification](VERIFICATION.md).

## Applied research, bounded to this product

The [October 12 review](../../../docs/RESEARCH.md) motivated separating stable identity from situational information (SPIN), typed memory with provenance (ALTK-Evolve), and testing actions as well as conversational style (AgentPersonaBench). PersMem motivated an explicit retention policy, but factual repair evidence is not filtered by simulated emotion or personality. MASC motivated checking candidate state before committing it. These are our engineering adaptations, not replications of those papers or implementations of their full methods.

No artificial emotional state, autonomous personality editing, training or new framework was added. The existing calm, direct, patient, budget-conscious character remains the authored reference.

## What changed

Previously the next assessment received the latest 16 transcript messages and the previous model-generated assessment. An early customer fact could fall outside the window, while an assumption in an earlier assessment could be repeated as if established.

Each turn now has two bounded model steps:

1. A memory writer receives the active facts, server location and current customer statement. It proposes typed changes with exact customer quotations. It never receives assistant assessments, website content or photos. Only legacy migration receives all earlier customer turns.
2. The server validates every reference and quote, applies the patch to an in-memory candidate, then assesses the job using active facts, up to 16 recent transcript messages and current photos. The prior assessment is excluded. Only after successful assessment are the new memory, dialogue, revision and assessment saved atomically.

Kinds cover job, quantity, dimension, site, condition, materials, budget, timing and preference. A fact contains a stable attribute key and a verbatim source quote with turn number. No paraphrased model summary is promoted to factual memory. Facts are customer assertions, not independently verified observations. A separate local change journal preserves superseded versions and retractions; it is excluded from assessment context and browser responses. The full case transcript remains available locally.

Unmentioned facts persist. A correction updates the same attribute; a withdrawal removes it with a quoted reason. Duplicate keys, nonexistent removals, invalid or stale citations, unknown versions and unsupported quotes reject the update. A correction cannot leave an overlapping obsolete quote active in another attribute. That specific conflict permits one repair attempt with the conflicting keys; a second failure leaves the saved case unchanged. There are at most 24 changes per turn and 64 active facts. Normal writes must cite the latest customer turn. The 20-turn case limit remains in place.

## Job and identity boundaries

A clear replacement of the job advances a job epoch and discards prior active facts, old images and prior-job dialogue from assessment context. New photos attached to that replacement are retained. Revisions of the same job preserve relevant facts and images. Every successful follow-up invalidates the previous provider report and budget; the next search uses the current assessment and server-resolved ZIP.

The ZIP field is authoritative. A different ZIP in free text does not silently alter geography; the assessment asks for the field to be updated. Budget preferences cannot establish a price. Quoted instructions or requests for a new role cannot authorize persona changes, bookings or invented evidence.

The identity specification is supplied separately on every assessment. Its SHA-256 fingerprint is stored with the case and traces. A case with a different identity version or fingerprint cannot silently continue under a changed canon. Prompt changes are tracked separately, so a memory improvement can preserve the authored character. Existing cases without a ledger are migrated on their next update or explicit search, using only their original customer messages. Historical job replacements can discard potentially stale photos during migration; the customer can attach current photos again.

## Persistence and inspection

The existing owner-isolated local files, atomic rename, revision checks and per-case locks remain in use. A failed memory or assessment call leaves the saved case unchanged. Restarting the advisor reconstructs context from the case file without an external conversation ID. No shared customer profile or cross-case recall was introduced.

The assessment card includes **Details I am using for this job**, exposing active customer quotations and the current ZIP. Customers can inspect and correct those details through the normal message field.

## Verification and limitations

Run deterministic checks with `npm test`; opt-in live synthetic dialogues with `npm run eval:memory` after loading the existing account credentials through the approved local secret loader. The live evaluation uses real OpenAI memory and assessment calls, the public hinge fixture and temporary case storage. Location lookup and contractor searches are fixtures, so it tests search arguments rather than making a new provider-availability claim. It deletes its temporary cases on completion and saves a nonprivate report. Set `PERSONA_EVAL_SCENARIOS=photo,painting` to rerun only selected sequences and `PERSONA_EVAL_REPORT=custom-name.json` to preserve an earlier report; default scenarios are `tv,photo,painting`.

Exact-quote validation establishes textual provenance, not semantic truth or complete extraction. The model still interprets corrections, replacement intent and attribute identity. Ambiguous short answers such as "yes" can inform recent conversational context but are not promoted to durable facts without a self-contained statement. Photos remain hypotheses when a detail cannot actually be seen. The suite is a small functional regression set, not evidence of universal injection resistance, nationwide repair accuracy or long-term personality fidelity. Two model calls per normal assessment increase latency and token use; no background paid calls are scheduled.
