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
const staleCoreExamples = ['EVENTS.userSpeechStarted', 'setPushToTalk(', 'triggerWake('];

for (const example of staleCoreExamples) {
  if (apiDocs.includes(example)) {
    throw new Error(`docs/API.md references unsupported core API: ${example}`);
  }
}

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
  const documentedNames = new Map();
  for (const match of apiDocs.matchAll(/import\s*{([^}]+)}\s*from\s*['"](@bargekit\/core(?:\/[^'"]+)?)['"]/g)) {
    const names = match[1].split(',').map((name) => name.trim()).filter(Boolean);
    documentedNames.set(match[2], [...(documentedNames.get(match[2]) ?? []), ...names]);
  }
  writeFileSync(join(consumerDir, 'verify.mjs'), `
const documentedNames = new Map(${JSON.stringify([...documentedNames])});
for (const [specifier, names] of documentedNames) {
  const module = await import(specifier);
  for (const name of names) {
    if (!(name in module)) throw new Error(\`\${specifier} does not export \${name}\`);
  }
}
const { createBargeKit } = await import('@bargekit/core');
const engine = createBargeKit({ mode: 'vad' });
for (const method of ['on', 'ingestLevel', 'press', 'release', 'detectWake']) {
  if (typeof engine[method] !== 'function') throw new Error(\`BargeKitEngine does not provide \${method}()\`);
}
const unsubscribe = engine.on('bargekit.user_speech.started', () => {});
if (typeof unsubscribe !== 'function') throw new Error('BargeKitEngine.on() must return an unsubscribe function');
unsubscribe();
`);
  execFileSync('node', ['verify.mjs'], { cwd: consumerDir, stdio: 'inherit' });

  console.log(`verified documented imports from packed tarball: ${documentedImports.join(', ')}`);
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
}
