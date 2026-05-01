import test from 'node:test';
import assert from 'node:assert/strict';
import { createBargeKit } from '../src/index.js';

function collect(engine, eventName) {
  const events = [];
  engine.on(eventName, (event) => events.push(event));
  return events;
}

test('engine emits speech start/end around min speech and silence windows', () => {
  const engine = createBargeKit({
    mode: 'vad',
    speechThreshold: 0.55,
    noiseFloorThreshold: 0.2,
    minSpeechMs: 100,
    debounceMs: 40,
    silenceMs: 100,
    cooldownMs: 40
  });
  const starts = collect(engine, 'bargekit.user_speech.started');
  const ends = collect(engine, 'bargekit.user_speech.ended');

  engine.start(0);
  engine.ingestLevel({ timestamp: 0, level: 0.6 });
  engine.ingestLevel({ timestamp: 40, level: 0.63 });
  engine.ingestLevel({ timestamp: 100, level: 0.65 });
  engine.ingestLevel({ timestamp: 140, level: 0.62 });
  engine.ingestLevel({ timestamp: 200, level: 0.1 });
  engine.ingestLevel({ timestamp: 320, level: 0.1 });

  assert.equal(starts.length, 1);
  assert.equal(starts[0].startedAt, 0);
  assert.equal(ends.length, 1);
  assert.equal(ends[0].reason, 'vad.speech.end');
  assert.equal(engine.getSnapshot().state, 'cooldown');
});

test('engine noise-gates keyboard-like bursts below speech threshold', () => {
  const engine = createBargeKit({
    mode: 'vad',
    speechThreshold: 0.6,
    noiseFloorThreshold: 0.18,
    minSpeechMs: 100,
    debounceMs: 40,
    silenceMs: 120
  });
  const events = collect(engine, 'bargekit.input.noise_gated');

  engine.start(0);
  engine.ingestLevel({ timestamp: 0, level: 0.24 });
  engine.ingestLevel({ timestamp: 40, level: 0.22 });
  engine.ingestLevel({ timestamp: 80, level: 0.15 });

  assert.equal(events.length, 2);
  assert.ok(events.every((event) => event.level >= 0.18 && event.level < 0.6));
});

test('push-to-talk mode ignores speech until push is held', () => {
  const engine = createBargeKit({ mode: 'push_to_talk', minSpeechMs: 80, debounceMs: 40 });
  const starts = collect(engine, 'bargekit.user_speech.started');

  engine.start(0);
  engine.ingestLevel({ timestamp: 0, level: 0.8 });
  engine.ingestLevel({ timestamp: 120, level: 0.8 });
  assert.equal(starts.length, 0);

  engine.press(140);
  engine.ingestLevel({ timestamp: 140, level: 0.8 });
  engine.ingestLevel({ timestamp: 260, level: 0.8 });
  assert.equal(starts.length, 1);

  engine.release(320);
  assert.equal(engine.getSnapshot().state, 'armed');
});

test('wake-hook mode requires wake signal before speech can open gate', () => {
  const engine = createBargeKit({ mode: 'wake_hook', wakeWindowMs: 300, minSpeechMs: 80, debounceMs: 40 });
  const starts = collect(engine, 'bargekit.user_speech.started');

  engine.start(0);
  engine.ingestLevel({ timestamp: 0, level: 0.7 });
  engine.ingestLevel({ timestamp: 100, level: 0.7 });
  assert.equal(starts.length, 0);

  engine.detectWake(120);
  engine.ingestLevel({ timestamp: 160, level: 0.7 });
  engine.ingestLevel({ timestamp: 260, level: 0.7 });
  assert.equal(starts.length, 1);
});

test('barge-in requests fire while agent output is active', () => {
  const engine = createBargeKit({ mode: 'vad', minSpeechMs: 80, debounceMs: 40 });
  const barges = collect(engine, 'bargekit.barge_in.requested');
  const ducks = collect(engine, 'bargekit.output.duck_requested');
  const cancels = collect(engine, 'bargekit.output.cancel_requested');

  engine.start(0);
  engine.setAgentSpeaking(true, 0, { token: 'agent-turn-1' });
  engine.ingestLevel({ timestamp: 20, level: 0.8 });
  engine.ingestLevel({ timestamp: 120, level: 0.8 });

  assert.equal(barges.length, 1);
  assert.equal(ducks.length, 1);
  assert.equal(cancels.length, 1);
  assert.equal(engine.getSnapshot().state, 'interrupted');
});

test('muted input suppresses speech and emits muted state', () => {
  const engine = createBargeKit();
  const mutedEvents = collect(engine, 'bargekit.input.muted');
  const speechStarts = collect(engine, 'bargekit.user_speech.started');

  engine.start(0);
  engine.setMuted(true, 10);
  engine.ingestLevel({ timestamp: 20, level: 0.9 });

  assert.equal(mutedEvents.length, 1);
  assert.equal(speechStarts.length, 0);
  assert.equal(engine.getSnapshot().state, 'muted');
});

test('half-duplex mode holds mic while agent is speaking', () => {
  const engine = createBargeKit({ mode: 'half_duplex' });
  const holds = collect(engine, 'bargekit.input.duplex_hold');
  const speechStarts = collect(engine, 'bargekit.user_speech.started');

  engine.start(0);
  engine.setAgentSpeaking(true, 0);
  engine.ingestLevel({ timestamp: 20, level: 0.3, source: 'speaker' });
  engine.ingestLevel({ timestamp: 120, level: 0.32, source: 'speaker' });

  assert.equal(holds.length, 1);
  assert.equal(speechStarts.length, 0);
  assert.equal(engine.getSnapshot().state, 'agent_speaking');
});
