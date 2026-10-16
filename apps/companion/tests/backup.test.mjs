import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,writeFile,stat,symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { backup,restore } from '../scripts/backup.mjs';
import { PersonaStore } from '../src/store.mjs';
import { Persona,initialState } from '../src/persona.mjs';
const owner='a'.repeat(64);
async function setup(t){const root=await mkdtemp(path.join(os.tmpdir(),'persona-backup-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,dir:path.join(root,'data'),out:path.join(root,'backup.json'),dest:path.join(root,'restored')};}
test('complete cold snapshot restores pinned cores, memory, SQLite rows and a usable chat',async t=>{
 const {root,dir,out,dest}=await setup(t),store=new PersonaStore(dir),p=new Persona({store,provider:{}});
 await store.save(owner,initialState());let s=await p.act(owner,{kind:'new_chat',revision:0});
 await p.act(owner,{kind:'memory_add',revision:s.revision,quote:'I enjoy astronomy.',category:'interest'});
 const before=await store.get(owner);await backup(dir,out);await restore(out,dest);
 const restored=new PersonaStore(dest);assert.deepEqual(await restored.get(owner),before);
 const usable=new Persona({store:restored,provider:{}});const next=await usable.act(owner,{kind:'apply_settings',chatId:before.activeChatId,revision:before.revision});assert.equal(next.revision,before.revision+1);
 assert.equal((await stat(out)).mode&0o777,0o600);assert.equal((await stat(restored.file(owner))).mode&0o777,0o600);
 await assert.rejects(()=>restore(out,dir),{code:'EEXIST'});assert.deepEqual(await store.get(owner),before);
});
test('snapshot rejects running storage, tampering, UI exports and path traversal before writing',async t=>{
 const {dir,out,dest}=await setup(t);await new PersonaStore(dir).save(owner,initialState());
 await writeFile(path.join(dir,'.server.lock'),'123');await assert.rejects(()=>backup(dir,out),/Stop/);await rm(path.join(dir,'.server.lock'));
 await backup(dir,out);const saved=JSON.parse(await readFile(out,'utf8'));
 saved.files[0].path='../escape';await writeFile(out,JSON.stringify(saved));await assert.rejects(()=>restore(out,dest),/Invalid/);
 await writeFile(out,JSON.stringify(initialState()));await assert.rejects(()=>restore(out,dest),/complete snapshot/);await assert.rejects(()=>stat(dest),{code:'ENOENT'});
});
