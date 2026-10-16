const str = { type: 'string' };
const num = { type: 'number' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const en = (...values) => ({ type: 'string', enum: values });
const memoryEvidence = obj({ turnId: { type: 'integer' }, quote: str });
export const memorySchema = obj({
  transition: en('continue', 'replace_job'), transitionEvidence: nullable(memoryEvidence),
  upserts: arr(obj({ key: str, kind: en('job', 'quantity', 'dimension', 'site', 'condition', 'materials', 'budget', 'timing', 'preference'), evidence: memoryEvidence })),
  removals: arr(obj({ key: str, evidence: memoryEvidence }))
});
export const claimSchema = obj({ value: str, sourceId: str, quote: str });
export const assessmentSchema = obj({
  reply: str,
  status: en('clarify', 'ready', 'specialist', 'urgent', 'out_of_scope'),
  category: en('door', 'mounting', 'painting', 'lawn', 'lighting', 'other', 'specialist', 'unrelated'),
  title: str, summary: str,
  observations: arr(obj({ detail: str, basis: en('photo', 'customer'), imageIds: arr(str) })),
  hypotheses: arr(str), scope: arr(str), materials: arr(str), assumptions: arr(str),
  questions: arr(str), duration: nullable(str), trade: str, searchTerms: str,
  searchReady: { type: 'boolean' }, jobBrief: str, caution: nullable(str),
  estimatePlan: nullable(obj({ laborHoursLow:num, laborHoursHigh:num, materialsLow:num, materialsHigh:num,
    quantity: num, unit: en('job','item','sq_ft'), quantityBasis:en('customer','assumption'),
    assumptions:arr(str), exclusions:arr(str), uncertainty:en('low','medium'), rationale:str }))
});
export const evidenceSchema = obj({
  providers: arr(obj({
    name: claimSchema, service: claimSchema, coverage: nullable(claimSchema),
    phone: nullable(claimSchema), profileSourceId: str,
    pricing: nullable(obj({ kind: en('advertised_starting', 'advertised_fixed', 'hourly', 'request_quote'), text: str, scope: str, sourceId: str, quote: str })),
    reviews: nullable(obj({ rating: num, scale: num, reviewCount: { type: 'integer' }, platform: str, sourceId: str, quote: str })),
    reviewSamples: arr(obj({ text:str, author:nullable(str), date:nullable(str), sourceId:str, quote:str })),
    fitReason: str, ask: str
  })),
  costEvidence: arr(obj({ label: str, geography: en('national', 'local', 'provider', 'unknown'), limitation: str, sourceId: str, quote: str })),
  costRates:arr(obj({ kind:en('hourly_labor','project'), low:num, high:num, unit:en('hour','job','item','sq_ft'),
    geography:en('local','national','unknown'), area:nullable(str), includesMaterials:{type:'boolean'},
    minimumHours:nullable(num), minimumHoursQuote:nullable(str), label:str, applicability:str, sourceId:str, quote:str }))
});

export const reviewEnrichmentSchema = obj({providers:arr(obj({index:{type:'integer'},reviews:evidenceSchema.properties.providers.items.properties.reviews,reviewSamples:evidenceSchema.properties.providers.items.properties.reviewSamples}))});

// Validate the JSON Schema subset used by these owned contracts on every provider.
export function validate(schema, value, path = '$') {
  if (schema.anyOf) {
    if (schema.anyOf.some(s => { try { validate(s, value, path); return true; } catch { return false; } })) return;
    throw new Error(`Invalid value at ${path}`);
  }
  const type = schema.type;
  if (type === 'null') { if (value !== null) throw new Error(`Expected null at ${path}`); return; }
  if (type === 'array') {
    if (!Array.isArray(value)) throw new Error(`Expected array at ${path}`);
    for (let i = 0; i < value.length; i++) validate(schema.items, value[i], `${path}[${i}]`);
    return;
  }
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected object at ${path}`);
    for (const k of schema.required) if (!Object.hasOwn(value, k)) throw new Error(`Missing ${path}.${k}`);
    for (const [k, v] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, k)) throw new Error(`Unexpected ${path}.${k}`);
      validate(schema.properties[k], v, `${path}.${k}`);
    }
    return;
  }
  if (type === 'integer' ? !Number.isInteger(value) : typeof value !== type) throw new Error(`Invalid type at ${path}`);
  if (type === 'number' && !Number.isFinite(value)) throw new Error(`Invalid number at ${path}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`Invalid enum at ${path}`);
}
