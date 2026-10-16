import { AppError } from './errors.mjs';
import { memorySchema, validate } from './schema.mjs';

export const memoryVersion = 1;
const invalid = () => new AppError(502, 'invalid_memory', 'I could not reliably save that update. Please try again; your previous job is still saved.');
export const customerTurns = item => item.messages.filter(m => m.role === 'user').map((m, i) => ({ id: i + 1, text: m.text }));
export const emptyMemory = () => ({ version: memoryVersion, jobEpoch: 1, startTurn: 1, facts: [], changes: [] });

// Only exact spans of customer messages enter durable facts. Assistant prose,
// image hypotheses and web excerpts have no write authority in this ledger.
export function applyMemory(previous, patch, turns, { migration = false } = {}) {
  try { validate(memorySchema, patch); } catch { throw invalid(); }
  const memory = structuredClone(previous || emptyMemory());
  if (memory.version !== memoryVersion || !turns.length) throw invalid();
  const current = turns.at(-1);
  const event = ref => {
    const source = turns.find(t => t.id === ref.turnId);
    if (!source || ref.turnId < memory.startTurn || (!migration && ref.turnId !== current.id) ||
        !ref.quote.trim() || ref.quote.length > 600 || !source.text.includes(ref.quote)) throw invalid();
  };
  if (patch.transition === 'replace_job') {
    if (!patch.transitionEvidence || (!migration && patch.transitionEvidence.turnId !== current.id)) throw invalid();
    event(patch.transitionEvidence);
    memory.changes.push({ action: 'replace_job', turnId: current.id, evidence: patch.transitionEvidence, previousFacts: memory.facts });
    memory.jobEpoch++;
    memory.startTurn = patch.transitionEvidence.turnId;
    memory.facts = [];
  } else if (patch.transitionEvidence !== null) throw invalid();
  if (patch.upserts.length + patch.removals.length > 24) throw invalid();
  const keys = new Set();
  const key = value => {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(value) || keys.has(value)) throw invalid();
    keys.add(value);
  };
  for (const change of patch.removals) {
    key(change.key); event(change.evidence);
    const index = memory.facts.findIndex(f => f.key === change.key);
    if (index < 0) throw invalid();
    const [previousFact] = memory.facts.splice(index, 1);
    memory.changes.push({ action: 'remove', turnId: current.id, previousFact, ...change });
  }
  for (const fact of patch.upserts) {
    key(fact.key); event(fact.evidence);
    const index = memory.facts.findIndex(f => f.key === fact.key);
    const previousFact = index >= 0 ? memory.facts[index] : null;
    const saved = { ...fact, updatedTurn: current.id };
    if (index >= 0) memory.facts[index] = saved; else memory.facts.push(saved);
    memory.changes.push({ action: 'set', turnId: current.id, previousFact, fact: saved });
  }
  // Broad older quotes sometimes duplicate a narrower attribute (for example,
  // "Mount my 55-inch TV" duplicates tv_size). Do not keep the obsolete span
  // active when the narrower fact is corrected or withdrawn.
  if (previous && patch.transition !== 'replace_job') {
    const conflicts = new Set();
    for (const change of [...patch.upserts, ...patch.removals]) {
      const old = previous.facts.find(f => f.key === change.key);
      if (!old || old.evidence.quote === change.evidence.quote) continue;
      for (const remaining of memory.facts) {
        if (!keys.has(remaining.key) && remaining.evidence.turnId === old.evidence.turnId && remaining.evidence.quote.includes(old.evidence.quote)) conflicts.add(remaining.key);
      }
    }
    if (conflicts.size) {
      const error = invalid(); error.conflictingKeys = [...conflicts]; throw error;
    }
  }
  if (memory.facts.length > 64) throw invalid();
  return memory;
}

export function memoryContext(memory) {
  return { version: memory.version, jobEpoch: memory.jobEpoch, startTurn: memory.startTurn,
    facts: memory.facts.map(({ key, kind, evidence }) => ({ key, kind, ...evidence })) };
}
