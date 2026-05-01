import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const folder of ['src', 'demo']) {
  if (!existsSync(join(root, folder))) {
    continue;
  }

  cpSync(join(root, folder), join(distDir, folder), { recursive: true, force: true, errorOnExist: false });
}

for (const file of ['README.md', 'LICENSE']) {
  cpSync(join(root, file), join(distDir, file), { force: true });
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
packageJson.private = false;
packageJson.files = ['src', 'demo', 'README.md', 'LICENSE'];
writeFileSync(join(distDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('Build output written to dist/.');
