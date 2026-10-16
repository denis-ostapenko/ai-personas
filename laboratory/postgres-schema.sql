-- Proposed PostgreSQL 18 sketch; not executed in this revision.
-- Migrations run as a separate owner. memory_runtime must be a restricted
-- non-owner login without SUPERUSER or BYPASSRLS; deployment provisions it.
CREATE TABLE persona_memory (
  record_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  body text NOT NULL,
  source_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  recorded_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active','superseded','excluded'))
);
CREATE INDEX persona_memory_scope ON persona_memory(owner_id,persona_id,status);
ALTER TABLE persona_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_memory FORCE ROW LEVEL SECURITY;
CREATE POLICY scoped_read ON persona_memory FOR SELECT TO memory_runtime
  USING (owner_id = nullif(current_setting('app.owner_id', true),'')::uuid
     AND persona_id = nullif(current_setting('app.persona_id', true),'')::uuid);
GRANT SELECT ON persona_memory TO memory_runtime;
-- No write grant or write policy is supplied. Add a separately designed write gateway.
