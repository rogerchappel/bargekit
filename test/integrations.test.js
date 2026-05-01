import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPulseBridge, createBargeKit, createOutputDuckingController, reduceAgentGlowState } from '../src/index.js';

test('output ducking controller marks barge-in work inside timing budget and avoids stale resumes', () => {
  const engine = createBargeKit({ minSpeechMs: 80, debounceMs: 40, silenceMs: 100, cooldownMs: 40 });
  const ducks = [];
  const interrupts = [];
  const resumes = [];
  let clockNow = 100;

  const controller = createOutputDuckingController({
    clock: () => clockNow,
    onDuck: (payload) => ducks.push(payload),
    onInterrupt: (payload) => interrupts.push(payload),
    onResume: (payload) => resumes.push(payload)
  });

  controller.beginAgentOutput('turn-a');
  const detach = controller.attach(engine);

  engine.start(0);
  engine.setAgentSpeaking(true, 0, { token: 'turn-a' });
  clockNow = 110;
  engine.ingestLevel({ timestamp: 20, level: 0.8 });
  clockNow = 120;
  engine.ingestLevel({ timestamp: 120, level: 0.82 });
  controller.endAgentOutput('turn-a');
  controller.beginAgentOutput('turn-b');
  engine.ingestLevel({ timestamp: 260, level: 0.1 });
  engine.ingestLevel({ timestamp: 380, level: 0.1 });

  detach();

  assert.equal(ducks[0].withinBudget, true);
  assert.equal(interrupts[0].token, 'turn-a');
  assert.equal(resumes.length, 0);
});

test('agent pulse bridge maps bargekit events into reducer-friendly envelopes', () => {
  const engine = createBargeKit({ minSpeechMs: 80, debounceMs: 40, silenceMs: 80, cooldownMs: 40 });
  const bridge = createAgentPulseBridge({ sessionId: 'session-1' });
  const detach = bridge.attach(engine);

  engine.start(0);
  engine.setMuted(true, 10);
  engine.setMuted(false, 20);
  engine.ingestLevel({ timestamp: 20, level: 0.22 });
  engine.ingestLevel({ timestamp: 40, level: 0.8 });
  engine.ingestLevel({ timestamp: 140, level: 0.82 });
  engine.ingestLevel({ timestamp: 260, level: 0.1 });
  engine.ingestLevel({ timestamp: 360, level: 0.1 });

  detach();

  const events = bridge.drain();
  assert.ok(events.some((event) => event.type === 'input.muted'));
  assert.ok(events.some((event) => event.type === 'input.noise_gated'));
  assert.ok(events.some((event) => event.type === 'user.speech.started'));

  const reduced = events.reduce(reduceAgentGlowState, {
    listening: false,
    speaking: false,
    interrupted: false,
    muted: false,
    noiseGated: false,
    duplexHold: false,
    lastEvent: null
  });

  assert.equal(reduced.muted, true);
  assert.equal(reduced.noiseGated, true);
  assert.equal(reduced.lastEvent, 'user.speech.ended');
});
