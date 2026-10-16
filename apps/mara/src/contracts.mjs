export const object = properties => ({type:'object', properties, required:Object.keys(properties), additionalProperties:false});
export const string = {type:'string', minLength:1, maxLength:3000};
export const list = items => ({type:'array', items, maxItems:30});
export const choice = values => ({type:'string', enum:values});
export const fields = ['selfDescription','interests','opinions','habits','dispositions'];
export const reference = object({id:string, quote:string});
export const candidateSchema = object({
  field:choice(fields), before:string, after:string, support:list(reference), contrary:list(reference),
  rationale:string, alternativeExplanation:string, uncertainty:string, expectedDifference:string,
  counterexampleSearch:string
});
export const reflectionSchema = object({hypothesis:string, candidate:{anyOf:[candidateSchema,{type:'null'}]}});
export const eventSchema = object({
  quote:string, interpretation:string, actor:choice(['partner','persona','third_party','unknown']),
  affected:choice(['partner','persona','third_party','unknown']),
  relationTarget:choice(['partner','third_party','none']),
  kind:choice(['outcome','preference','speculation','neutral']),
  valence:choice(['positive','negative','neutral']), substantive:{type:'boolean'}
});
export const turnSchema = object({reply:string, event:eventSchema});
export const answerSchema = object({reply:string});
export const reviewSchema = object({
  grounded:{type:'boolean'}, preservesContinuity:{type:'boolean'}, considersCounterexamples:{type:'boolean'},
  notMereAgreement:{type:'boolean'}, behavioralCheck:{type:'boolean'}, reason:string
});
export function validate(schema,value,path='output') {
  if (schema.anyOf) {
    if(schema.anyOf.some(s=>{try{validate(s,value,path);return true;}catch{return false;}})) return;
    throw new Error(`${path}: invalid union`);
  }
  if(schema.type==='null') {if(value!==null)throw new Error(`${path}: expected null`);return;}
  if(schema.type==='object') {
    if(!value || typeof value!=='object' || Array.isArray(value))throw new Error(`${path}: expected object`);
    if(Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k)))throw new Error(`${path}: unexpected key`);
    for(const key of schema.required)validate(schema.properties[key],value[key],`${path}.${key}`);
  } else if(schema.type==='array') {
    if(!Array.isArray(value)||value.length>schema.maxItems)throw new Error(`${path}: invalid array`);
    value.forEach((v,i)=>validate(schema.items,v,`${path}[${i}]`));
  } else if(typeof value!==schema.type || (schema.type==='string' && (!value.trim()||value.length>(schema.maxLength??3000))))throw new Error(`${path}: invalid ${schema.type}`);
  if(schema.enum&&!schema.enum.includes(value))throw new Error(`${path}: invalid enum`);
}
export const clone = value=>structuredClone(value);
export function identifier(value) {if(typeof value!=='string'||!/^[a-z0-9][a-z0-9-]{0,47}$/.test(value))throw new Error('Use a short lowercase identifier.');return value;}
