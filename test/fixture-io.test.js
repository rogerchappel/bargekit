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

test('fixture io rejects samples that do not advance in time', () => {
  const fixture = { name: 'reversed', samples: [{ timestamp: 20, level: 0.2 }, { timestamp: 10, level: 0.3 }] };
  assert.throws(() => normalizeFixtureDocument(fixture, 'reversed.json'), /reversed\.json: sample 1 timestamp 10 must be greater than sample 0 timestamp 20/);
});

test('fixture io rejects invalid aggregate timing', () => {
  const samples = [{ timestamp: 0, level: 0.2 }, { timestamp: 20, level: 0.3 }];
  assert.throws(() => normalizeFixtureDocument({ name: 'bad-frame', frameMs: 0, samples }, 'frame.json'), /frame\.json: frameMs must be greater than 0/);
  assert.throws(() => normalizeFixtureDocument({ name: 'bad-total', totalMs: -1, samples }, 'negative.json'), /negative\.json: totalMs must be nonnegative/);
  assert.throws(() => normalizeFixtureDocument({ name: 'short-total', totalMs: 10, samples }, 'short.json'), /short\.json: totalMs 10 precedes final sample 1 timestamp 20/);
});

test('fixture io rejects baselines outside the level range', () => {
  const fixture = { name: 'bad-baseline', baseline: 1.1, samples: [{ timestamp: 0, level: 0.2 }] };
  assert.throws(() => normalizeFixtureDocument(fixture, 'baseline.json'), /baseline\.json: baseline must be between 0 and 1/);
});
