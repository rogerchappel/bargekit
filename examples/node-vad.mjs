import { createBargeKit, SYNTHETIC_FIXTURES, runFixture } from '../src/index.js';

const barge = createBargeKit({ mode: 'vad' });
barge.on('bargekit.user_speech.started', (event) => {
  console.log(`speech started at ${event.startedAt}ms`);
});
barge.on('bargekit.user_speech.ended', (event) => {
  console.log(`speech ended after ${event.durationMs}ms`);
});

const transcript = runFixture(barge, SYNTHETIC_FIXTURES.long_utterance);
console.log(`captured ${transcript.length} turn-taking events`);
