import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {ORIGIN} from './origin.mjs';
import {clone,identifier} from './contracts.mjs';
export const hash = value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class Store {
  constructor(path,{maxCalls=60,model='gpt-6.1-sol',reasoning='low'}={}) {
    if(!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>200)throw new Error('Call limit must be 1-200.');
    mkdirSync(dirname(path),{recursive:true,mode:0o700});
    this.defaults={model,reasoning};
    this.db=new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS instances(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS budget(id INTEGER PRIMARY KEY CHECK(id=1), max_calls INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS calls(id INTEGER PRIMARY KEY, started TEXT NOT NULL, kind TEXT NOT NULL, instance TEXT NOT NULL, result TEXT);');
    this.db.prepare('INSERT OR IGNORE INTO budget VALUES(1,?)').run(maxCalls);
  }
  create(id,{developing=true,synthetic=false,fixture=false,model=this.defaults.model,reasoning=this.defaults.reasoning}={}) {
    identifier(id);
    if(typeof developing!=='boolean'||typeof synthetic!=='boolean')throw new Error('Invalid instance options.');
    if(typeof model!=='string'||!model.trim()||model.length>100||!['none','minimal','low','medium','high','xhigh'].includes(reasoning))throw new Error('Invalid model configuration.');
    const origin={...clone(ORIGIN),model,reasoning};
    const state={id,revision:0,origin,originHash:hash(origin),developing,synthetic,fixture,current:clone(origin.self),version:0,
      versions:[{version:0,self:clone(origin.self),reason:'origin',at:new Date().toISOString()}],
      experiences:[],turns:[],hypotheses:[],changes:[],relationships:{},mood:{tension:0,interest:0},lastReflection:0,initiatives:0};
    this.db.prepare('INSERT INTO instances VALUES(?,?,?)').run(id,0,JSON.stringify(state));return state;
  }
  list(){return this.db.prepare('SELECT id, revision FROM instances ORDER BY id').all();}
  get(id){identifier(id);const row=this.db.prepare('SELECT state FROM instances WHERE id=?').get(id);if(!row)throw new Error('Instance not found.');const state=JSON.parse(row.state);if(hash(state.origin)!==state.originHash)throw new Error('Origin integrity check failed.');return state;}
  save(state,expectedRevision) {
    const stored=this.get(state.id);
    if(hash(state.origin)!==stored.originHash||state.originHash!==stored.originHash||state.developing!==stored.developing||state.synthetic!==stored.synthetic)throw new Error('Immutable instance configuration changed.');
    state.revision=expectedRevision+1;
    const result=this.db.prepare('UPDATE instances SET state=?,revision=? WHERE id=? AND revision=?').run(JSON.stringify(state),state.revision,state.id,expectedRevision);
    if(result.changes!==1)throw new Error('State changed concurrently; refresh and try again.');
    return clone(state);
  }
  reserve(kind,instance) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const b=this.budget();if(b.used>=b.limit)throw new Error('The persistent API call budget is exhausted.');
      const r=this.db.prepare('INSERT INTO calls(started,kind,instance) VALUES(?,?,?)').run(new Date().toISOString(),kind,instance);
      this.db.exec('COMMIT');return Number(r.lastInsertRowid);
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  finish(id,result){this.db.prepare('UPDATE calls SET result=? WHERE id=?').run(JSON.stringify(result),id);}
  budget(){return {used:this.db.prepare('SELECT count(*) AS n FROM calls').get().n,limit:this.db.prepare('SELECT max_calls FROM budget WHERE id=1').get().max_calls};}
  setCallLimit(limit){
    if(!Number.isInteger(limit)||limit<1||limit>1000000)throw new Error('Choose a total call limit from 1 to 1000000.');
    this.db.exec('BEGIN IMMEDIATE');
    try{if(limit<this.budget().used)throw new Error('The limit cannot be below requests already used.');this.db.prepare('UPDATE budget SET max_calls=? WHERE id=1').run(limit);this.db.exec('COMMIT');return this.budget();}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  calls(){return this.db.prepare('SELECT * FROM calls ORDER BY id').all().map(x=>({...x,result:x.result?JSON.parse(x.result):null}));}
  close(){this.db.close();}
}
