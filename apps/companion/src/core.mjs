import { createHash, randomUUID } from 'node:crypto';
export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status=status; this.code=code; }
}
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const fail = (message, status=400, code='invalid_input') => { throw new AppError(status,code,message); };
export function text(value, limit=4000, allowEmpty=false) {
  if(typeof value!=='string' || value.length>limit || (!allowEmpty && !value.trim())) fail(`Enter ${allowEmpty?'up to':'between 1 and'} ${limit} characters.`);
  return value.trim();
}
export const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const array = items => ({type:'array',items});
export const string = {type:'string'};
export const enumeration = values => ({type:'string',enum:values});
export function validate(schema, value) {
  if(schema.type==='object') {
    if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Expected object');
    if(Object.keys(value).length!==schema.required.length) throw new Error('Unexpected fields');
    for(const key of schema.required) { if(!Object.hasOwn(value,key)) throw new Error('Missing field'); validate(schema.properties[key],value[key]); }
  } else if(schema.type==='array') { if(!Array.isArray(value)) throw new Error('Expected array'); value.forEach(x=>validate(schema.items,x)); }
  else if(typeof value!==schema.type || (schema.enum && !schema.enum.includes(value))) throw new Error('Invalid field');
  else if(schema.type==='number'&&(!Number.isFinite(value)||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum))) throw new Error('Invalid number');
}
