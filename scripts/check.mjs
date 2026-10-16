import { readdir,readFile,access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error(`Unexpected symlink: ${p}`);if(entry.isDirectory())result.push(...await walk(p));else result.push(p);}return result;}
const files=await walk('.'),errors=[];
for(const file of files) {
 const data=await readFile(file);
 if(/\.(mjs|js)$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status)errors.push(`${file}: syntax failure`);}
 if(file.endsWith('.json'))try{JSON.parse(data);}catch{errors.push(`${file}: invalid JSON`);}
 if(file.endsWith('.md'))for(const match of data.toString().matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+?)(?:#[^)]*)?\)/g)) {
  const target=path.resolve(path.dirname(file),decodeURIComponent(match[1]));
  if(!target.startsWith(process.cwd()+path.sep))errors.push(`${file}: link leaves package`);
  try{await access(target);}catch{errors.push(`${file}: broken link ${match[1]}`);}
 }
 if(!/\.jpg$/.test(file)) {
  const text=data.toString();
  if(/\/Users\/|\/home\/[a-z][a-z0-9_-]*\//i.test(text))errors.push(`${file}: personal absolute path`);
  if(/sk-(?:proj-)?[A-Za-z0-9_-]{24,}|tvly-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))errors.push(`${file}: credential pattern`);
 }
 if(/(?:^|\/)(?:profiles|data|node_modules)\/|\.sqlite(?:-|$)|\.api-keys$|(?:^|\/)\.env$/.test(file))errors.push(`${file}: forbidden artifact`);
}
const manifest=JSON.parse(await readFile('release-manifest.json','utf8'));
for(const entry of manifest.files){const data=await readFile(entry.path);if(createHash('sha256').update(data).digest('hex')!==entry.sha256)errors.push(`${entry.path}: differs from exported manifest`);}
const declared=new Set(manifest.files.map(f=>f.path));
for(const file of files)if(file!=='release-manifest.json'&&!declared.has(file))errors.push(`${file}: absent from manifest`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Checked ${files.length} files: syntax, JSON, links, manifest and credential/data patterns passed.`);
