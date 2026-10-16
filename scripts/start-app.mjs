import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const names = { persona: 'companion', advisor: 'home-repair-advisor', mara: 'mara' };
const selected = names[process.argv[2]];
if (!selected || Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Use Node.js 24 or later: node scripts/start-app.mjs persona|advisor|mara');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/server.mjs'], {
  cwd: path.join(root, 'apps', selected), env: process.env, stdio: 'inherit'
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
