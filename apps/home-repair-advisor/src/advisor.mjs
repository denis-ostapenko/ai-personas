import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AppError } from './errors.mjs';
import { assessmentSchema, evidenceSchema, reviewEnrichmentSchema, memorySchema, validate } from './schema.mjs';
import { applyMemory, customerTurns, emptyMemory, memoryContext, memoryVersion } from './memory.mjs';
import { groundEvidence } from './evidence.mjs';
import { resolveZIP } from './providers/tavily.mjs';
import { groundRates, calculateEstimate } from './estimate.mjs';
import { loadMemoryPolicy, sourceContext } from './external-memory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const identityText = await readFile(path.join(root, 'persona/identity.json'), 'utf8');
export const identity = JSON.parse(identityText);
const assessmentPrompt = await readFile(path.join(root, 'prompts/assessment.md'), 'utf8');
const evidencePrompt = await readFile(path.join(root, 'prompts/evidence.md'), 'utf8');
const reviewPrompt = await readFile(path.join(root, 'prompts/reviews.md'), 'utf8');
const memoryPrompt = await readFile(path.join(root, 'prompts/memory.md'), 'utf8');
const memoryPolicy=loadMemoryPolicy(new URL('../persona/memory-policy.json',import.meta.url));
const personaInstructions=`${identityText}\n\n${memoryPolicy.instructions}`;
export const promptVersion = '1.4.0';
export const identityHash = createHash('sha256').update(identityText).digest('hex');
export const promptHash = createHash('sha256').update(personaInstructions + memoryPrompt + assessmentPrompt + evidencePrompt + reviewPrompt).digest('hex');

// Only these exact authored predecessors are eligible for this continuity update.
const priorIdentityHashes = new Set(['4c97a8ea7c783ae3b2106590410584dcb812d2df83ea894c3671347cb06d7259','4d3aa2f9b28615844a4692af8b8f657357638ac6a0c334c888236adf0b6877e6']);
function assertContinuity(item) {
  const current=item.personaVersion===identity.version&&(!item.identityHash||item.identityHash===identityHash);
  const knownPrevious=item.personaVersion==='1.0.0'&&priorIdentityHashes.has(item.identityHash);
  if (!current&&!knownPrevious) throw new AppError(409, 'persona_version', 'This case belongs to a different advisor version. Start a new case or use its original version.');
  if (item.memory && item.memory.version !== memoryVersion) throw new AppError(409, 'memory_version', 'This case uses a different memory version. Please use a compatible advisor.');
}

export function validateInput(input, { initial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'invalid_input', 'Provide a job description.');
  const message = String(input.message || '').trim();
  if (!message || message.length > 4000) throw new AppError(400, 'invalid_message', 'Describe the job in 1 to 4,000 characters.');
  const zip = String(input.zip || '');
  if ((initial || input.zip !== undefined) && !/^\d{5}$/.test(zip)) throw new AppError(400, 'invalid_zip', 'Enter a five-digit US ZIP code.');
  const images = input.images || [];
  if (!Array.isArray(images) || images.length > 3) throw new AppError(400, 'invalid_images', 'Attach up to three JPG, PNG or WebP images.');
  const checked = images.map(image => {
    if (typeof image !== 'string' || image.length > 3_000_000) throw new AppError(400, 'invalid_image', 'Each image must be smaller than 2 MB.');
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!match) throw new AppError(400, 'invalid_image', 'Use a JPG, PNG or WebP image.');
    const b = Buffer.from(match[2], 'base64');
    const valid = match[1] === 'png' ? b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? b[0] === 255 && b[1] === 216 && b[2] === 255 : b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP';
    if (!valid || b.length > 2_000_000 || b.length < 20) throw new AppError(400, 'invalid_image', 'The attached file is not a supported image.');
    return { id: randomUUID(), dataUrl: image };
  });
  return { message, zip: input.zip === undefined && !initial ? null : zip, images: checked };
}

