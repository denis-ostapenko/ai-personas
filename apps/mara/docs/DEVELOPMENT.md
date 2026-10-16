# Development and verification

Verified October 14, 2026 for Mara 0.2.0. This record separates implementation checks from model behavior. Historical experiments used their own frozen sources and configurations; a later interface release does not rerun or retroactively validate those experiments.

## Development sequence

The first prototype implemented an immutable origin, a current self, attributed episodes, initiative, reflection, version history and rollback. Its reflection path proposed one textual self edit and checked citations, counterexamples, development probes and a model review. This path remains available to the older research harness. The ordinary application now uses prospective outcome learning instead.

The next revision separated memory from learning. Memory stores and retrieves conversation evidence. Learning creates provisional habits and beliefs, records a prediction before an action, and evaluates later reported outcomes. Repeated observations can change stored rules and the current self. Praise, summaries and the model's own reflections are not independent outcome evidence.

The habit-retirement revision introduced separate adoption, monitoring and recovery phases. Retirement requires five failures in six eligible attempts; recovery requires seven successes in eight eligible attempts. Both need at least three task families. These thresholds were retained during the 0.2 release review.

## Historical model observations

| Experiment | Observed result | Interpretation |
| --- | --- | --- |
| Longitudinal v1, 60 simulated actions | Original run committed no edits. A separately registered citation-contract repair accepted one habit revision. It changed 16/36 choices without memory, but only 3/36 with identical full memory, covering one stable item. Rollback restored the old choice. Total 155/180 calls. | A narrow persistent self contribution; the registered broad criterion of 9/36 changes across three stable items failed. The unsuccessful original run is retained. |
| Development v2, 76 actions and 288 held-out decisions | World A acquired a pilot-first habit: 27/27 applicable choices across three repetitions matched it without episodic memory. Forecast Brier improvement was 0.10884. World B formed no consolidated habit and its improvement, 0.05718, failed the 0.10 criterion. Total 121/180 calls. | A passed the registered habit and belief checks; B did not. The reversal phase exposed excessive inertia in the earlier retirement mechanism. |
| Habit retirement v3, 420 held-out choices and a 36-action free trajectory | An initial one-call setup failure was preserved. A separate corrected-context run used 79/99 calls without errors. Isolated/burst noise and alternating outcomes retained the habit. Sustained failures retired it; one lucky success did not restore it; sustained recovery did. | Controlled evidence for this retirement mechanism, with a frozen-habit comparison. It does not establish broad personality development. |

In v3, six applicable questions per repetition retained the habitual action at the adopted, noise, alternating and recovered checkpoints. At the retired and lucky-success checkpoints they used it zero times, while the frozen control used it six times. Four unrelated coordination questions continued to choose consultation. In the free trajectory, five consecutive failures after the environment changed retired the habit at step 17; steps 18-36 used the alternative action and all 19 succeeded. This is distinct from the controlled six-observation retirement sequence.

The v2 and corrected v3 records both report unchanged source hashes during their runs. No failed run was replaced or rescored into a success. Raw call ledgers, frozen sources and databases remain in the owner's local research archive and are excluded from the public source package. Archive identifiers are `longitudinal-2026-10-14-v1`, `development-v2-2026-10-14`, and `habit-retirement-v3-2026-10-14-context-repair`.

## Release review

The review covered transport, provider contracts, storage, memory, learning, rollback, operations and the browser workflow. It produced these changes:

- Replaced the inspector-first interface with Conversation, Memory and About Mara. Archived chats are readable; source messages open directly from memory. Settings holds profile and diagnostic controls.
- Removed repetitive disclaimers from ordinary dialogue instructions and interface copy. English and Brazilian Portuguese replies are supported; internal interpretations and summaries remain English, with original-language source quotes.
- Replaced phase numbers with transition identities for new trials. A delayed result cannot become recovery evidence after rollback and a different retirement. Rule IDs are not reused from retained history.
- Added portable model defaults for new profiles, optional local embedding setup, explicit request-limit management and consistent SQLite snapshots with validated restoration.
- Added MIT licensing, third-party notices, English/Brazilian Portuguese public guides and release material, and a source-only GitHub package.

### Offline checks

All 48 Node tests pass on Node 24.11.1. They cover attribution, evidence gates, fixed controls, prospective learning, habit noise/retirement/recovery, delayed results, rollback, memory scope and summaries, revisions, provider accounting, local HTTP protection, model defaults, and backup/restore integrity. Syntax, English-authored text and local Markdown link checks are also run on the release.

The UI was exercised at 1280 x 900, 576-pixel and 390 x 844 widths. The phone layout has no horizontal overflow. Existing archived chats, source dialogs, memory search, profile/partner selection and About Mara were inspected. Exact duplicate source sets are collapsed in displayed search results. A separate local fixture verified Enter-to-send, new conversation, reload and archived-message persistence, with no browser console errors. That fixture made no model calls.

### Live functional check

A separate fresh database registered a twelve-call ceiling and no retries. Five calls completed, with no errors. They exercised an English reply, a Brazilian Portuguese reply, a source-grounded English summary, retrieval of a shelf detail in a new conversation, partner separation, and an initiative. The replies were manually inspected for language. This short check verifies the release path; it is not another long-term habit experiment. The ordinary user database was not used for it.

## Reproduce

```sh
npm test
npm run check
```

The GitHub workflow runs only these offline commands. It supplies no model key. Action versions follow the current primary [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) documentation, checked October 14, 2026. CI itself has not run on GitHub because the repository has not been published.

With separately authorized API usage and a configured key, `node scripts/release-smoke.mjs data/new-review` runs the bounded functional check in a new directory. The v2 and v3 experiment runners and analyzers are included as research source. Run them from the repository root with a new output directory; inspect their registered protocol before spending API calls. Current source will create a new experiment, not reproduce immutable historical model weights. The v1 design and scorer are retained because offline tests depend on them; the older pilot is available through `npm run live` and its [registered protocol](PROTOCOL.md).

## Remaining work

Large archives still scan documents in memory and serialize a complete profile row. There is no indexed ANN store, full temporal query engine, source-level forgetting control or large-corpus retrieval benchmark. Summary provenance is checked, but a valid quote does not prove every inference in a summary. Belief confidence is an engineering estimate, and ordinary reported outcomes are not independently verified. Broader transfer requires a fresh corpus, matched-memory controls and repeated held-out measurements. See [research choices](RESEARCH.md) and the [roadmap](../ROADMAP.md).


## October 15, 2026: external-memory revision 0.3.0

Mara now loads an explicit external persona definition for new profiles and a separate authored memory policy. Existing stored origins, current selves and learning thresholds are preserved. Original-message retrieval covers unextracted short turns, filters partner scope before ranking and preserves full selected source qualifications. New summaries pin original-source hashes; stale summaries and their derived views are excluded and can be rebuilt. Source evidence and working turns are no longer duplicated inside the model's memory object.

All 57 offline checks and the clean-copy source/startup checks pass. In the separately registered three-app release smoke, Mara used two model calls for English and Brazilian Portuguese recall of an old source-only statement, its D-4 shelf and Sunday exception. Both replies retained the details; partner isolation and unchanged origin/current self were checked separately. The three-app effort used 12 calls including a preserved Persona validation failure and its four-call repair check. This is a narrow release smoke, not a new longitudinal development result. The original project archive retains protocol, code, outputs and failed run; private state and experiment transcripts are excluded from the source distribution.
