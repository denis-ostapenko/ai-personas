import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PersonaStore } from '../src/store.mjs';
import { Persona } from '../src/persona.mjs';
import { createServer } from '../src/server.mjs';
import { neutralAppraisal, interpretationOf } from '../src/appraisal.mjs';
// Labeled deterministic readings so the UI can be checked without a model. Not evidence of model quality.
const readings=[[/agree|admit/i,{target:'persona',agency:'user',valence:-0.6,intent:0.9,pressure:0.9,anchors:['pressure_over_argument']}],[/sorry|pushed/i,{target:'persona',agency:'user',valence:0.4,intent:0.8,repair:0.9}],
  [/joke|union|committee/i,{target:'situation',agency:'user',valence:0.4,incongruity:0.9,playfulness:0.9,anchors:['shared_callback']}],[/shop|umbrella|miss/i,{target:'self',agency:'other',valence:-0.2,distress:0.8,selfDisclosure:0.9,anchors:['small_rituals']}]];
const readingFor=text=>interpretationOf(readings.find(([pattern])=>pattern.test(text))?.[1]||{target:'situation',agency:'none'});
const directory=await mkdtemp(path.join(os.tmpdir(),'persona-browser-fixture-'));
const provider={async structured(request){
  if(request.name==='persona_appraisal'){const text=request.input.at(-1).content;return {data:{...neutralAppraisal(),signal:'mixed',evidenceQuote:text,topic:{existingId:'',title:'Fixture conversation'},confidence:0.9,interpretations:[readingFor(text)],
    cellMatches:/joke|union|committee/i.test(text)?[{cellId:'shared_teasing',evidenceQuote:text,confidence:0.9,relation:'supports'}]:[]},trace:{model:'browser-fixture'}};}
  if(request.name==='persona_document_review'){
    const docs=JSON.parse(request.input[0].content).documents,memories=[...docs.find(x=>x.id==='user_profile').content,...docs.find(x=>x.id==='relationship_memory').content];
    return {data:{coverage:docs.map(x=>x.id),groups:memories.length?[{topic:'About you',memoryIds:memories.map(x=>x.id)}]:[],proposals:[]},trace:{model:'browser-fixture'}};
  }
  return {data:{reply:'This is a labeled browser-test reply. Your character settings and remembered details are connected to the conversation.',memoryReferences:[],memories:[]},trace:{model:'browser-fixture'}};
}};
const persona=new Persona({store:new PersonaStore(directory),provider,researchLoader:async()=>({date:'2026-10-12',text:'Browser fixture; no live research.',hash:'fixture',truncated:false})});
const server=createServer({persona});
server.listen(4347,'127.0.0.1',()=>console.log('Isolated browser fixture: http://127.0.0.1:4347'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
