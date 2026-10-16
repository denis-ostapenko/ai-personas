import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { backup,restore } from '../scripts/backup.mjs';
import { CaseStore } from '../src/store.mjs';
test('cold case snapshot preserves private owner binding, images and revisions after restore',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'advisor-backup-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const dir=path.join(root,'data'),out=path.join(root,'snapshot.json'),dest=path.join(root,'restored'),store=new CaseStore(dir);
 const item={id:randomUUID(),owner:'synthetic-owner',revision:3,images:['synthetic-image'],memory:{facts:[],changes:[{action:'correction'}]},messages:[]};
 await store.save(item);await backup(dir,out);await restore(out,dest);assert.deepEqual(await new CaseStore(dest).get(item.id,item.owner),item);
 await assert.rejects(()=>new CaseStore(dest).get(item.id,'other'),{code:'case_not_found'});await assert.rejects(()=>restore(out,dir),{code:'EEXIST'});
 const saved=JSON.parse(await readFile(out,'utf8'));saved.files[0].sha256='bad';await writeFile(out,JSON.stringify(saved));await assert.rejects(()=>restore(out,path.join(root,'bad')),/checksum/);
});
