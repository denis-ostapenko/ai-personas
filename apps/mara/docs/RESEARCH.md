# Memory design references

Primary sources checked October 14, 2026. The project library was searched first, including its saved A-MEM v11 and LongMemEval material. The links below identify the external source versions; papers and model weights are not redistributed.

| Source | Relevant contribution | Relationship to Mara |
| --- | --- | --- |
| [A-MEM: Agentic Memory for LLM Agents, v11, October 8, 2025](https://arxiv.org/abs/2502.12110v11) | Contextual notes, semantic links and updates to existing memory representations as new memories arrive. | Supports keeping organized, derived representations over original episodes. Mara uses fixed themes and citations, not A-MEM's dynamic graph. |
| [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory, v2, March 4, 2025](https://arxiv.org/abs/2410.10813v2) | Separates indexing, retrieval and reading; evaluates extraction, multi-session reasoning, time, updates and abstention. | Motivates testing retrieval beyond a single remembered fact. Mara's current small checks do not constitute a LongMemEval score. |
| [Hindsight: Structured Agent Memory that Retains, Recalls, and Reflects, ACL 2026](https://aclanthology.org/2026.acl-demo.27/) | Separates ingestion, retrieval and reasoning; combines semantic, keyword, graph and temporal retrieval. | Mara likewise separates source retention, context selection and derived summaries. Its implemented search combines keyword and optional local semantic signals; graph traversal and temporal filtering are future work. |
| [Hindsight Memory-PRM: Supervising Memory Management with Auditable Hindsight Credit, August 30, 2026](https://arxiv.org/abs/2608.29605) | Proposes auditing memory-operation utility through version chains and controlled interventions. | A recent preprint and evaluation direction, not an installed component or a verified improvement in Mara. It motivates testing whether a remembered item actually changes an answer. |

## Engineering choice

Mara keeps original attributed episodes, an eight-turn working window, source-linked segment summaries, conversation overviews, and cross-conversation themes. Context includes summaries of the last two earlier conversations plus ranked relevant memories. Search combines rarity-weighted keyword matches, optional multilingual embeddings, recency and a redundancy penalty. The UI collapses results with identical source sets; the retrieval record preserves the underlying levels.

Summaries are generated after a segment grows, when starting a new conversation, or during an explicit organization pass. While the app is running, a due housekeeping pass runs no more often than every six hours. Derived records can be rebuilt; original sources and unresolved contradictions remain available. This schedule and these limits are project decisions, not numbers established by the cited papers.

The hierarchy is deliberately inspectable. A summary is a retrieval aid, never a new learning observation. Habits and beliefs live in a separate controller with prospective predictions and outcome receipts. This distinction makes it possible to compare changed rules with unchanged episodic memory.

## Next evaluation

Before adopting a larger memory stack, compare keyword-only, hybrid, summary-only and source-expanded retrieval on a new set of conversations. Include dated corrections, near-duplicate facts, multiple partners, conflicting reports, cross-session questions and questions with no supported answer. Record source recall, answer support, update accuracy, retrieval latency and model-call cost. Use controlled removal of retrieved sources to separate genuine memory use from plausible guessing.

No hosted memory service is required by this release. Adopting a vendor's benchmark result as Mara's result, or replacing the current archive with an opaque summary, would not answer those evaluation questions.
