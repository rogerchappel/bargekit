import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNTHETIC_FIXTURES, analyzeFixtureForThresholds, createBargeKit, createTuningReport, runFixture } from '../src/index.js';

test('synthetic fixture catalog covers quiet room, noise, utterances, echo, and interruption timing', () => {
  assert.deepEqual(Object.keys(SYNTHETIC_FIXTURES), [
    'quiet_room',
    'keyboard_noise',
    'short_utterance',
    'long_utterance',
    'speaker_echo',
    'interruption_timing'
  ]);
});

test('fixture runner produces transcript entries for speech and noise', () => {
  const engine = createBargeKit({ minSpeechMs: 80, debounceMs: 40, silenceMs: 100, cooldownMs: 40 });
  const transcript = runFixture(engine, SYNTHETIC_FIXTURES.long_utterance);

  assert.ok(transcript.some((entry) => entry.event.type === 'bargekit.user_speech.started'));
  assert.ok(transcript.some((entry) => entry.event.type === 'bargekit.user_speech.ended'));
});

test('tuning analysis explains threshold decisions and suggests a profile', () => {
  const analysis = analyzeFixtureForThresholds(SYNTHETIC_FIXTURES.keyboard_noise, {
    speechThreshold: 0.6,
    noiseFloorThreshold: 0.18
  });

  assert.equal(analysis.speechFrames, 0);
  assert.match(analysis.explanation, /No speech crossed/);
  assert.ok(analysis.suggestedProfile);
});

test('tuning report aggregates multiple fixture analyses', () => {
  const report = createTuningReport([
    SYNTHETIC_FIXTURES.quiet_room,
    SYNTHETIC_FIXTURES.interruption_timing
  ]);

  assert.equal(report.length, 2);
  assert.equal(report[1].fixture, 'interruption_timing');
});
