import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRoot = new URL('..', import.meta.url);
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const escapedName = pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const registryInstall = new RegExp(`npm\\s+(?:i|install)\\s+${escapedName}(?:[@\\s]|$)`);
const expectedTarball = `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`;

if (!readme.includes(`${pkg.name}\` is **not published to npm yet**`)) {
  throw new Error(`README.md must prominently state that ${pkg.name} is not published`);
}
if (registryInstall.test(readme)) {
  throw new Error(`README.md presents unavailable registry package ${pkg.name} as installable`);
}
for (const command of [
  'npm --prefix bargekit ci',
  'npm pack ./bargekit',
  `npm install ./${expectedTarball}`
]) {
  if (!readme.includes(command)) {
    throw new Error(`README.md is missing verified install command: ${command}`);
  }
}

const consumerDir = mkdtempSync(join(tmpdir(), 'bargekit-install-docs-'));

try {
  const packResult = JSON.parse(execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', consumerDir],
    { cwd: projectRoot, encoding: 'utf8' }
  ));
  const tarballPath = join(consumerDir, packResult[0].filename);

  if (packResult[0].filename !== expectedTarball) {
    throw new Error(`README tarball ${expectedTarball} does not match ${packResult[0].filename}`);
  }

  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath],
    { cwd: consumerDir, stdio: 'inherit' }
  );
  execFileSync(
    'node',
    ['--input-type=module', '--eval', `await import(${JSON.stringify(pkg.name)})`],
    { cwd: consumerDir, stdio: 'inherit' }
  );

  console.log(`verified README installation from ${packResult[0].filename}`);
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
}
