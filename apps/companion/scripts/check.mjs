import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
for(const dir of ['src','public','scripts','tests']) for(const file of await readdir(dir)) {
  if(!/\.(mjs|js)$/.test(file))continue;
  const r=spawnSync(process.execPath,['--check',`${dir}/${file}`],{stdio:'inherit'});
  if(r.status)process.exit(r.status);
}
console.log('JavaScript syntax checks passed.');
for(const file of ['persona/identity.json','persona/temperament.json','persona/expression.json'])JSON.parse(await readFile(file,'utf8'));
console.log('Authored persona JSON parses.');
// Relative Markdown links inside this persona directory must resolve.
async function markdown(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await markdown(p));else if(e.name.endsWith('.md'))out.push(p);}return out;}
const broken=[];
for(const file of await markdown('.')) {
  const text=await readFile(file,'utf8');
  for(const m of text.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+?)(?:#[^)]*)?\)/g)){
    const target=path.resolve(path.dirname(file),decodeURIComponent(m[1]));
    try{await access(target);}catch{broken.push(`${file} -> ${m[1]}`);}
  }
}
if(broken.length){console.error(`Broken relative links:\n${broken.join('\n')}`);process.exit(1);}
console.log('Relative Markdown links resolve.');
