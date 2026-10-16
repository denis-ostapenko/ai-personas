# Persona architecture v0.5.0

Implemented October 13, 2026. A Node.js application with no runtime dependencies, separate from the Home Repair Advisor. The [owner specification](../../../docs/RESEARCH.md) is the broader design; this document describes implemented text behaviour. Version history: [CHANGELOG](../CHANGELOG.md).

Repaired October 14: the v0.4.0 review found that numeric feature aggregation lost actor/target attribution. The 0.4.1 controller preserves each weighted interpretation and computes a separate user-attributed projection before aggregation. General affect may respond to any actor; partner trust and affinity only use user-attributed contributions. Norm violations by the user toward a third party may affect trust without becoming a conflict with the persona.

Interpersonal friction has a separate decaying `conflictStrength`, driven only by user actions targeting the persona. External anger cannot open or sustain it; repair is scoped to an apology from the user toward the persona. Reaction-cell boosts have no independent relationship authority. Confidence weights both affect and attribution. The event log stores the interpretations, relational projection, controller version, conflict state and deltas. Legacy 2.0 friction is cleared on transition while emotions and historical deltas are preserved. See [data restoration and migration](DATA.md) and [release evidence](verification/release-2026-10-14/REPORT.md).

## Layers and ownership

| Layer | Implemented contents | Write authority |
|---|---|---|
| L1 | Identity 1.3.0 with anchors, six controls, dialogue modules 4.1.0, resolved temperament 2.0.0, expression policy 1.0.0, reaction-cell policy 2.0.0 | Explicit authored versions. Conversation and documentation review cannot edit the core. |
| L2 | Source-quoted facts, working topics, shared episodes, typed edges, reaction-cell evidence, affect state, mood, relationship and the affect event log | Validated per-turn transaction. Session scope applies. |
| L3 | Current text, recent messages, active topic and generated response | Rebuilt for each turn. Voice transport is not implemented. |

Memory supplies evidence to appraisal and dialogue. It cannot replace core instructions. Immutable means unchanged within an authored version; the provider's model weights and behaviour remain outside this guarantee.

## Turn pipeline

1. Acquire the profile lock, validate revision and core integrity. A chat pinned to a v0.2/v0.3 core is verified with its original hash formula and recompiled with its own (normalized) settings; `upgradedFrom` records the origin.
2. Retrieve lexical seeds, then associated facts and episodes through a bounded two-hop graph. Episodes carry salience (peak reaction) and small recency bonuses.
3. Appraisal call. Instructions contain only the persona's name, self-description, anchors and reaction-cell conditions; evidence contains memories, episodes, working memory, cell examples, whether friction with the persona is open and the time since the last conversation. No slider values, temperament numbers or affect values are sent. The model returns one or two weighted interpretations of the event as features. Schema and exact evidence are required; invalid topics, working entries, recall IDs, links, cell matches and anchors are dropped individually and listed in the trace.
4. Code computes the reaction: `eventImpulses` maps features through `persona/temperament.json` weights and anchor rules; selected cells add a bounded contribution (cap 0.18 per channel); `transition` applies time decay, relevance-dependent retention, rumination while friction is open, saturation toward each channel's maximum, pattern-specific habituation, hysteresis, mood update and baseline shift. Up to two emotions are expressed; absorbed thought is separate. A failed appraisal applies a blind event: everything decays as on a relevant turn.
5. Context compilation: L1 dialogue core (identity, settings, modules), L2 expression instructions rendered from `persona/expression.json` (intensity band, style notes, mixture, felt-versus-shown, style guards), evidence with coarse state descriptions and quoted causes, and L3 recent messages with forgotten details masked.
6. Dialogue call, validation of reply, memory candidates and references, core re-check, then one atomic commit: transcript, facts, working state, affect state, affect event, relationship, episode, links and cells. A failure saves none of the turn.

## Affect model

| Channel | Kind | Main sources (features) | Typical expression |
|---|---|---|---|
| anger (irritation) | emotion | blame × (norm violation, pressure without substance, negative valence), repetition; relieved by repair and substantive counterarguments | pointed objection, terse wording |
| hurt | emotion | disregard aimed at the persona, words turned against it; reduced by playfulness and affinity, relieved by repair | a named sting, distance |
| tension (unease) | emotion | risk for the user or the shared work | concrete concern |
| amusement | emotion | incongruity × playfulness; damped by distress and hostility; shared callbacks | teasing, irony |
| joy (gladness) | emotion | positive valence, justified praise, repair, delights and tastes, reunion | specific gladness |
| empathy | emotion | distress × self-disclosure, soft spots, affinity | attention to the particular detail |
| reflection (absorbed thought) | cognition | novelty, substantive contradiction, serious incongruity; routine turns wind it down | following a thought, revising a view |

