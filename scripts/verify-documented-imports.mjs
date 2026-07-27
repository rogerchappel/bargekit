import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRoot = new URL('..', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const apiDocs = readFileSync(new URL('../docs/API.md', import.meta.url), 'utf8');
const documentedImports = [
  ...new Set(
    [...apiDocs.matchAll(/\bfrom\s+['"](@bargekit\/core(?:\/[^'"]+)?)['"]/g)]
      .map((match) => match[1])
  )
];

if (documentedImports.length === 0) {
  throw new Error('docs/API.md does not contain any @bargekit/core imports');
}

const consumerDir = mkdtempSync(join(tmpdir(), 'bargekit-package-consumer-'));

try {
  const packResult = JSON.parse(execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', consumerDir],
    { cwd: projectRoot, encoding: 'utf8' }
  ));
  const packed = packResult[0];
  const packedPaths = new Set(packed.files.map((file) => file.path));

  for (const specifier of documentedImports) {
    const subpath = specifier.slice(packageJson.name.length) || '.';
    const exportKey = subpath === '.' ? '.' : `.${subpath}`;
    const target = packageJson.exports?.[exportKey];

    if (!target) {
      throw new Error(`${specifier} is documented but missing from package.json exports`);
    }
    if (!packedPaths.has(target.replace(/^\.\//, ''))) {
      throw new Error(`${specifier} targets ${target}, which is missing from the packed tarball`);
    }
  }

  const tarballPath = join(consumerDir, packed.filename);
  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify({ private: true, type: 'module' })
  );
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath],
    { cwd: consumerDir, stdio: 'inherit' }
  );
  writeFileSync(
    join(consumerDir, 'verify.mjs'),
    `await Promise.all(${JSON.stringify(documentedImports)}.map((specifier) => import(specifier)));\n`
  );
  execFileSync('node', ['verify.mjs'], { cwd: consumerDir, stdio: 'inherit' });

  console.log(`verified documented imports from packed tarball: ${documentedImports.join(', ')}`);
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
}
