// Offline affect replay: no model calls, no private data written.
//
//   node scripts/replay-affect.mjs <run.json[.gz] | export.json> [--settings humor=6,composure=3] [--out dir]
//
// Archived v0.3 integration runs: replays the recorded appraisal impulses through the
// v0.3 controller and through the current controller, so dynamics can be compared on
// identical input. Profile exports (GET /api/export): replays the recorded affect event
// log, verifies that the stored states are reproduced, and optionally recomputes them
// under different character settings ("what if this persona were steadier?").
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveTemperament, affectChannels, emotionChannels, zeroImpulses } from '../src/temperament.mjs';
import { transition, blindEvent } from '../src/affect.mjs';
import { defaults, normalizeSettings } from '../src/character.mjs';

const args=process.argv.slice(2);
const input=args.find(a=>!a.startsWith('--'));
const option=name=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:null;};
if(!input){console.error('Usage: node scripts/replay-affect.mjs <run.json[.gz]|export.json> [--settings k=v,...] [--out dir]');process.exit(2);}
const raw=await readFile(input);
const data=JSON.parse((input.endsWith('.gz')?gunzipSync(raw):raw).toString('utf8'));
const overrides=Object.fromEntries((option('settings')||'').split(',').filter(Boolean).map(p=>{const [k,v]=p.split('=');return [k,Number(v)];}));

// v0.3 controller, reproduced verbatim in behaviour for comparison only.
const legacyKeys=['anger','amusement','reflection','empathy'];
function legacyTemperament(s){return {sensitivity:{anger:0.3+s.independence*0.085,amusement:0.2+s.humor*0.09,reflection:0.3+s.intellectual_style*0.08,empathy:0.15+s.warmth*0.09},
  baseline:{anger:0,amusement:s.humor*0.007,reflection:s.intellectual_style*0.012,empathy:s.warmth*0.006},halfLifeSeconds:{anger:900,amusement:240,reflection:600,empathy:600},enter:0.28,exit:0.18};}
function legacyTransition(prev,appraisal,t,time){
  const elapsed=prev?Math.max(0,Math.min(86400,(time-prev.at)/1000)):0,values={};
  for(const k of legacyKeys){const base=t.baseline[k],old=prev?prev.values[k]:base;
    values[k]=Number(Math.max(0,Math.min(1,base+(old-base)*Math.pow(0.5,elapsed/t.halfLifeSeconds[k])*(appraisal?0.82:1)+(appraisal?appraisal.impulses[k]*appraisal.confidence*t.sensitivity[k]:0))).toFixed(3));}
  const active=legacyKeys.filter(k=>k!=='reflection'&&values[k]>=(prev?.active.includes(k)?t.exit:t.enter)).sort((a,b)=>values[b]-values[a]).slice(0,2);
  return {values,active,at:time};
}
const round=x=>Number(x.toFixed(3));
function metrics(rows,channelsList,pick){
  return Object.fromEntries(channelsList.map(k=>{
    const values=rows.map(r=>pick(r).values[k]||0),active=rows.map(r=>pick(r).active.includes(k));
    // Active although nothing in the current turn pushed this channel: the "hangover".
    const uncaused=rows.filter((r,i)=>active[i]&&!(r.cause[k]>=0.05)).length;
    return [k,{max:round(Math.max(...values)),activeTurns:active.filter(Boolean).length,activeWithoutCurrentCause:uncaused}];
  }));
}

