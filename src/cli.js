#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBargeKit } from './core.js';
import { PRESET_PROFILES } from './contracts.js';
import { SYNTHETIC_FIXTURES, createTuningReport, runFixture } from './fixtures.js';
import { loadFixtureFile } from './fixture-io.js';

const commands = new Map([
  ['demo', runDemo],
  ['fixtures', runFixtures],
  ['tune', runTune],
  ['smoke', runSmoke],
  ['help', runHelp],
  ['--help', runHelp],
  ['-h', runHelp]
]);

function parseArgs(argv) {
  const args = [];
  const flags = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      args.push(item);
      continue;
    }

    const [key, inlineValue] = item.slice(2).split('=');
    if (inlineValue !== undefined) {
      flags.set(key, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }

  return { args, flags };
}

function print(value, json = false) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  console.log(value);
}

function loadSelectedFixture(flags) {
  const fixturePath = flags.get('fixture');
  if (fixturePath) {
    const absolutePath = resolve(String(fixturePath));
    if (!existsSync(absolutePath)) {
      throw new Error(`Fixture file not found: ${absolutePath}`);
    }
    return loadFixtureFile(absolutePath);
  }

  const fixtureName = String(flags.get('name') ?? 'interruption_timing');
  const fixture = SYNTHETIC_FIXTURES[fixtureName];
  if (!fixture) {
    throw new Error(`Unknown fixture: ${fixtureName}`);
  }
  return fixture;
}

function runHelp() {
  console.log(`bargekit\n\nUsage:\n  bargekit demo [--json]\n  bargekit fixtures [--json]\n  bargekit tune [--fixture path/to/fixture.json] [--profile laptop_speakers] [--json]\n  bargekit smoke [--fixture path/to/fixture.json] [--json]\n\nNo command records audio or opens the microphone.`);
}

function runDemo({ flags }) {
  print({
    open: 'demo/index.html',
    server: 'python3 -m http.server 4173',
    url: 'http://localhost:4173/demo/',
    privacy: 'microphone access is requested only from the browser demo after a user gesture'
  }, flags.get('json'));
}

function runFixtures({ flags }) {
  const fixtures = Object.values(SYNTHETIC_FIXTURES).map((fixture) => ({
    name: fixture.name,
    totalMs: fixture.totalMs,
    samples: fixture.samples.length,
    segments: fixture.segments.map((segment) => segment.label)
  }));
  print(fixtures, flags.get('json'));
}

function runTune({ flags }) {
  const fixture = flags.has('fixture') ? loadSelectedFixture(flags) : null;
  const profileName = flags.get('profile');
  const overrides = profileName ? PRESET_PROFILES[profileName] : {};
  if (profileName && !overrides) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  const report = createTuningReport(fixture ? [fixture] : Object.values(SYNTHETIC_FIXTURES), overrides);
  print(report, flags.get('json'));
}

function runSmoke({ flags }) {
  const fixture = loadSelectedFixture(flags);
  const engine = createBargeKit({ mode: 'vad' });
  const transcript = runFixture(engine, fixture);
  const speechStarted = transcript.some((entry) => entry.event.type === 'bargekit.user_speech.started');
  const bargeRequested = transcript.some((entry) => entry.event.type === 'bargekit.barge_in.requested');
  const result = {
    fixture: fixture.name,
    transcriptEvents: transcript.length,
    speechStarted,
    bargeRequested,
    passed: speechStarted
  };

  if (!result.passed) {
    print(result, flags.get('json'));
    process.exitCode = 1;
    return;
  }

  print(result, flags.get('json'));
}

export async function main(argv = process.argv.slice(2)) {
  const [command = 'help', ...rest] = argv;
  const handler = commands.get(command);
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }

  const parsed = parseArgs(rest);
  await handler(parsed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`bargekit: ${error.message}`);
    process.exitCode = 1;
  });
}
