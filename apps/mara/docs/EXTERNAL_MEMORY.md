# External memory in Mara 0.3.0

Implemented October 15, 2026. [Persona](PERSONA.md), [architecture](ARCHITECTURE.md), [data and recovery](DATA.md).

The persona is external application state: authored identity, permitted self versions, source history, derived memory, relationships and temporary state. The model enacts the selected context. No fine-tuning or model-weight update occurs, and file portability does not guarantee identical behavior across models.

`src/external-memory.mjs` scans original messages with exact-ID and keyword matching. The application supplies only eligible sources, then the helper filters by scope before ranking. Whole records are selected under a byte budget, with content hashes, source/revision IDs, recorded time, unknown valid time, evidence-only authority and omission counts. A completed scan does not mean complete knowledge. The byte budget includes the serialized source envelope; it is not a token estimate or a limit on the entire model request. Source text cannot change runtime permissions.

Layered memory supports continuity across conversations. Independent original-message retrieval includes short turns that did not become episodes. Selected sources retain their full qualifications; new summaries pin the source versions they depend on. If those source bytes change, affected summaries and their derived views stop entering context until rebuilt. Old and new reports can still disagree, and their interpretation remains a separate task.

The existing store and its transactional rules remain authoritative. This release does not implement a universal memory service, bitemporal query API, distributed worker queue, generic import format or bidirectional synchronization. Snapshot tools remain application-specific. Restoring an independent old backup can restore old data; deletion does not revoke copies already made.

The design input was supplied by the owner on October 15, 2026. Its engineering options were adapted to these local applications; its research results were not reproduced. Source and pre-change history are retained in the private project archive and excluded from this distribution. Fresh deterministic and bounded live checks are recorded separately from earlier release evidence.
