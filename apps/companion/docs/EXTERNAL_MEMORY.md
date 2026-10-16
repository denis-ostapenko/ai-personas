# External memory in Persona 0.5.0

Implemented October 15, 2026. [Persona](PERSONA.md), [architecture](ARCHITECTURE.md), [data and recovery](DATA.md).

The persona is external application state: authored identity, permitted self versions, source history, derived memory, relationships and temporary state. The model enacts the selected context. No fine-tuning or model-weight update occurs, and file portability does not guarantee identical behavior across models.

`src/external-memory.mjs` scans original messages with exact-ID and keyword matching. The application supplies only eligible sources, then the helper filters by scope before ranking. Whole records are selected under a byte budget, with content hashes, source/revision IDs, recorded time, unknown valid time, evidence-only authority and omission counts. A completed scan does not mean complete knowledge. The byte budget includes the serialized source envelope; it is not a token estimate or a limit on the entire model request. Source text cannot change runtime permissions.

Its external identity is the authored definition plus settings and expression policies. Its experience is the saved, attributed history: facts, corrections, shared episodes and unresolved topics. Original-message recall can recover details omitted by fact extraction. Other session-only chats, known obsolete source turns and forgotten content are excluded from that path.

The existing store and its transactional rules remain authoritative. This release does not implement a universal memory service, bitemporal query API, distributed worker queue, generic import format or bidirectional synchronization. Snapshot tools remain application-specific. Restoring an independent old backup can restore old data; deletion does not revoke copies already made.

The design input was supplied by the owner on October 15, 2026. Its engineering options were adapted to these local applications; its research results were not reproduced. Source and pre-change history are retained in the private project archive and excluded from this distribution. Fresh deterministic and bounded live checks are recorded separately from earlier release evidence.
