import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CaseStore, publicCase } from './store.mjs';
import { Advisor, identity } from './advisor.mjs';
import { createProvider } from './providers/openai.mjs';
import { TavilySearch } from './providers/tavily.mjs';
import { GooglePlaces } from './providers/google-places.mjs';
import { AppError } from './errors.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
const assets = new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AppError(415,'content_type','Send JSON.');
  let length = 0; const chunks=[];
  for await (const chunk of req) { length += chunk.length; if (length > 9_100_000) throw new AppError(413,'too_large','This upload is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError(400,'invalid_json','The request could not be read.'); }
}
export function createServer({ advisor, store, configured = {}, model = 'unknown' }) {
  let active = 0; let hourly = [];
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
    let busy = false;
    try {
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw new AppError(403,'invalid_host','Use the local application URL.');
      if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') throw new AppError(403,'invalid_origin','This request must originate from the local application.');
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const file = assets.get(url.pathname); const bytes = await readFile(path.join(publicDir,file));
        res.writeHead(200,{'Content-Type':types[path.extname(file)]}); res.end(bytes); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/health') { json(200,{ status:'ok', mode:'local', model, connections:configured, persona:{ id:identity.id, version:identity.version, name:identity.displayName } }); return; }
      const matchCookie = /(?:^|;\s*)persona_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
      const session = matchCookie?.[1] || randomBytes(32).toString('hex');
      const owner = createHash('sha256').update(session).digest('hex');
      if (!matchCookie) res.setHeader('Set-Cookie',`persona_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
      const match = /^\/api\/cases\/([a-f0-9-]+)(?:\/(messages|search))?$/.exec(url.pathname);
      if (req.method === 'GET' && match && !match[2]) { json(200,publicCase(await store.get(match[1],owner))); return; }
      if (!['POST','DELETE'].includes(req.method) || req.headers['x-persona-client'] !== '1') throw new AppError(404,'not_found','Not found.');
      if (active >= 2) throw new AppError(429,'server_busy','The advisor is busy with another request. Please try again shortly.');
      hourly = hourly.filter(t => Date.now()-t < 3600000);
      if (hourly.length >= 40) throw new AppError(429,'request_limit','The local development request limit has been reached. Try again later.');
      active++; hourly.push(Date.now()); busy = true;
      if (req.method === 'DELETE' && match && !match[2]) {
        await store.exclusive(match[1],()=>store.remove(match[1],owner)); json(200,{deleted:true}); return;
      }
      const data = await body(req);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError(400,'invalid_input','Send a JSON object.');
      if (req.method === 'POST' && url.pathname === '/api/cases') { json(201,publicCase(await advisor.create(owner,data))); return; }
      if (req.method === 'POST' && match?.[2] === 'messages') { json(200,publicCase(await advisor.reply(match[1],owner,data))); return; }
      if (req.method === 'POST' && match?.[2] === 'search') { json(200,publicCase(await advisor.find(match[1],owner,data.revision,data.force === true))); return; }
      throw new AppError(404,'not_found','Not found.');
    } catch (error) {
      if (!(error instanceof AppError)) console.error(JSON.stringify({ event:'request_error', type:error.name }));
      if (!res.headersSent) json(error.status || 500,{ error:{ code:error.code || 'internal_error', message:error instanceof AppError ? error.message : 'Something went wrong. Your saved case has not been discarded.' } });
      else res.end();
    } finally { if (busy) active--; }
  });
}
export function start(env = process.env) {
  const dataDir = env.PERSONA_DATA_DIR || path.join(os.homedir(),'Library','Application Support','AI Personas','home-repair-advisor');
  const store = new CaseStore(dataDir); const provider = createProvider(env); const search = new TavilySearch({ key:env.TAVILY_API_KEY });
  const advisor = new Advisor({ provider, search, store, directory:new GooglePlaces({key:env.GOOGLE_MAPS_API_KEY}) });
  const server = createServer({ advisor, store, model:provider.model, configured:{ ai:!!env.OPENAI_API_KEY, search:!!env.TAVILY_API_KEY, directory:!!env.GOOGLE_MAPS_API_KEY } });
  const port = Number(env.PERSONA_PORT || 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
  server.listen(port,'127.0.0.1',()=>console.log(`Home Repair Advisor: http://127.0.0.1:${port}`));
  server.requestTimeout = 180000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
