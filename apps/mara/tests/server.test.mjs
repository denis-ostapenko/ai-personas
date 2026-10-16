import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from '../src/store.mjs';import {Engine} from '../src/engine.mjs';import {Provider} from '../src/provider.mjs';import {createServer} from '../src/server.mjs';import {FixtureProvider} from './fixtures.mjs';import {answerSchema} from '../src/contracts.mjs';
test('local HTTP app, API changes, origin protection and readable error state',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'evolving-http-')),store=new Store(join(dir,'db.sqlite'));store.create('mara');const server=createServer(store,new Engine(store,new FixtureProvider()));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});});
  assert.match(await (await fetch(base)).text(),/About Mara/);
  const post=(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
  assert.equal((await post('/api/create',{id:'../../escape'})).status,400);
  assert.equal((await post('/api/create',{id:'second'},{Origin:'https://outside.example'})).status,403);
  assert.equal((await post('/api/create',{id:'second',developing:false})).status,200);
  assert.equal((await post('/api/turn',{id:'mara',text:'An external actor damaged the archive.'})).status,200);
  const result=await (await fetch(base+'/api/state?id=mara')).json();assert.equal(result.state.turns.length,1);assert.equal(result.instances.length,2);
});
test('provider counts failures, never retries, validates output and keeps secrets out of ledger',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'evolving-provider-')),store=new Store(join(dir,'db.sqlite'),{maxCalls:2});t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});const s=store.create('mara');let attempts=0;
  const provider=new Provider(store,{key:'test-secret',fetchFn:async()=>{attempts++;return {ok:false,status:500};}});
  await assert.rejects(provider.call({state:s,kind:'test',instructions:'Test',input:{},schema:answerSchema}),/500/);assert.equal(attempts,1);assert.equal(store.budget().used,1);assert.ok(!JSON.stringify(store.calls()).includes('test-secret'));
  provider.fetchFn=async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"reply":42}'}]}]})});
  await assert.rejects(provider.call({state:s,kind:'test',instructions:'Test',input:{},schema:answerSchema}),/invalid string/);assert.equal(store.budget().used,2);assert.equal(store.calls()[1].result.ok,false);
});
