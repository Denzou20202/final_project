#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

process.env.TS_NODE_PROJECT = 'libs/database/tsconfig.lib.json';

const args = process.argv.slice(2);
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['typeorm-ts-node-esm', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
