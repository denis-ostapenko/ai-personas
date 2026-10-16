import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {hash} from '../src/store.mjs';
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function validateDatabase(db){
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Database integrity check failed.');
  for(const table of ['instances','budget','calls'])if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))throw new Error('Not a Mara database.');
  for(const row of db.prepare('SELECT state FROM instances').all()){const s=JSON.parse(row.state);if(hash(s.origin)!==s.originHash)throw new Error('Instance origin integrity check failed.');}
}
export async function snapshot(source,destination){
  if(!existsSync(source))throw new Error('Source database does not exist.');
  if(existsSync(destination))throw new Error('Choose a new destination directory.');
  const db=new DatabaseSync(source,{readOnly:true});
  try{
    validateDatabase(db);mkdirSync(destination,{recursive:false,mode:0o700});
    const file=join(destination,'personas.sqlite');await backup(db,file);
    const manifest={schema:1,createdAt:new Date().toISOString(),file:'personas.sqlite',sha256:digest(file)};
    writeFileSync(join(destination,'snapshot.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});return {directory:destination,...manifest};
  }finally{db.close();}
}
export async function restore(source,destination){
  const manifest=JSON.parse(readFileSync(join(source,'snapshot.json'),'utf8'));
  if(manifest.schema!==1||manifest.file!=='personas.sqlite'||digest(join(source,manifest.file))!==manifest.sha256)throw new Error('Snapshot checksum does not match.');
  return snapshot(join(source,manifest.file),destination);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [mode,source,destination]=process.argv.slice(2),root=fileURLToPath(new URL('../',import.meta.url));
  try {
    let result;
    if(mode==='backup'&&source&&!destination)result=await snapshot(resolve(process.env.EVOLVING_DB||resolve(root,'data/personas.sqlite')),resolve(source));
    else if(mode==='restore'&&source&&destination)result=await restore(resolve(source),resolve(destination));
    else throw new Error('Usage: npm run backup -- NEW_DIRECTORY or npm run restore -- SNAPSHOT_DIRECTORY NEW_DIRECTORY');
    console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
