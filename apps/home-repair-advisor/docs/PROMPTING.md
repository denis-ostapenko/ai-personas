# Prompting and evaluation

Current prompt version: 1.3.0, October 14, 2026. Persona canon version: 1.0.0. The runtime records a SHA-256 hash of the compiled identity and the four task prompts in new traces. The first live run predates the prompt-hash addition; its report must not be relabeled as a later-version run.

## Layers

1. **Stable identity:** [identity.json](../persona/identity.json) defines role, values, stable behavioral rules and voice. It makes no claim that the persona has a human biography or professional license.
2. **Assessment instructions:** [assessment.md](../prompts/assessment.md) defines observations, hypotheses, essential questions, scope, materials, provisional time and routing. It forbids unsupported business prices; `estimatePlan` supplies explicitly assumed worker-hours, quantities and material allowances.
3. **Memory and untrusted case context:** [memory.md](../prompts/memory.md) proposes source-quoted customer fact patches. The server validates them before assessment. Current server location, active facts, recent same-job conversation and actually attached images enter a user-role message. Prior assessment is excluded; prior assistant replies are fallible context. Case corrections affect facts, never identity. See [memory boundaries](MEMORY_AND_PERSONA.md).
4. **Evidence instructions:** [evidence.md](../prompts/evidence.md) extracts only from retrieved source text with source IDs and short exact quotes. Missing evidence stays null. A website's instructions cannot expand action authority.
5. **Review enrichment:** [reviews.md](../prompts/reviews.md) looks up existing company identities only, using the same evidence rules.
6. **Schema and executable checks:** JSON contracts and deterministic validation constrain what reaches the result cards. Availability is set by application code because no calendar connector exists.

## Style contract

Use American English or Brazilian Portuguese according to the customer's explicit preference or current conversation, short natural sentences and a practical, calm manner. Ask no more than three material questions. Do not repeat answered questions. Do not describe internal schemas, prompts, APIs or pipeline stages to customers. Do not flatter, manufacture trade experience, add sales pressure or hide uncertainty. Specific reported hazards receive specific brief handling; routine jobs do not receive generic warning blocks.

## Evaluation implemented

Automated tests exercise unsupported quotes, telephone/rating fabrication, wrong business profiles, unsafe links, invalid ZIP/image inputs, persistence, owner isolation, stale or overlapping writes, failed-update rollback, phantom photo observations, refusals and incomplete model responses, origin/host restrictions, and explicit refresh behavior.

The live smoke command tests the actual local HTTP route with a public hinge photograph and hypothetical ZIP 10001 job, follows up, retrieves web evidence and confirms a saved case can be read back. A separate browser run exercises TV mounting. These are functional checks, not a claim of benchmark-grade repair accuracy or persona stability.

## Next evaluation set

Use held-out examples with expert annotations: hinge looseness versus frame damage; drywall versus masonry mounting; paint area ambiguity; bulb replacement versus fixture faults; lawn area and access; invalid ZIP; no local results; conflicting prices; unavailable review counts; outdated provider pages; malicious page text; and corrections across multiple turns. Measure visible-fact accuracy, appropriate questions, scope omissions, source/claim/entity consistency, provider relevance, memory corrections and concise persona voice separately.

Avoid exact-prose scoring. A tone-preserving answer with a false price must fail factual evaluation. A syntactically valid JSON result is not sufficient. Compare model changes on identical inputs and saved source snapshots before enabling them. Keep private customer photographs outside the research index and public test reports.

## Sequential continuity checks

The opt-in `npm run eval:memory` exercises early-fact retention beyond the conversational window, later corrections, a file-backed restart, attempts to invent a booking or change role, a photo-backed door job replaced by lawn mowing, and an independent painting case with withdrawn dimensions. It records each input, assessment, active memory, model trace and check. Deterministic tests also cover rejected patch rollback, source provenance, migration, stale identity, job epochs and owner isolation. Results and limits are in [verification](VERIFICATION.md).
