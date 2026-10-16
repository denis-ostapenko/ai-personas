// Teaching example. Syntax-checked only; no PostgreSQL integration was run.
// pool is an initialized node-postgres Pool using the restricted runtime role.
// trustedScope must be constructed by server authentication, not request JSON or an LLM.
// Do not expose arbitrary SQL or set_config through a model tool.
export async function recallRecent(pool, trustedScope, args = {}) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!trustedScope || !uuid.test(trustedScope.ownerId) || !uuid.test(trustedScope.personaId)) {
    throw new Error('Invalid authenticated scope');
  }
  if (Object.keys(args).some(key => key !== 'limit')) throw new Error('Unknown tool argument');
  const limit = args.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid limit');
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.owner_id',$1,true), set_config('app.persona_id',$2,true)",
      [trustedScope.ownerId, trustedScope.personaId]);
    await client.query("SET LOCAL statement_timeout = '1500ms'");
    const result = await client.query(
      `SELECT record_id, source_id, revision, recorded_at, body
       FROM persona_memory
       WHERE owner_id=$1::uuid AND persona_id=$2::uuid AND status='active'
       ORDER BY recorded_at DESC, record_id LIMIT $3`,
      [trustedScope.ownerId, trustedScope.personaId, limit]);
    await client.query('COMMIT');
    return {kind: 'attributed_evidence', records: result.rows};
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}
