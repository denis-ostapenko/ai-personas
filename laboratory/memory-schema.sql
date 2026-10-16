PRAGMA foreign_keys = ON;
-- Control is provisioned by a trusted supervisor, never by a memory proposal.
CREATE TABLE IF NOT EXISTS execution_control (
  owner_id TEXT NOT NULL, persona_id TEXT NOT NULL,
  epoch INTEGER NOT NULL CHECK (epoch >= 0),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','SUSPENDED')),
  PRIMARY KEY (owner_id, persona_id)
);
CREATE TABLE IF NOT EXISTS heads (
  owner_id TEXT NOT NULL, persona_id TEXT NOT NULL, entity_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  PRIMARY KEY (owner_id, persona_id, entity_key)
);
CREATE TABLE IF NOT EXISTS source_versions (
  owner_id TEXT NOT NULL, persona_id TEXT NOT NULL, entity_key TEXT NOT NULL,
  revision INTEGER NOT NULL, body TEXT NOT NULL, body_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL, status TEXT NOT NULL
    CHECK (status IN ('active','superseded','excluded')),
  PRIMARY KEY (owner_id, persona_id, entity_key, revision),
  FOREIGN KEY (owner_id, persona_id, entity_key)
    REFERENCES heads(owner_id, persona_id, entity_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_source
  ON source_versions(owner_id, persona_id, entity_key) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS derivations (
  owner_id TEXT NOT NULL, persona_id TEXT NOT NULL, entity_key TEXT NOT NULL,
  source_revision INTEGER NOT NULL, source_hash TEXT NOT NULL,
  body TEXT NOT NULL, valid INTEGER NOT NULL CHECK (valid IN (0,1)),
  FOREIGN KEY (owner_id, persona_id, entity_key, source_revision)
    REFERENCES source_versions(owner_id, persona_id, entity_key, revision)
);
CREATE TABLE IF NOT EXISTS receipts (
  owner_id TEXT NOT NULL, persona_id TEXT NOT NULL, request_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL, committed_revision INTEGER NOT NULL,
  PRIMARY KEY (owner_id, persona_id, request_id)
);
