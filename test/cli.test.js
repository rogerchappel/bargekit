import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function runCli(args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    encoding: 'utf8'
  });
}

test('cli lists built-in fixtures as json', () => {
  const result = runCli(['fixtures', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const fixtures = JSON.parse(result.stdout);
  assert.ok(fixtures.some((fixture) => fixture.name === 'interruption_timing'));
});

test('cli smokes a checked-in fixture file', () => {
  const result = runCli(['smoke', '--fixture', 'tests/fixtures/interruption_timing.json', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fixture, 'interruption_timing');
  assert.equal(payload.speechStarted, true);
  assert.equal(payload.passed, true);
});

test('cli tune can analyze a fixture file', () => {
  const result = runCli(['tune', '--fixture', 'tests/fixtures/long_utterance.json', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report[0].fixture, 'long_utterance');
  assert.ok(report[0].speechFrames > 0);
});
