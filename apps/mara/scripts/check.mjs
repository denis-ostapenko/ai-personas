import {readdirSync,readFileSync,existsSync} from 'node:fs';import {resolve,dirname,extname} from 'node:path';import {spawnSync} from 'node:child_process';
const failures=[];
function walk(path){for(const f of readdirSync(path,{withFileTypes:true})){if(['data','evidence','node_modules','.git','.venv','__pycache__','backups','restored'].includes(f.name))continue;const full=resolve(path,f.name);if(f.isDirectory())walk(full);else {
  if(['.mjs','.js'].includes(extname(full))){const r=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});if(r.status)failures.push(r.stderr);}
  if(['.md','.mjs','.js','.html','.css'].includes(extname(full))){const text=readFileSync(full,'utf8');if(/[\u0400-\u04ff]/u.test(text))failures.push(`Unexpected Cyrillic authored text: ${full}`);
    if(extname(full)==='.md')for(const [,link] of text.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(link))continue;const target=resolve(dirname(full),link.split('#')[0]);if(!existsSync(target))failures.push(`Broken local link: ${full}: ${link}`);}}
}}}walk('.');if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Syntax, English-authored text and local Markdown links passed.');
