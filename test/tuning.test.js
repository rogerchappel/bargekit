import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SYNTHETIC_FIXTURES,
  analyzeFixtureForThresholds,
  createSyntheticFixture,
  recommendThresholds
} from '../src/index.js';

test('threshold recommendation separates ambient peaks from speech evidence', () => {
  const result = recommendThresholds([SYNTHETIC_FIXTURES.keyboard_noise, SYNTHETIC_FIXTURES.long_utterance]);
  assert.equal(result.config.speechThreshold, 0.59);
  assert.equal(result.config.noiseFloorThreshold, 0.27);
  assert.equal(result.analyses[0].peakNoiseLevel, 0.23);
  assert.ok(Math.abs(result.analyses[1].averageSpeechLevel - 0.72) < Number.EPSILON * 4);
  assert.equal(result.closestProfile, 'laptop_speakers');
  assert.match(result.rationale, /speechThreshold/);
});

test('profile selection preserves zero distance for an exact speech threshold match', () => {
  const fixture = createSyntheticFixture('exact-wired-headset', {
    baseline: 0.04,
    segments: [{ startMs: 100, endMs: 300, level: 0.5 }]
  });

  const analysis = analyzeFixtureForThresholds(fixture, { speechThreshold: 0.5 });

  assert.equal(analysis.averageSpeechLevel, 0.5);
  assert.equal(analysis.suggestedProfile, 'wired_headset');
});
