import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors.mjs';

export class CaseStore {
  constructor(directory) { this.directory = directory; this.busy = new Set(); }
  file(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new AppError(404, 'case_not_found', 'Case not found.');
    return path.join(this.directory, `${id}.json`);
  }
  async get(id, owner) {
    let item;
    try { item = JSON.parse(await readFile(this.file(id), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') throw new AppError(404, 'case_not_found', 'Case not found.'); throw e; }
    if (item.owner !== owner) throw new AppError(404, 'case_not_found', 'Case not found.');
    return item;
  }
  async save(item) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const dest = this.file(item.id), temp = `${dest}.${randomUUID()}.tmp`;
    const saved=structuredClone(item);
    if(saved.report)delete saved.report.directory;
    try { await writeFile(temp, JSON.stringify(saved), { mode: 0o600, flag: 'wx' }); await rename(temp, dest); }
    finally { await unlink(temp).catch(() => {}); }
  }
  async remove(id, owner) { await this.get(id, owner); await unlink(this.file(id)); }
  async exclusive(id, action) {
    if (this.busy.has(id)) throw new AppError(409, 'case_busy', 'This case is already being updated. Please wait.');
    this.busy.add(id); try { return await action(); } finally { this.busy.delete(id); }
  }
}
export function publicCase(item) {
  const { owner, sourcePages, ...result } = item;
  if (result.memory) { const { changes, ...memory } = result.memory; result.memory = memory; }
  return result;
}
