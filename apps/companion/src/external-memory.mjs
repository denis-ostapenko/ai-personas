// Canonical implementation, copied byte-for-byte into each standalone app.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const digest = text => createHash('sha256').update(text).digest('hex');
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const terms = text => new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) || []);
const stop = new Set('the a an and or to of in is it for my me you your what where when how do does this that de da do dos das e o a os as um uma em para meu minha que qual como'.split(' '));

export function loadMemoryPolicy(url) {
  const text = readFileSync(url, 'utf8'), policy = JSON.parse(text);
  if (policy.schema !== 1 || !Array.isArray(policy.rules) || !policy.rules.every(x => typeof x === 'string')) throw new Error('Invalid authored memory policy.');
  return { policy, hash: digest(text), instructions: `EXTERNAL PERSONA AND MEMORY POLICY ${policy.version}\n${policy.rules.join('\n')}` };
}

// The caller supplies records from an already authorized store. Scope labels
// cannot authenticate users. Whole original messages are selected, never sliced.
export function sourceContext({ scope, query = '', sources, limit = 6, maxBytes = 12000 }) {
  if (typeof scope !== 'string' || !scope || scope.length > 256 || typeof query !== 'string' || !Array.isArray(sources) || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(maxBytes) || maxBytes < 800) throw new Error('Invalid source retrieval request.');
  const seen = new Map(), eligible = [];
  for (const source of sources) {
    if (source.scope !== scope) continue;
    if (typeof source.id !== 'string' || !source.id || typeof source.text !== 'string' || !source.text) throw new Error('Invalid source record.');
    const record = { id: source.id, scope, text: source.text, sha256: digest(source.text), recordedAt: source.recordedAt || null,
      assertionKind: source.assertionKind || 'user_statement', validity: 'unknown', authority: 'evidence_only' };
    record.revisionId = `${record.id}@${record.sha256}`;
    if (seen.has(record.id)) {
      if (seen.get(record.id) !== JSON.stringify(record)) throw new Error('Conflicting source identity.');
      continue;
    }
    seen.set(record.id, JSON.stringify(record)); eligible.push(record);
  }
  const queryTerms = [...terms(query)].filter(t => !stop.has(t));
  const candidates = eligible.map((record, order) => {
    const words = terms(record.text), exact = query.trim() === record.id || query.trim() === record.revisionId;
    return { record, order, score: (exact ? 1000000 : 0) + queryTerms.filter(t => words.has(t)).length };
  }).filter(x => !query.trim() || x.score > 0).sort((a, b) => b.score - a.score || b.order - a.order);
  const result = { schema: 1, scope, records: [], manifest: {
    retrievalMode: 'exact-lexical-source-scan', status: 'complete', eligibleCount: eligible.length, matchedCount: candidates.length,
    omittedCount: candidates.length, readiness: { source: 'ready', lexical: 'ready', dense: 'not_used' },
    budget: { unit: 'serialized_utf8_bytes', maximum: maxBytes, used: 0, tokenCount: null },
    coverage: 'Selected historical statements only. No match is not proof of absence. Recorded time is not valid time.'
  } };
  function measure() {
    result.manifest.omittedCount = candidates.length - result.records.length;
    result.manifest.status = result.manifest.omittedCount ? 'partial' : 'complete';
    let size = bytes(result);
    while (size !== result.manifest.budget.used) { result.manifest.budget.used = size; size = bytes(result); }
    return size;
  }
  if (measure() > maxBytes) throw new Error('Source context metadata exceeds its budget.');
  for (const { record } of candidates) {
    if (result.records.length >= limit) break;
    result.records.push(record);
    if (measure() > maxBytes) { result.records.pop(); measure(); }
  }
  measure(); return result;
}
