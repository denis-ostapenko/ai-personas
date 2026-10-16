import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {Store} from '../src/store.mjs';
const report=JSON.parse(readFileSync(resolve(process.argv[2]||'evidence/run-2026-10-14-pilot-1/report.json'),'utf8'));
const store=new Store(resolve(process.argv[3]||'data/personas.sqlite'));
try {
  if(!store.list().some(i=>i.id==='mara'))store.create('mara');
  for(const source of report.beforeRollback??report.states){
    const id=`pilot-${source.id}`;if(store.list().some(i=>i.id===id))continue;
    store.create(id,{synthetic:true,developing:source.developing,model:source.origin.model,reasoning:source.origin.reasoning});
    store.save({...source,id,revision:0,fixture:false,replay:true},0);
  }
  console.log('Imported independent copies of saved synthetic pilot histories. Original evidence and its call ledger are unchanged.');
}finally{store.close();}
