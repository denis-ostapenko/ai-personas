// Cold, complete data snapshots. Stop the app first; never use a UI export here.
import { readdir,readFile,writeFile,mkdir,lstat,rm,access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const application='companion';
const digest=data=>createHash('sha256').update(data).digest('hex');
const valid=name=>application==='companion'?/^(?:profiles\/[a-f0-9]{64}\/memories\.sqlite|[a-f0-9]{64}\.json)$/.test(name):/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/.test(name);
async function files(dir,prefix='') {
 const out=[];
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  const name=prefix+entry.name,absolute=path.join(dir,entry.name);
  if(entry.isSymbolicLink())throw new Error('Symlinks are not supported in a data snapshot.');
  if(entry.isDirectory())out.push(...await files(absolute,name+'/'));
  else if(valid(name))out.push(name);
  else throw new Error('Unexpected data file. Stop the app and use its dedicated data directory.');
 }
 return out;
}
export async function backup(directory,output) {
 directory=path.resolve(directory);output=path.resolve(output);
 if(output.startsWith(directory+path.sep))throw new Error('Save backups outside the live data directory.');
 if(!(await lstat(directory)).isDirectory())throw new Error('Expected a real data directory.');
 try {await access(path.join(directory,'.server.lock'));throw new Error('Stop the server before taking a snapshot.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const list=[];let bytes=0;
 for(const name of await files(directory)) {const data=await readFile(path.join(directory,name));bytes+=data.length;if(bytes>128_000_000)throw new Error('Snapshot exceeds the 128 MB tool limit.');list.push({path:name,sha256:digest(data),data:data.toString('base64')});}
 if(!list.length)throw new Error('No saved application records found.');
 await writeFile(output,JSON.stringify({format:'persona-cold-snapshot-v1',application,createdAt:new Date().toISOString(),files:list}),{flag:'wx',mode:0o600});
 return {files:list.length,bytes};
}
export async function restore(input,directory) {
 if((await lstat(input)).size>180_000_000)throw new Error('Snapshot exceeds the input limit.');
 const snapshot=JSON.parse(await readFile(input,'utf8'));
 if(snapshot.format!=='persona-cold-snapshot-v1'||snapshot.application!==application||!Array.isArray(snapshot.files)||!snapshot.files.length)throw new Error('Not a complete snapshot for this application.');
 const seen=new Set(),rows=[];let bytes=0;
 for(const row of snapshot.files) {
  if(!valid(row.path)||seen.has(row.path)||typeof row.data!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(row.data))throw new Error('Invalid or duplicate snapshot path/data.');
  seen.add(row.path);const data=Buffer.from(row.data,'base64');bytes+=data.length;
  if(digest(data)!==row.sha256||bytes>128_000_000)throw new Error('Snapshot checksum or size check failed.');rows.push({...row,data});
 }
 // mkdir without recursive deliberately refuses every existing destination.
 await mkdir(directory,{mode:0o700});
 try {for(const row of rows){const target=path.join(directory,row.path);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,row.data,{flag:'wx',mode:0o600});}}
 catch(error){await rm(directory,{recursive:true,force:true});throw error;}
 return {files:rows.length,bytes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [command,from,to]=process.argv.slice(2);
 if(!['backup','restore'].includes(command)||!from||!to){console.error('Usage: node scripts/backup.mjs backup DATA_DIRECTORY NEW_SNAPSHOT.json | restore SNAPSHOT.json NEW_DATA_DIRECTORY');process.exitCode=2;}
 else try {console.log(JSON.stringify(await (command==='backup'?backup(from,to):restore(from,to))));}catch(error){console.error(error.message);process.exitCode=1;}
}
