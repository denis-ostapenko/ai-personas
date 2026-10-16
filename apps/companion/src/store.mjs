import { mkdir, readFile, readdir, rm, chmod, access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { AppError } from './core.mjs';

const schema=`
  PRAGMA journal_mode=DELETE;
  PRAGMA secure_delete=ON;
  CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS fact_versions (id TEXT PRIMARY KEY, status TEXT NOT NULL, source_id TEXT, replaces_id TEXT, ordinal INTEGER, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS episodes (id TEXT PRIMARY KEY, chat_id TEXT, source_id TEXT, ordinal INTEGER, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reaction_cells (id TEXT PRIMARY KEY, core_hash TEXT, ordinal INTEGER, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, source_id TEXT, from_id TEXT, to_id TEXT, relation TEXT, ordinal INTEGER, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS affect_events (id TEXT PRIMARY KEY, chat_id TEXT, source_id TEXT, created_at TEXT, ordinal INTEGER, data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS fact_status ON fact_versions(status);
  CREATE INDEX IF NOT EXISTS affect_event_source ON affect_events(source_id);
  CREATE INDEX IF NOT EXISTS episode_chat ON episodes(chat_id);
  CREATE INDEX IF NOT EXISTS link_from ON links(from_id,relation);
  CREATE INDEX IF NOT EXISTS link_to ON links(to_id,relation);
  PRAGMA user_version=2;
`;
export class PersonaStore {
  constructor(directory) { this.directory=directory; this.busy=new Set(); }
  validateOwner(owner) { if(!/^[a-f0-9]{64}$/.test(owner))throw new AppError(404,'not_found','Persona not found.'); }
  file(owner) { this.validateOwner(owner);return path.join(this.directory,'profiles',owner,'memories.sqlite'); }
  legacyFile(owner) { this.validateOwner(owner);return path.join(this.directory,`${owner}.json`); }
  async get(owner) {
    const file=this.file(owner);
    try { await access(file); }
    catch(e) { if(e.code!=='ENOENT')throw e;return this.legacy(owner); }
    const db=new DatabaseSync(file,{readOnly:true});
    try {
      const row=db.prepare('SELECT data FROM profile WHERE id=1').get();
      if(!row)return this.legacy(owner);
      const state=JSON.parse(row.data);
      const rows=table=>db.prepare(`SELECT data FROM ${table} ORDER BY ordinal`).all().map(r=>JSON.parse(r.data));
      state.memories=rows('fact_versions');
      if(state.runtime){state.runtime.episodes=rows('episodes');state.runtime.edges=rows('links');state.runtime.cells=rows('reaction_cells');
        // Databases written before v0.4 have no affect log yet; reading never creates it.
        if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='affect_events'").get())state.runtime.affectEvents=rows('affect_events');}
      return state;
    } finally { db.close(); }
  }
  async legacy(owner) {
    try {return JSON.parse(await readFile(this.legacyFile(owner),'utf8'));}
    catch(e){if(e.code==='ENOENT')return null;throw e;}
  }
  async save(owner,state) {
    // All tables advance in one transaction. Capacity never silently evicts episodes.
    if(Buffer.byteLength(JSON.stringify(state))>32_000_000)throw new AppError(413,'storage_limit','This persona has reached its 32 MB local record limit. Export it before removing older records.');
    const file=this.file(owner);await mkdir(path.dirname(file),{recursive:true,mode:0o700});
    const db=new DatabaseSync(file,{timeout:5000});await chmod(file,0o600);
    try {
      db.exec(schema);db.exec('BEGIN IMMEDIATE');
      const profile=structuredClone(state);delete profile.memories;
      if(profile.runtime){delete profile.runtime.episodes;delete profile.runtime.edges;delete profile.runtime.cells;delete profile.runtime.affectEvents;}
      db.prepare('INSERT OR REPLACE INTO profile VALUES (1,?)').run(JSON.stringify(profile));
      for(const table of ['fact_versions','episodes','reaction_cells','links','affect_events'])db.exec(`DELETE FROM ${table}`);
      const fact=db.prepare('INSERT INTO fact_versions VALUES (?,?,?,?,?,?)');
      (state.memories||[]).forEach((m,i)=>fact.run(m.id,m.status,m.sourceId||null,m.replacesId||null,i,JSON.stringify(m)));
      const episode=db.prepare('INSERT INTO episodes VALUES (?,?,?,?,?)');
      (state.runtime?.episodes||[]).forEach((e,i)=>episode.run(e.id,e.chatId||null,e.sourceId||null,i,JSON.stringify(e)));
      const cell=db.prepare('INSERT INTO reaction_cells VALUES (?,?,?,?)');
      (state.runtime?.cells||[]).forEach((c,i)=>cell.run(c.id,c.coreHash||null,i,JSON.stringify(c)));
      const link=db.prepare('INSERT INTO links VALUES (?,?,?,?,?,?,?)');
      (state.runtime?.edges||[]).forEach((e,i)=>link.run(e.id||`legacy:${i}`,e.sourceId||null,e.from,e.to,e.type,i,JSON.stringify(e)));
      const affect=db.prepare('INSERT INTO affect_events VALUES (?,?,?,?,?,?)');
      (state.runtime?.affectEvents||[]).forEach((e,i)=>affect.run(e.id,e.chatId||null,e.sourceId||null,e.createdAt||null,i,JSON.stringify(e)));
      db.exec('COMMIT');
    } catch(error) {if(db.isTransaction)db.exec('ROLLBACK');throw error;}
    finally {db.close();}
  }
  async exclusive(owner,fn) {
    if(this.busy.has(owner))throw new AppError(409,'busy','This persona is already being updated. Please wait.');
    this.busy.add(owner);try{return await fn();}finally{this.busy.delete(owner);}
  }
  async owners() {
    const list=async dir=>{try{return await readdir(dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}};
    const legacy=(await list(this.directory)).filter(x=>/^[a-f0-9]{64}\.json$/.test(x)).map(x=>x.slice(0,-5));
    const current=(await list(path.join(this.directory,'profiles'))).filter(x=>/^[a-f0-9]{64}$/.test(x));
    return [...new Set([...legacy,...current])];
  }
  async remove(owner) {await rm(path.dirname(this.file(owner)),{recursive:true,force:true});await rm(this.legacyFile(owner),{force:true});}
}
