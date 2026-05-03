import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SYNTHETIC_FIXTURES, recommendThresholds } from '../src/index.js';

test('threshold recommendation returns safe ordered thresholds and rationale', () => {
  const result = recommendThresholds([SYNTHETIC_FIXTURES.keyboard_noise, SYNTHETIC_FIXTURES.long_utterance]);
  assert.ok(result.config.speechThreshold > result.config.noiseFloorThreshold);
  assert.ok(result.closestProfile);
  assert.match(result.rationale, /speechThreshold/);
});
