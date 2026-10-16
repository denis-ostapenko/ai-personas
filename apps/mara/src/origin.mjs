import {readFileSync} from 'node:fs';
// Only new profiles use this definition. Stored origins retain their own hash.
export const ORIGIN=JSON.parse(readFileSync(new URL('../persona/definition.json',import.meta.url),'utf8'));
