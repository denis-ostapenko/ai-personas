# PostgreSQL write protocol sketch

Revision 3.2. **Design only, not executed SQL and not an exported JavaScript write function.** The current postgres-gateway.mjs remains read-only and the schema supplies no write grant. This protocol uses the same synthetic timeout correction as the SQLite lab: source revision 1 says 30 seconds; a proposal at expected revision 1 changes it to 60 seconds.

## Proposed transaction boundary

A proposed `reviseMemory(pool, trustedScope, proposal)` receives owner/persona only from authenticated server context. An independently validated operation grant supplies execution epoch. The proposal contains a bounded source key, expected source revision, new body and idempotency key; it cannot choose SQL, connection settings or scope.

1. Validate structure and size before checking out one connection. Begin a transaction; set local owner/persona context and a bounded statement timeout. The runtime role has no owner, superuser or BYPASSRLS privileges.
2. Lock the independently provisioned control row for this scope. Require ACTIVE and the expected execution epoch. The supervisor's revoke/resume transaction uses the same control-row lock. Checking in application code before the transaction leaves a race.
3. Serialize source and request-key coordination in a documented lock order. Read the scoped request receipt. Return its stored result only if its canonical payload digest matches; a different payload under the same key fails. Permission is checked before replay.
4. Lock/create the scoped source head with a uniqueness-safe insert strategy. Compare the expected revision. A stale proposal aborts without a receipt. Under concurrent inserts, handle the uniqueness conflict and re-read under the transaction; never invent an unlocked initial head.
5. Supersede the active source, write revision 2, invalidate dependencies carrying revision 1 or its hash, and advance the head. Insert the scoped request receipt in the same transaction. Commit before returning success.
6. Roll back on any failure and discard an unusable connection. A retry reuses the same request ID and digest; a conflict needs a fresh read and a new proposal. Unknown commit outcome is resolved through the receipt, not a blind duplicate write.

## Required schema and authority before implementation

Separate scoped control, source-head, immutable source-version, dependency and receipt tables are required. Composite owner/persona keys and foreign keys must agree. SELECT plus INSERT/UPDATE policies need both USING and WITH CHECK where appropriate; grants must allow only the intended operations. The persona runtime cannot provision or alter controller grants. The control-row locking operation therefore needs a narrowly privileged trusted routine or equivalent supervisor-owned transaction service, rather than a generic UPDATE grant on the control table. Any privileged routine requires fixed schema resolution, no caller-selected SQL, restricted execution rights and an audited scope check. That authority design is a prerequisite, not supplied executable DDL. Application-set session scope still relies on a trusted gateway: RLS does not turn arbitrary SQL from an untrusted model into a safe interface.

## Required integration evidence

Run simultaneous writes at the same revision, same-key same/different-payload requests, cross-scope forgeries, missing control, revoke-versus-commit races, connection loss around COMMIT and corrected-source invalidation. Inspect durable rows and receipts after reconnect. Record PostgreSQL/driver versions and isolation level. No such PostgreSQL execution occurred in this review.

The small SQLite lab now demonstrates source/derived-write epoch checks. It does not prove complete output/tool shutdown, remote transaction behavior or backup reconciliation.