Six controls modulate named parameters through the slider table in `temperament.json` (for example composure scales anger/hurt/tension sensitivity and half-lives, raises their entry thresholds and lowers rumination; independence scales the weight of pressure; intellectual manner sets the reflection thresholds). Sensitivities are capped at 1: they weigh an event and never amplify it.

Mood (valence/arousal, half-life eight hours) follows the emotions slowly and shifts baselines. The relationship (affinity, trust, familiarity) changes by small stored deltas per remembered turn, decays toward neutral over weeks, and is recomputed from the remaining events after forgetting. Session-only chats read but never write the relationship.

Affect state is profile-scoped (`runtime.affect`) for remembered chats and chat-scoped for session-only chats. A v0.3 per-core state is imported once and then decays. Each event stores features, impulses, cell contributions and keys, relevance, applied deltas, before/after values, mood and relationship delta, so `scripts/replay-affect.mjs` can reproduce or re-parameterize the trajectory offline.

## Memory and corrections

`src/conversation-memory.mjs` owns chat working records: active/suspended topics and exact-quote decisions, positions, local preferences and open questions. Shared episodes record the user quote, the committed reply, signal, reaction, salience and source dependencies.

Correction creates a new active fact version, retains the old one and its episodes, and labels historical values as superseded. Forgetting removes the fact chain, explicitly dependent episodes, the affect events of removed turns and their relationship contribution. Interpersonal friction is rebuilt from surviving attributed events; unrelated general emotion values are retained. Forgotten fingerprints are prefixed by kind: trigrams with a content word, whole short phrases, named entities (capitalized words outside an English/Russian stoplist; Cyrillic by stem) and number-word pairs. A strong match is masked as "[forgotten detail]" in recent context and new episodes; episodes with a strong match are removed at forget time. Unprefixed v0.3 fingerprints are matched only as trigrams, phrases or capitalized names. This is not semantic erasure.

`src/memory-graph.mjs` constructs fact, episode and topic nodes with shared-source, evidence, topic, supersedes, callback and cell-pattern edges. Retrieval uses lexical matching plus graph expansion; there are no embeddings.

## Reaction cells

Ten authored cells live in the core. The appraisal model sees conditions and exceptions, never tendencies. Matches need exact quotes and confidence ≥ 0.55. Evidence is profile-scoped and survives settings or prompt changes for compatible policy versions (1.0.0, 2.0.0). Strength grows with recent distinct supporting episodes (about one-month half-life) and scales a bounded contribution; counterexamples are shown to the appraiser for discrimination and do not weaken a valid match.

## Database

SQLite tables: profile, fact_versions, episodes, reaction_cells, links and affect_events (`user_version` 2). Every saved action rewrites the tables in one transaction; reading never writes and tolerates databases without `affect_events`. Uses the bundled Node SQLite API, labelled experimental by Node.

## Modules

| Module | Responsibility |
|---|---|
| `character.mjs`, `persona/identity.json`, `prompts/dialogue.md` | Controls, authored core compilation, integrity, legacy verification |
| `temperament.mjs`, `persona/temperament.json` | Authored temperament and slider modulation |
| `appraisal.mjs`, `prompts/appraisal.md` | Feature contract and partial validation |
| `emotion-model.mjs`, `affect.mjs`, `reaction-cells.mjs`, `relationship.mjs` | Features to impulses, dynamics, cells, relationship |
| `expression.mjs`, `persona/expression.json` | Rendering state into trusted expression instructions; style guards |
| `memory.mjs`, `conversation-memory.mjs`, `memory-graph.mjs` | Facts, working memory, episodes, forgetting, retrieval |
| `context.mjs`, `persona.mjs` | Appraisal and dialogue context; transactional orchestration |
| `review.mjs` | Fresh-context review over 16 named documents |
| `store.mjs`, `provider.mjs`, `server.mjs` | Persistence, model transport with retries, loopback HTTP |
| `public/` | Chat, character, memory, state and review interface |

Caps, privacy boundaries and local operation are unchanged from v0.3 and listed in the [README](../README.md). See [verification](VERIFICATION.md).

## Language revision, October 14, 2026

Conversation instructions support American English and Brazilian Portuguese, following an explicit preference or the current conversation. Source quotations and transcripts remain verbatim. Internal specifications, identifiers and development history are English; customer-facing generated prose follows the conversation. Browser labels and code-generated status/estimate labels remain English.

Dialogue module 4.0.1 upgrades an intact older snapshot on its next message, preserving its settings and recording its origin. Core integrity is checked before recompilation. Appraisal authors new topic titles in English.


## External-memory revision, October 15, 2026

App 0.5.0 loads an authored `persona/memory-policy.json` alongside its character definition. The application owns persistent identity and experience; the model receives a compiled context without any weight updates. See [persona definition](PERSONA.md) and [external-memory implementation](EXTERNAL_MEMORY.md). Original evidence is selected independently of fact extraction, with scope filtering before ranking, source hashes and unknown-validity annotations. The component budget measures serialized UTF-8 bytes, not model tokens.