let report;
if(Array.isArray(data.turns)) {
  const settings=normalizeSettings({...(data.settings||defaults),...overrides}),t=resolveTemperament(settings),lt=legacyTemperament(settings);
  let oldState=null,newState=null;const rows=[];
  for(const turn of [...data.turns].sort((a,b)=>a.number-b.number)) {
    const time=Date.parse(turn.startedAt),call=(turn.calls||[]).find(c=>c.name==='persona_appraisal'&&c.data);
    const validated=turn.trace?.appraisal?.status==='validated'&&call;
    const cells=turn.trace?.reactionCells?.impulses||{};
    const merged=validated?Object.fromEntries(legacyKeys.map(k=>[k,Math.max(-1,Math.min(1,(call.data.impulses?.[k]||0)+(cells[k]||0)))])):null;
    const cellKeys={};for(const cell of turn.trace?.reactionCells?.selected||[])for(const [k,v] of Object.entries(cell.contribution||{}))if(v>0&&!cellKeys[k])cellKeys[k]=cell.cellId;
    oldState=legacyTransition(oldState,merged?{impulses:merged,confidence:call.data.confidence}:null,lt,time);
    const impulses=zeroImpulses();if(merged)for(const k of legacyKeys)impulses[k]=round(merged[k]*call.data.confidence);
    const event=merged?{impulses,cellKeys,relevance:Object.fromEntries(affectChannels.map(k=>[k,Math.abs(impulses[k])>=0.05])),features:{},anchors:[],
      topicId:call.data.topic?.existingId||call.data.topic?.title||null,evidenceQuote:call.data.evidenceQuote}:{...blindEvent(),topicId:null};
    newState=transition(newState,event,t,`turn-${turn.number}`,time);
    rows.push({turn:turn.number,label:turn.label,appraisal:validated?'validated':'fallback',cause:impulses,
      legacy:{values:oldState.values,active:oldState.active},current:{values:Object.fromEntries(legacyKeys.map(k=>[k,newState.values[k]])),active:newState.active.filter(k=>legacyKeys.includes(k)),engaged:newState.cognition.engaged}});
  }
  const compared=['anger','amusement','empathy'];
  report={mode:'archived v0.3 run, recorded impulses replayed through both controllers',source:path.basename(input),
    sourceHash:createHash('sha256').update(raw).digest('hex'),settings,turns:rows.length,
    note:'Input impulses come from the v0.3 appraisal contract (four channels). Joy, unease and hurt therefore stay at baseline; this isolates the dynamics change and does not evaluate the v0.4 appraisal.',
    metrics:{legacy:metrics(rows,compared,r=>r.legacy),current:metrics(rows,compared,r=>r.current)},rows};
} else if(Array.isArray(data.runtime?.affectEvents)) {
  const events=[...data.runtime.affectEvents].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  let recorded=null,whatIf=null,mismatches=0;const rows=[];
  for(const e of events) {
    const event={impulses:e.impulses,cellImpulses:e.cellImpulses,cellKeys:e.cellKeys||{},relevance:Object.fromEntries(affectChannels.map(k=>[k,e.relevance.includes(k)])),features:e.features,relational:e.relational,anchors:e.anchors,topicId:e.topicId,evidenceQuote:e.appraisal?.status==='validated'?'(recorded)':''};
    const t=resolveTemperament(normalizeSettings(e.settings)),alt=resolveTemperament(normalizeSettings({...e.settings,...overrides}));
    recorded=transition(recorded,event,t,e.id,Date.parse(e.createdAt));whatIf=transition(whatIf,event,alt,e.id,Date.parse(e.createdAt));
    const match=emotionChannels.every(k=>Math.abs(recorded.values[k]-e.after[k])<0.002);if(!match)mismatches++;
    rows.push({id:e.id,createdAt:e.createdAt,cause:e.impulses,stored:{values:e.after,active:e.active},recomputed:{values:recorded.values,active:recorded.active},whatIf:{values:whatIf.values,active:whatIf.active}});
  }
  report={mode:'profile export, recorded affect events replayed',source:path.basename(input),events:events.length,overrides,
    reproduction:{mismatches,note:'This is a current-controller replay. Historical controllers, changed settings, removed events or imported initial state can cause mismatches; it is not an exact historical reconstruction.'},
    metrics:{stored:metrics(rows,emotionChannels,r=>r.stored),whatIf:metrics(rows,emotionChannels,r=>r.whatIf)},rows};
} else { console.error('Unrecognized input: expected an archived run with turns[] or a profile export with runtime.affectEvents.');process.exit(2); }

const summary=JSON.stringify({mode:report.mode,source:report.source,turns:report.turns??report.events,metrics:report.metrics,reproduction:report.reproduction},null,2);
console.log(summary);
const out=option('out');
if(out){await mkdir(out,{recursive:true});await writeFile(path.join(out,'replay.json'),JSON.stringify(report,null,2));}
