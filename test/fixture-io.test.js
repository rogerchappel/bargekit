import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixtureFile, normalizeFixtureDocument } from '../src/fixture-io.js';

test('fixture io loads checked-in json fixtures', () => {
  const fixture = loadFixtureFile('tests/fixtures/interruption_timing.json');
  assert.equal(fixture.name, 'interruption_timing');
  assert.ok(fixture.samples.length > 10);
  assert.equal(fixture.frameMs, 20);
});

test('fixture io rejects invalid levels', () => {
  assert.throws(() => normalizeFixtureDocument({ name: 'bad', samples: [{ timestamp: 0, level: 2 }] }), /between 0 and 1/);
});
