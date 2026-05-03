import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBargeKit, createEventRecorder } from '../src/index.js';

test('event recorder captures ordered engine events and can detach', () => {
  const engine = createBargeKit();
  const recorder = createEventRecorder(engine);
  engine.start(0);
  engine.ingestLevel({ timestamp: 20, level: 0.9 });
  engine.ingestLevel({ timestamp: 180, level: 0.9 });
  assert.ok(recorder.entries.some((entry) => entry.type === 'bargekit.user_speech.started'));
  recorder.stop();
  const length = recorder.entries.length;
  engine.stop(500);
  assert.equal(recorder.entries.length, length);
});
