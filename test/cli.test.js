import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('cli help documents non-recording local commands', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /bargekit fixtures/);
  assert.match(result.stdout, /bargekit tune/);
  assert.match(result.stdout, /No command records audio/);
});

test('cli smokes a checked-in fixture file', () => {
  const result = runCli(['smoke', '--fixture', 'tests/fixtures/interruption_timing.json', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fixture, 'interruption_timing');
  assert.equal(payload.speechStarted, true);
  assert.equal(payload.passed, true);
});

test('cli reports the fixture file and invalid sample chronology', (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'bargekit-cli-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixturePath = join(directory, 'reversed.json');
  writeFileSync(fixturePath, JSON.stringify({
    name: 'reversed',
    samples: [{ timestamp: 20, level: 0.2 }, { timestamp: 0, level: 0.3 }]
  }));

  const result = runCli(['smoke', '--fixture', fixturePath, '--json']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reversed\.json: sample 1 timestamp 0 must be greater than sample 0 timestamp 20/);
});

test('cli smokes a built-in fixture by name for installed users', () => {
  const result = runCli(['smoke', '--name', 'interruption_timing', '--json']);
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

test('cli tune can use bundled fixtures without file paths', () => {
  const result = runCli(['tune', '--profile', 'wired_headset', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.some((item) => item.fixture === 'interruption_timing'));
  assert.ok(report.every((item) => Number.isFinite(item.peakLevel)));
});
