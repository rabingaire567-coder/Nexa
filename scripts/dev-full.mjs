/**
 * Runs the Nexa API and the Vite dev server together with one command.
 * Run: npm run dev:full
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [];

function run(name, args, colour) {
  const child = spawn(NPM, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = `\x1b[${colour}m[${name}]\x1b[0m`;
  const pipe = (stream) => {
    stream.setEncoding('utf8');
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) console.log(`${tag} ${line}`);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    console.log(`${tag} exited with code ${code}`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const c of children) {
    if (!c.killed) c.kill();
  }
  setTimeout(() => process.exit(code), 150);
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(0));

run('api', ['run', 'server'], '35');
run('web', ['run', 'dev'], '36');

console.log('\n  Nexa dev → http://localhost:5173   (API on :8787)\n');