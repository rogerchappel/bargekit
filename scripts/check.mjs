import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'test', 'scripts', 'demo', 'examples'];

function* walk(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      yield path;
    }
  }
}

for (const root of roots) {
  for (const path of walk(root)) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  }
}

console.log('Syntax check passed.');
