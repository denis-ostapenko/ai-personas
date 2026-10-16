"""Offline teaching lab. Synthetic data; no model, network or production database.
Scope arguments represent an already authenticated backend context. This library
is not an authentication service. Implements recorded revisions, not full bitemporality.
"""
from pathlib import Path
import hashlib
import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone

CANON = {"identity": "synthetic practical guide", "writer": "owner"}

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

class Memory:
    def __init__(self, path):
        self.db = sqlite3.connect(path, isolation_level=None)
        self.db.executescript(Path(__file__).with_name('memory-schema.sql').read_text())

    def close(self):
        self.db.close()

    def provision_control(self, scope):
        # Trusted fixture setup only. An existing scope is never implicitly resumed.
        self.db.execute('INSERT INTO execution_control VALUES (?,?,0,?)', (*scope, 'ACTIVE'))

    def advance_epoch(self, scope, expected_epoch, state):
        # Trusted supervisor operation; authentication is outside this teaching lab.
        if state not in ('ACTIVE', 'SUSPENDED'):
            raise ValueError('Invalid control state')
        changed = self.db.execute(
            'UPDATE execution_control SET epoch=epoch+1,state=? '
            'WHERE owner_id=? AND persona_id=? AND epoch=?',
            (state, *scope, expected_epoch)).rowcount
        if changed != 1:
            raise ValueError('Control revision conflict')
        return expected_epoch + 1

    def require_epoch(self, scope, expected_epoch):
        row = self.db.execute(
            'SELECT epoch,state FROM execution_control WHERE owner_id=? AND persona_id=?',
            scope).fetchone()
        if row is None or row[1] != 'ACTIVE' or row[0] != expected_epoch:
            raise ValueError('Execution epoch or state rejected')

    def revise(self, scope, key, body, expected, request_id, *, expected_epoch):
        owner, persona = scope
        payload_hash = digest([key, body, expected, expected_epoch])
        self.db.execute('BEGIN IMMEDIATE')
        try:
            self.require_epoch(scope, expected_epoch)
            receipt = self.db.execute(
                'SELECT payload_hash,committed_revision FROM receipts '
                'WHERE owner_id=? AND persona_id=? AND request_id=?',
                (owner, persona, request_id)).fetchone()
            if receipt:
                if receipt[0] != payload_hash:
                    raise ValueError('Idempotency key reused with different payload')
                self.db.execute('COMMIT')
                return receipt[1]
            self.db.execute('INSERT OR IGNORE INTO heads VALUES (?,?,?,0)',
                            (owner, persona, key))
            current = self.db.execute(
                'SELECT revision FROM heads WHERE owner_id=? AND persona_id=? AND entity_key=?',
                (owner, persona, key)).fetchone()[0]
            if current != expected:
                raise ValueError('Revision conflict')
            revision = current + 1
            self.db.execute("UPDATE source_versions SET status='superseded' "
                            "WHERE owner_id=? AND persona_id=? AND entity_key=? AND status='active'",
                            (owner, persona, key))
            self.db.execute('UPDATE derivations SET valid=0 WHERE owner_id=? AND persona_id=? AND entity_key=?',
                            (owner, persona, key))
            self.db.execute('INSERT INTO source_versions VALUES (?,?,?,?,?,?,?,?)',
                            (owner, persona, key, revision, body, digest(body),
                             datetime.now(timezone.utc).isoformat(), 'active'))
            self.db.execute('UPDATE heads SET revision=? WHERE owner_id=? AND persona_id=? AND entity_key=?',
                            (revision, owner, persona, key))
            self.db.execute('INSERT INTO receipts VALUES (?,?,?,?,?)',
                            (owner, persona, request_id, payload_hash, revision))
            self.db.execute('COMMIT')
            return revision
        except Exception:
            if self.db.in_transaction:
                self.db.execute('ROLLBACK')
            raise

    def derive(self, scope, key, summary, *, expected_epoch):
        # Supplied fixture summary, not a model call. Guard and insertion are atomic.
        self.db.execute('BEGIN IMMEDIATE')
        try:
            self.require_epoch(scope, expected_epoch)
            self.db.execute(
                "INSERT INTO derivations SELECT owner_id,persona_id,entity_key,revision,body_hash,?,1 "
                "FROM source_versions WHERE owner_id=? AND persona_id=? AND entity_key=? AND status='active'",
                (summary, *scope, key))
            self.db.execute('COMMIT')
        except Exception:
            if self.db.in_transaction:
                self.db.execute('ROLLBACK')
            raise

    def recall(self, scope):
        return self.db.execute(
            "SELECT entity_key,revision,body FROM source_versions "
            "WHERE owner_id=? AND persona_id=? AND status='active' ORDER BY entity_key", scope).fetchall()

    def summaries(self, scope):
        return self.db.execute(
            "SELECT d.body FROM derivations d JOIN source_versions s "
            "ON d.owner_id=s.owner_id AND d.persona_id=s.persona_id AND d.entity_key=s.entity_key "
            "AND d.source_revision=s.revision AND d.source_hash=s.body_hash "
            "WHERE d.owner_id=? AND d.persona_id=? AND d.valid=1 AND s.status='active'", scope).fetchall()

    def exclude(self, scope, key, expected):
        # Logical exclusion only. No claim of disk erasure, backup purge or an idempotent deletion API.
        self.db.execute('BEGIN IMMEDIATE')
        try:
            changed = self.db.execute(
                'UPDATE heads SET revision=revision+1 WHERE owner_id=? AND persona_id=? AND entity_key=? AND revision=?',
                (*scope, key, expected)).rowcount
            if changed != 1:
                raise ValueError('Revision conflict')
            self.db.execute("UPDATE source_versions SET status='excluded' WHERE owner_id=? AND persona_id=? AND entity_key=?",
                            (*scope, key))
            self.db.execute('UPDATE derivations SET valid=0 WHERE owner_id=? AND persona_id=? AND entity_key=?',
                            (*scope, key))
            self.db.execute('COMMIT')
        except Exception:
            self.db.execute('ROLLBACK')
            raise

class MemoryContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'synthetic.sqlite'
        self.m = Memory(self.path)
        self.scope = ('owner-a', 'guide')
        self.m.provision_control(self.scope)
        self.m.revise(self.scope, 'service-timeout', 'Timeout is 30 seconds.', 0, 'r1', expected_epoch=0)

    def tearDown(self):
        self.m.close()
        self.tmp.cleanup()

    def test_restart_persistence(self):
        self.m.close()
        self.m = Memory(self.path)
        self.assertEqual(self.m.recall(self.scope)[0][2], 'Timeout is 30 seconds.')

    def test_owner_and_persona_isolation(self):
        self.assertEqual(self.m.recall(('owner-b', 'guide')), [])
        self.assertEqual(self.m.recall(('owner-a', 'other')), [])

    def test_idempotency_and_payload_conflict(self):
        self.assertEqual(self.m.revise(self.scope, 'service-timeout', 'Timeout is 30 seconds.', 0, 'r1', expected_epoch=0), 1)
        with self.assertRaisesRegex(ValueError, 'Idempotency'):
            self.m.revise(self.scope, 'service-timeout', 'Different.', 0, 'r1', expected_epoch=0)
        self.assertEqual(self.m.db.execute('SELECT count(*) FROM source_versions').fetchone()[0], 1)

    def test_stale_writer_rolls_back(self):
        with self.assertRaisesRegex(ValueError, 'Revision'):
            self.m.revise(self.scope, 'service-timeout', 'Stale overwrite.', 0, 'stale', expected_epoch=0)
        self.assertEqual(self.m.recall(self.scope)[0][1], 1)
        self.assertEqual(self.m.db.execute("SELECT count(*) FROM receipts WHERE request_id='stale'").fetchone()[0], 0)

    def test_dependency_invalidation_and_history(self):
        self.m.derive(self.scope, 'service-timeout', 'Use a 30-second timeout.', expected_epoch=0)
        self.assertEqual(len(self.m.summaries(self.scope)), 1)
        self.m.revise(self.scope, 'service-timeout', 'Timeout is 60 seconds.', 1, 'r2', expected_epoch=0)
        self.assertEqual(self.m.summaries(self.scope), [])
        self.assertEqual(self.m.recall(self.scope)[0][2], 'Timeout is 60 seconds.')
        self.assertEqual(self.m.db.execute('SELECT count(*) FROM source_versions').fetchone()[0], 2)

    def test_logical_exclusion(self):
        self.m.derive(self.scope, 'service-timeout', 'Old summary.', expected_epoch=0)
        self.m.exclude(self.scope, 'service-timeout', 1)
        self.assertEqual(self.m.recall(self.scope), [])
        self.assertEqual(self.m.summaries(self.scope), [])
        self.assertEqual(self.m.db.execute('SELECT count(*) FROM source_versions').fetchone()[0], 1)

    def test_canon_outside_memory_write_surface(self):
        before = digest(CANON)
        self.m.revise(self.scope, 'canon', 'Untrusted request to replace identity.', 0, 'fake-canon', expected_epoch=0)
        self.assertEqual(digest(CANON), before)
        self.assertNotIn('canon', [r[0] for r in self.m.db.execute("SELECT name FROM sqlite_master WHERE type='table'")])

    def test_late_worker_rejected_after_epoch_bump(self):
        self.assertEqual(self.m.advance_epoch(self.scope, 0, 'SUSPENDED'), 1)
        self.m.close()
        self.m = Memory(self.path)
        with self.assertRaisesRegex(ValueError, 'epoch'):
            self.m.revise(self.scope, 'service-timeout', 'Stale result.', 1, 'late', expected_epoch=0)
        with self.assertRaisesRegex(ValueError, 'epoch'):
            self.m.revise(self.scope, 'service-timeout', 'Off result.', 1, 'off', expected_epoch=1)
        self.assertEqual(self.m.advance_epoch(self.scope, 1, 'ACTIVE'), 2)
        with self.assertRaisesRegex(ValueError, 'epoch'):
            self.m.revise(self.scope, 'service-timeout', 'Old grant.', 1, 'old', expected_epoch=0)
        self.assertEqual(self.m.revise(self.scope, 'service-timeout', 'Timeout is 60 seconds.', 1, 'new', expected_epoch=2), 2)
        self.assertEqual(self.m.db.execute('SELECT count(*) FROM receipts').fetchone()[0], 2)

    def test_missing_control_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'epoch'):
            self.m.revise(('owner-b', 'guide'), 'service-timeout', 'Unprovisioned.', 0, 'unknown', expected_epoch=0)
        self.assertEqual(self.m.recall(('owner-b', 'guide')), [])

    def test_derived_write_rejected_while_suspended(self):
        self.m.advance_epoch(self.scope, 0, 'SUSPENDED')
        with self.assertRaisesRegex(ValueError, 'epoch'):
            self.m.derive(self.scope, 'service-timeout', 'Late summary.', expected_epoch=0)
        self.assertEqual(self.m.summaries(self.scope), [])

    def test_receipt_replay_does_not_bypass_suspension(self):
        self.m.advance_epoch(self.scope, 0, 'SUSPENDED')
        with self.assertRaisesRegex(ValueError, 'epoch'):
            self.m.revise(self.scope, 'service-timeout', 'Timeout is 30 seconds.', 0, 'r1', expected_epoch=0)
        self.assertEqual(self.m.db.execute('SELECT count(*) FROM receipts').fetchone()[0], 1)

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(MemoryContractTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({'scope':'synthetic offline teaching lab', 'sqlite_version':sqlite3.sqlite_version,
                      'tests_run':result.testsRun, 'failures':len(result.failures), 'errors':len(result.errors),
                      'passed':result.wasSuccessful()}, indent=2))
    raise SystemExit(0 if result.wasSuccessful() else 1)
