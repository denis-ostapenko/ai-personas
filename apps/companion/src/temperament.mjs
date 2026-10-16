import { readFileSync } from 'node:fs';

// The authored temperament is data. Character settings modulate it through the
// explicit slider table in persona/temperament.json; nothing here is learned.
export const temperamentSource=JSON.parse(readFileSync(new URL('../persona/temperament.json',import.meta.url),'utf8'));
export const temperamentVersion=temperamentSource.version;
export const affectChannels=Object.keys(temperamentSource.channels);
export const emotionChannels=affectChannels.filter(c=>temperamentSource.channels[c].kind==='emotion');
export const zeroImpulses=()=>Object.fromEntries(affectChannels.map(c=>[c,0]));

const round=x=>Math.round(x*10000)/10000;
function roundAll(value){
  if(typeof value==='number')return round(value);
  if(Array.isArray(value))return value.map(roundAll);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,roundAll(v)]));
  return value;
}
export function resolveTemperament(settings) {
  const t=structuredClone(temperamentSource);
  for(const [slider,rules] of Object.entries(t.sliders)) {
    const value=settings?.[slider];
    if(!Number.isFinite(value))continue;
    const x=Math.max(0,Math.min(10,value))/10;
    for(const rule of rules) {
      const parent=rule.path.slice(0,-1).reduce((o,k)=>o?.[k],t),key=rule.path.at(-1);
      if(!parent||typeof parent[key]!=='number')throw new Error(`Unknown temperament path: ${rule.path.join('.')}`);
      if(rule.scale)parent[key]*=rule.scale[0]+(rule.scale[1]-rule.scale[0])*x;
      if(rule.set)parent[key]=rule.set[0]+(rule.set[1]-rule.set[0])*x;
    }
  }
  for(const channel of Object.values(t.channels)) {
    // Sensitivity weights an event; it never amplifies one beyond its appraised size.
    channel.sensitivity=Math.max(0,Math.min(1,channel.sensitivity));
    channel.baseline=Math.max(0,Math.min(channel.max,channel.baseline));
    channel.exit=Math.min(channel.exit,channel.enter);
  }
  delete t.sliders;delete t.status;
  return roundAll({...t,family:'affect-v2'});
}
