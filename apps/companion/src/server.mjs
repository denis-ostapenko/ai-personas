import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AppError, hash } from './core.mjs';
import { PersonaStore } from './store.mjs';
import { Persona } from './persona.mjs';
import { OpenAIProvider } from './provider.mjs';
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
async function body(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw new AppError(415,'content_type','Send JSON.');
  let size=0;const chunks=[];
  for await(const chunk of req) {size+=chunk.length;if(size>24000)throw new AppError(413,'too_large','This request is too large.');chunks.push(chunk);}
  let value;try{value=JSON.parse(Buffer.concat(chunks));}catch{throw new AppError(400,'invalid_json','The request could not be read.');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError(400,'invalid_json','Send a JSON object.');
  return value;
}
export function createServer({persona,configured=true}) {
  let active=0;const hits=new Map();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    let busy=false;
    try {
      const host=req.headers.host||'';
      if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new AppError(403,'host','Use the local persona address.');
      if((req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers['sec-fetch-site']==='cross-site')throw new AppError(403,'origin','Open this request from the local persona.');
      const pathname=new URL(req.url,`http://${host}`).pathname;
      if(req.method==='GET'&&Object.hasOwn(assets,pathname)){const [file,type]=assets[pathname];res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`});res.end(await readFile(path.join(publicDir,file)));return;}
      if(req.method==='GET'&&pathname==='/api/health'){json(200,{status:'ok',name:'Persona',version:'0.4.1',configured,mode:'local'});return;}
      if(!pathname.startsWith('/api/'))throw new AppError(404,'not_found','Not found.');
      const cookie=/(?:^|;\s*)companion_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
      const token=cookie?.[1]||randomBytes(32).toString('hex'),owner=hash(token);
      if(!cookie)res.setHeader('Set-Cookie',`companion_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);
      if(req.method==='GET'&&pathname==='/api/state'){json(200,{state:await persona.read(owner),configured});return;}
      if(req.method==='GET'&&pathname==='/api/export'){
        res.setHeader('Content-Disposition','attachment; filename="persona-export.json"');json(200,await persona.read(owner));return;
      }
      if(req.method!=='POST'||pathname!=='/api/action'||req.headers['x-persona-client']!=='1')throw new AppError(404,'not_found','Not found.');
      if(active>=3)throw new AppError(429,'busy','The persona is busy. Please try again shortly.');
      const recent=(hits.get(owner)||[]).filter(t=>Date.now()-t<3600000);
      if(recent.length>=180)throw new AppError(429,'limit','The local hourly request limit has been reached.');
      hits.set(owner,[...recent,Date.now()]);
      if(hits.size>1000)for(const [k,t]of hits)if(!t.some(v=>Date.now()-v<3600000))hits.delete(k);
      active++;busy=true;json(200,{state:await persona.act(owner,await body(req)),configured});
    } catch(error) {
      if(!(error instanceof AppError))console.error(JSON.stringify({event:'request_error',type:error.name}));
      if(!res.headersSent)json(error instanceof AppError?error.status:500,{error:{code:error.code||'internal',message:error instanceof AppError?error.message:'The operation failed. Your previously saved persona is preserved.'}});
      else res.end();
    } finally {if(busy)active--;}
  });
  server.requestTimeout=120000;server.headersTimeout=15000;
  return server;
}
async function acquireLock(directory) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const lock=path.join(directory,'.server.lock');
  for(let attempt=0;attempt<2;attempt++) {
    try {const file=await open(lock,'wx',0o600);await file.writeFile(String(process.pid));await file.close();return ()=>unlink(lock).catch(()=>{});}
    catch(e) {
      if(e.code!=='EEXIST')throw e;
      const pid=Number(await readFile(lock,'utf8'));let running=true;
      try{process.kill(pid,0);}catch(err){if(err.code==='ESRCH')running=false;}
      if(running||!Number.isSafeInteger(pid)||pid<1)throw new Error('This persona data directory is already in use.');
      await unlink(lock);
    }
  }
  throw new Error('Could not acquire persona storage.');
}
export async function start(env=process.env) {
  const port=Number(env.PERSONA_COMPANION_PORT||4346);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port.');
  const directory=env.PERSONA_COMPANION_DATA_DIR||path.join(os.homedir(),'Library','Application Support','AI Personas','conversation-persona');
  const maxCalls=Number(env.PERSONA_COMPANION_MAX_CALLS||120);
  if(!Number.isInteger(maxCalls)||maxCalls<1)throw new Error('Invalid PERSONA_COMPANION_MAX_CALLS.');
  const release=await acquireLock(directory);
  const store=new PersonaStore(directory),provider=new OpenAIProvider({key:env.OPENAI_API_KEY,model:env.PERSONA_COMPANION_MODEL,reasoning:env.PERSONA_COMPANION_REASONING,maxCalls});
  // Appraisal is a classification step; it may use a faster model than the dialogue.
  const appraisalOptions=Object.fromEntries([['model',env.PERSONA_COMPANION_APPRAISAL_MODEL],['reasoning',env.PERSONA_COMPANION_APPRAISAL_REASONING]].filter(([,v])=>v));
  const persona=new Persona({store,provider,appraisalOptions}),server=createServer({persona,configured:!!env.OPENAI_API_KEY});
  let ticking=false;
  const timer=setInterval(async()=>{if(ticking)return;ticking=true;try{await persona.tick();}catch{console.error('{"event":"scheduler_error"}');}finally{ticking=false;}},60000);timer.unref();
  server.on('close',()=>{clearInterval(timer);void release();});
  server.once('error',()=>{clearInterval(timer);void release();});
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>process.exit(0)));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  console.log(`Persona: http://127.0.0.1:${port}`);
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)start().catch(e=>{console.error(e.message);process.exitCode=1;});
