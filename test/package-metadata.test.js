import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('package metadata is ready for local-first OSS consumption', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.name, '@bargekit/core');
  assert.equal(pkg.bin.bargekit, './src/cli.js');
  assert.ok(pkg.repository.url.includes('rogerchappel/bargekit'));
  assert.ok(pkg.exports['./web']);
  assert.ok(pkg.files.includes('examples'));
});
