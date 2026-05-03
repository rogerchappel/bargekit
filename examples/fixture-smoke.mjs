import { createBargeKit, loadFixtureFile, runFixture } from '../src/index.js';

const fixturePath = process.argv[2] ?? 'tests/fixtures/interruption_timing.json';
const fixture = loadFixtureFile(fixturePath);
const engine = createBargeKit({ mode: 'vad' });
const transcript = runFixture(engine, fixture);

console.log(JSON.stringify({
  fixture: fixture.name,
  events: transcript.length,
  speechStarted: transcript.some((entry) => entry.event.type === 'bargekit.user_speech.started')
}, null, 2));
