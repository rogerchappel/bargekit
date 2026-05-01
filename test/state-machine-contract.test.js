import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BARGEKIT_STATE_MACHINE_SPEC_VERSION,
  EVENTS,
  INPUTS,
  MODES,
  PRESET_PROFILES,
  REQUIRED_CONFIG_FIELDS,
  STATES,
  canRequestBargeIn,
  mergeConfig
} from '../src/index.js';

const contract = readFileSync(new URL('../docs/TURN_TAKING_STATE_MACHINE.md', import.meta.url), 'utf8');

test('contract documents modes, states, inputs, transitions, events, and invariants', () => {
  for (const section of ['Modes', 'States', 'Inputs', 'Transition Rules', 'Event Contract', 'Invariants']) {
    assert.match(contract, new RegExp(`## ${section}`));
  }
});

test('spec version is aligned between code and docs', () => {
  assert.ok(contract.includes(`Spec version: \`${BARGEKIT_STATE_MACHINE_SPEC_VERSION}\``));
});

test('state machine modes cover V1 operation styles', () => {
  assert.deepEqual(MODES, ['push_to_talk', 'vad', 'wake_hook', 'half_duplex']);
});

test('states include barge-in, muted, noise gate, cooldown, and error states', () => {
  for (const state of ['barge_pending', 'interrupted', 'muted', 'noise_gated', 'cooldown', 'error']) {
    assert.ok(STATES.includes(state));
  }
});

test('inputs include microphone, VAD, push, wake, output, mute, and error signals', () => {
  for (const input of ['mic.level', 'vad.speech.start', 'push.down', 'wake.detected', 'agent.output.start', 'mute.on', 'error.raise']) {
    assert.ok(INPUTS.includes(input));
  }
});

test('events cover speech, barge-in, output control, mute, noise gate, duplex hold, and errors', () => {
  for (const event of [
    'bargekit.user_speech.started',
    'bargekit.barge_in.requested',
    'bargekit.output.cancel_requested',
    'bargekit.input.noise_gated',
    'bargekit.input.duplex_hold',
    'bargekit.error.recorded'
  ]) {
    assert.ok(EVENTS.includes(event));
  }
});

test('configuration fields include thresholds, timing, and barge-in policy', () => {
  assert.deepEqual(REQUIRED_CONFIG_FIELDS, [
    'mode',
    'speechThreshold',
    'noiseFloorThreshold',
    'minSpeechMs',
    'silenceMs',
    'debounceMs',
    'cooldownMs',
    'bargeIn.enabled'
  ]);
});

test('barge-in request requires enabled policy and active agent speech', () => {
  assert.equal(canRequestBargeIn({ bargeIn: { enabled: true } }, 'agent_speaking'), true);
  assert.equal(canRequestBargeIn({ bargeIn: { enabled: false } }, 'agent_speaking'), false);
  assert.equal(canRequestBargeIn({ bargeIn: { enabled: true } }, 'armed'), false);
});

test('mergeConfig preserves nested defaults and preset profiles are available for tuning', () => {
  const merged = mergeConfig({ bargeIn: { cancelOutput: false } });
  assert.equal(merged.bargeIn.enabled, true);
  assert.equal(merged.bargeIn.cancelOutput, false);
  assert.ok(PRESET_PROFILES.laptop_speakers);
});
