import {Memory} from './memory.mjs';
import {LocalEmbeddings} from './embeddings.mjs';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {Store} from './store.mjs';
import {Provider} from './provider.mjs';
import {Engine} from './engine.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const appVersion=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
export function createServer(store,engine,{configured=false}={}) {
  const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/guide':['guide.html','text/html']};
  return http.createServer(async(req,res)=>{
    const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
    try {
      const port=res.socket.localPort,allowed=[`127.0.0.1:${port}`,`localhost:${port}`];
      if(!allowed.includes(req.headers.host))return send(403,{error:'Invalid local host.'});
      if(req.headers.origin&&!allowed.map(h=>`http://${h}`).includes(req.headers.origin))return send(403,{error:'Cross-origin request refused.'});
      const url=new URL(req.url,`http://${req.headers.host}`);
      if(req.method==='GET'&&assets[url.pathname]){const [file,type]=assets[url.pathname];return send(200,readFileSync(resolve(root,'public',file)),type);}
      if(req.method==='GET'&&url.pathname==='/license')return send(200,readFileSync(resolve(root,'LICENSE'),'utf8'),'text/plain; charset=utf-8');
      if(req.method==='GET'&&url.pathname==='/api/state')return send(200,{appVersion,instances:store.list(),budget:store.budget(),configured,state:url.searchParams.has('id')?store.get(url.searchParams.get('id')):null});
      if(req.method!=='POST')return send(404,{error:'Not found.'});
      if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON is required.'});
      let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>16000)return send(413,{error:'Request too large.'});}
      const data=JSON.parse(body);
      if(url.pathname==='/api/create')return send(200,store.create(data.id,{developing:data.developing??true}));
      if(url.pathname==='/api/session')return send(200,await engine.startSession(data.id,data.partner));
      if(url.pathname==='/api/memory')return send(200,await engine.maintain(data.id,{force:true,partner:data.partner,maxBatches:3}));
      if(url.pathname==='/api/search')return send(200,await engine.search(data.id,data.partner,data.query||''));
      if(url.pathname==='/api/turn')return send(200,await engine.turn(data.id,data.text,data.partner));
      if(url.pathname==='/api/initiative')return send(200,await engine.initiate(data.id,data.partner));
      if(url.pathname==='/api/reflect')return send(200,await engine.reflect(data.id));
      if(url.pathname==='/api/rollback')return send(200,engine.rollback(data.id,data.version));
      return send(404,{error:'Not found.'});
    }catch(e){send(400,{error:e.message});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const store=new Store(process.env.EVOLVING_DB||resolve(root,'data/personas.sqlite'),{maxCalls:Number(process.env.EVOLVING_MAX_CALLS||60),model:process.env.MARA_MODEL||'gpt-6.1-sol',reasoning:process.env.MARA_REASONING||'low'});
  if(!store.list().length)store.create('mara');
  const provider=new Provider(store),embedder=new LocalEmbeddings(store);
  const engine=new Engine(store,provider,{adaptive:true,memory:new Memory(provider,{embedder})});
  let maintaining=false;const timer=setInterval(async()=>{if(maintaining)return;maintaining=true;try{await engine.maintenanceTick();}finally{maintaining=false;}},60000);timer.unref();
  const server=createServer(store,engine,{configured:!!process.env.OPENAI_API_KEY});
  const port=Number(process.env.PORT||4351);server.listen(port,'127.0.0.1',()=>console.log(`Evolving Persona: http://127.0.0.1:${port}`));
  const stop=()=>{clearInterval(timer);server.close(()=>{embedder.close();store.close();process.exit(0);});};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