export class Advisor {
  constructor({ provider, search, store, locate = resolveZIP, directory = null }) { this.provider = provider; this.search = search; this.store = store; this.locate = locate; this.directory = directory; }
  async assess(item, message, { newImages = null, replay = false } = {}) {
    assertContinuity(item);
    const turns = customerTurns(item);
    if (!replay) turns.push({ id: turns.length + 1, text: message });
    const traces = [];
    if (!replay || !item.memory) {
      const migration = !item.memory && item.messages.length > 0;
      const memoryInput = { migration, location: item.location, memory: memoryContext(item.memory || emptyMemory()),
        customerTurns: migration ? turns : [turns.at(-1)] };
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await this.provider.structured({ instructions: `${memoryPolicy.instructions}\n\n${memoryPrompt}`,
          input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(memoryInput) }] }], schema: memorySchema, name: 'case_memory' });
        traces.push({ ...result.trace, phase: 'memory', migrated: migration, attempt: attempt + 1 });
        try {
          item.memory = applyMemory(item.memory, result.data, turns, { migration });
          if (result.data.transition === 'replace_job') item.images = [];
          break;
        } catch (error) {
          if (attempt || !error.conflictingKeys) throw error;
          memoryInput.validationFeedback = { conflictingKeys: error.conflictingKeys, rejectedPatch: result.data };
        }
      }
    }
    if (newImages?.length) item.images = newImages;
    // Earlier assistant prose remains conversational context only. It cannot
    // supply enduring facts, an old job scope or authority to change identity.
    const history = item.messages.slice((item.memory.startTurn - 1) * 2).slice(-16);
    const context = { location: item.location, history, memory: memoryContext(item.memory), originalSources:caseSources(item,message), currentMessage: message,
      images: item.images.map(x => ({ id: x.id })), currentDate: new Date().toISOString().slice(0,10) };
    const content = [{ type: 'input_text', text: JSON.stringify(context) }, ...item.images.flatMap(x => [
      { type: 'input_text', text: `Attached image ID: ${x.id}` }, { type: 'input_image', image_url: x.dataUrl, detail: 'high' }
    ])];
    const { data, trace } = await this.provider.structured({ instructions: `${personaInstructions}\n\n${assessmentPrompt}`, input: [{ role: 'user', content }], schema: assessmentSchema, name: 'job_assessment' });
    validate(assessmentSchema, data);
    if (data.questions.length > 3) data.questions = data.questions.slice(0,3);
    const imageIds = new Set(item.images.map(x => x.id));
    data.observations = data.observations.filter(o => o.basis !== 'photo' || (o.imageIds.length > 0 && o.imageIds.every(id => imageIds.has(id))));
    if (['urgent', 'out_of_scope'].includes(data.status)) data.searchReady = false;
    data.searchTerms = data.searchTerms.replace(/[^a-zA-Z0-9 &'(),.-]/g,' ').slice(0,100);
    traces.push({ ...trace, phase: 'assessment',sourceRetrieval:{...context.originalSources.manifest,selected:context.originalSources.records.map(({id,revisionId,sha256})=>({id,revisionId,sha256}))} });
    item.identityHash = identityHash;
    item.personaVersion = identity.version;
    item.assessmentPromptVersion = promptVersion;
    return { assessment: data, traces: traces.map(t => ({ ...t, personaVersion: identity.version, identityHash, memoryVersion, promptVersion, promptHash, at: new Date().toISOString() })) };
  }
  async create(owner, input) {
    const { message, zip, images } = validateInput(input, { initial: true });
    const location = await this.locate(zip); const now = new Date().toISOString();
    const item = { id: randomUUID(), owner, revision: 1, createdAt: now, updatedAt: now, location, images, messages: [], assessment: null, report: null, traces: [], personaVersion: identity.version };
    const result = await this.assess(item, message, { newImages: images });
    Object.assign(item, { assessment: result.assessment, messages: [{ role:'user', text:message, at:now }, { role:'assistant', text:result.assessment.reply, at:new Date().toISOString() }], traces: result.traces });
    await this.store.save(item); return item;
  }
  async reply(id, owner, input) {
    return this.store.exclusive(id, async () => {
      const item = await this.store.get(id, owner);
      if (input.revision !== item.revision) throw new AppError(409, 'stale_case', 'This case changed. Reload it before sending another message.');
      const checked = validateInput(input);
      if (item.messages.length >= 40) throw new AppError(400, 'case_limit', 'Start a new case for additional work. This case has reached 20 turns.');
      if (checked.zip && checked.zip !== item.location.zip) item.location = await this.locate(checked.zip);
      const result = await this.assess(item, checked.message, { newImages: checked.images }); const now = new Date().toISOString();
      item.messages.push({ role:'user', text:checked.message, at:now }, { role:'assistant', text:result.assessment.reply, at:now });
      item.assessment = result.assessment; item.report = null; delete item.sourcePages;
      item.traces.push(...result.traces); item.updatedAt = now; item.revision++;
      await this.store.save(item); return item;
    });
  }
  async find(id, owner, revision, force = false) {
    return this.store.exclusive(id, async () => {
      const item = await this.store.get(id, owner);
      assertContinuity(item);
      if (revision !== item.revision) throw new AppError(409, 'stale_case', 'This case changed. Reload it before searching.');
      if (!item.memory || item.assessmentPromptVersion !== promptVersion || !Object.hasOwn(item.assessment, 'estimatePlan')) {
        const updated = await this.assess(item, item.messages.findLast(m=>m.role==='user')?.text || item.assessment.summary, { replay: true });
        item.assessment = updated.assessment; item.traces.push(...updated.traces);
        item.report = null; delete item.sourcePages;
      }
      if (!item.assessment?.searchReady) throw new AppError(400, 'needs_details', 'Please answer the job questions before searching for local help.');
      if (!force && item.report?.version === '1.1.0' && Date.now() - Date.parse(item.report.checkedAt) < 300000) return item;
      const query = { terms: item.assessment.searchTerms || item.assessment.trade, location: item.location, category:item.assessment.category };
      const [searchResult, directoryResult] = await Promise.allSettled([this.search.search(query), this.directory?.search(query)]);
      const pages = searchResult.status==='fulfilled'?searchResult.value:{sources:[],warnings:['Web price and review sources could not be refreshed.'],queries:[],credits:0,provider:'unavailable'};
      const directory = directoryResult.status==='fulfilled'?directoryResult.value:null;
      if(searchResult.status==='rejected' && !directory?.providers?.length)throw searchResult.reason;
      let extraction = { data: { providers: [], costEvidence: [], costRates:[] }, trace: null };
      if (pages.sources.length) extraction = await this.provider.structured({
        instructions: `${personaInstructions}\n\n${evidencePrompt}`,
        input: [{ role:'user', content: [{ type:'input_text', text:JSON.stringify({ location:item.location, job:item.assessment, sources:pages.sources }) }] }],
        schema: evidenceSchema, name: 'local_service_evidence'
      });
      const preliminary=groundEvidence(extraction.data,pages.sources);
      for(const p of extraction.data.providers){if(!preliminary.providers.find(x=>x.name.value===p.name.value)?.reviews)p.reviews=null;}
      try {
      if(this.search.reviews && extraction.data.providers.some(p=>!p.reviews)) {
        const extra=await this.search.reviews({providers:extraction.data.providers,location:item.location,offset:pages.sources.length});
        pages.sources.push(...extra.sources);pages.queries.push(...extra.queries);pages.warnings.push(...extra.warnings);pages.credits+=extra.credits;
        if(extra.sources.length){
          const enriched=await this.provider.structured({instructions:`${personaInstructions}\n\n${evidencePrompt}\n\n${reviewPrompt}`,
            input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({location:item.location,providers:extraction.data.providers.map((p,index)=>({index,name:p.name.value,phone:p.phone?.value,profileURL:pages.sources.find(s=>s.id===p.profileSourceId)?.url})),sources:extra.sources})}]}],schema:reviewEnrichmentSchema,name:'review_enrichment'});
          for(const entry of enriched.data.providers){const p=extraction.data.providers[entry.index];if(p&&!p.reviews){p.reviews=entry.reviews;p.reviewSamples=entry.reviewSamples;}}
          item.traces.push({...enriched.trace,phase:'review_enrichment',promptVersion,promptHash,at:new Date().toISOString()});
        }
      }
      } catch { pages.warnings.push('Individual review lookup did not finish; unverified ratings are omitted.'); }
      const rates=groundRates(extraction.data.costRates,pages.sources,item.location);
      item.report = { ...groundEvidence(extraction.data, pages.sources), version:'1.1.0', warnings: pages.warnings, queries: pages.queries,
        rates, estimate:calculateEstimate(item.assessment,rates,item.location) };
      item.sourcePages = pages.sources;
      item.traces.push({ ...(extraction.trace || {}), phase:'provider_search', promptVersion, promptHash, at:new Date().toISOString(), searchProvider:pages.provider, searchCredits:pages.credits });
      item.updatedAt = new Date().toISOString(); item.revision++;
      await this.store.save(item);
      // Google content is returned only for this live request, never saved or sent to the model.
      if(directory)item.report.directory=directory;
      return item;
    });
  }
}

export function caseSources(item,query) {
  const memory=item.memory||emptyMemory(),scope=`${item.id}:job-${memory.jobEpoch}`;
  const obsolete=new Set(memory.changes.filter(c=>c.previousFact).map(c=>c.previousFact.evidence.turnId));
  return sourceContext({scope,query,maxBytes:10000,limit:4,sources:customerTurns(item)
    .filter(t=>t.id>=memory.startTurn&&!obsolete.has(t.id))
    .map(t=>({id:`customer-turn-${t.id}`,scope,text:t.text,recordedAt:item.messages.filter(m=>m.role==='user')[t.id-1]?.at}))});
}
