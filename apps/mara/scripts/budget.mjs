import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),path=resolve(process.env.EVOLVING_DB||resolve(root,'data/personas.sqlite'));
try {
  if(!existsSync(path))throw new Error('Start Mara once to create the database.');
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--limit'))throw new Error('Usage: npm run budget -- [--limit TOTAL]');
  const store=new Store(path);
  try{console.log(JSON.stringify(args.length?store.setCallLimit(Number(args[1])):store.budget(),null,2));}finally{store.close();}
}catch(error){console.error(error.message);process.exitCode=1;}
