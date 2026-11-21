import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npx = isWindows ? 'npx.cmd' : 'npx';
const server = spawn(process.execPath, ['server/index.js'], { stdio: 'inherit' });
const vite = spawn(npx, ['vite', '--host', '0.0.0.0'], { stdio: 'inherit', shell: isWindows });
const stop = () => { server.kill('SIGTERM'); vite.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('exit', code => { if (code && code !== 0) { vite.kill('SIGTERM'); process.exit(code); } });
vite.on('exit', code => { server.kill('SIGTERM'); process.exitCode = code || 0; });
