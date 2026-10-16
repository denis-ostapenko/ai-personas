import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {hash} from './store.mjs';
export class LocalEmbeddings{
  constructor(store){this.store=store;this.child=null;this.pending=new Map();this.next=0;this.disabled=false;
    store.db.exec('CREATE TABLE IF NOT EXISTS memory_vectors(key TEXT PRIMARY KEY, vector TEXT NOT NULL)');}
  start(){
    if(this.child)return;
    const candidates=[fileURLToPath(new URL('../.venv/bin/python',import.meta.url)),fileURLToPath(new URL('../.venv/Scripts/python.exe',import.meta.url)),`${homedir()}/.local/share/rag-venv/bin/python`];
    const python=process.env.MARA_EMBED_PYTHON||candidates.find(existsSync);
    if(!python)throw new Error('Local embedding runtime unavailable.');
    if(!existsSync(python))throw new Error('Local embedding runtime unavailable.');
    this.child=spawn(python,[fileURLToPath(new URL('../scripts/embed.py',import.meta.url))],{stdio:['pipe','pipe','ignore'],env:{...process.env,HF_HUB_OFFLINE:'1'}});
    createInterface({input:this.child.stdout}).on('line',line=>{try{const data=JSON.parse(line),p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);if(data.error)p.reject(new Error(data.error));else p.resolve(data.vectors);}catch{}});
    const fail=()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Local embedding worker stopped.'));}this.pending.clear();this.child=null;};
    this.child.on('error',fail);this.child.on('exit',fail);
  }
  async embed(texts){
    if(this.disabled)throw new Error('Local embeddings unavailable; lexical search remains active.');
    const keys=texts.map(t=>hash(['multilingual-minilm-l12-mean-v1',t])),get=this.store.db.prepare('SELECT vector FROM memory_vectors WHERE key=?');
    const vectors=keys.map(k=>{const r=get.get(k);return r?JSON.parse(r.vector):null;}),missing=vectors.flatMap((v,i)=>v?[]:[i]);
    if(!missing.length)return vectors;
    try{
      this.start();const id=++this.next;
      const computed=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);this.child?.kill();reject(new Error('Local embedding timeout.'));},45000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,texts:missing.map(i=>texts[i])})+'\n');});
      if(!Array.isArray(computed)||computed.length!==missing.length||computed.some(v=>!Array.isArray(v)||v.length!==384||v.some(n=>!Number.isFinite(n))))throw new Error('Invalid embedding batch.');
      const put=this.store.db.prepare('INSERT OR REPLACE INTO memory_vectors VALUES(?,?)');missing.forEach((i,j)=>{vectors[i]=computed[j];put.run(keys[i],JSON.stringify(computed[j]));});return vectors;
    }catch(e){this.disabled=true;throw e;}
  }
  close(){this.child?.kill();}
}
