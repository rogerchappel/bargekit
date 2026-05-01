import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'test', 'scripts', 'demo'];

for (const root of roots) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || (!entry.name.endsWith('.js') && !entry.name.endsWith('.mjs'))) {
      continue;
    }

    execFileSync(process.execPath, ['--check', join(root, entry.name)], { stdio: 'inherit' });
  }
}

console.log('Syntax check passed.');
