export const BARGEKIT_STATE_MACHINE_SPEC_VERSION = '1.1.0';

export const MODES = Object.freeze(['push_to_talk', 'vad', 'wake_hook', 'half_duplex']);

export const STATES = Object.freeze([
  'idle',
  'armed',
  'listening',
  'user_speaking',
  'agent_speaking',
  'barge_pending',
  'interrupted',
  'muted',
  'noise_gated',
  'cooldown',
  'error'
]);

export const INPUTS = Object.freeze([
  'session.start',
  'session.stop',
  'mic.level',
  'vad.speech.start',
  'vad.speech.end',
  'push.down',
  'push.up',
  'wake.detected',
  'agent.output.start',
  'agent.output.end',
  'agent.output.ducked',
  'mute.on',
  'mute.off',
  'config.update',
  'error.raise'
]);

export const EVENTS = Object.freeze([
  'bargekit.session.started',
  'bargekit.session.stopped',
  'bargekit.state.changed',
  'bargekit.user_speech.started',
  'bargekit.user_speech.ended',
  'bargekit.barge_in.requested',
  'bargekit.output.duck_requested',
  'bargekit.output.cancel_requested',
  'bargekit.input.muted',
  'bargekit.input.noise_gated',
  'bargekit.input.duplex_hold',
  'bargekit.error.recorded'
]);

export const REQUIRED_CONFIG_FIELDS = Object.freeze([
  'mode',
  'speechThreshold',
  'noiseFloorThreshold',
  'minSpeechMs',
  'silenceMs',
  'debounceMs',
  'cooldownMs',
  'bargeIn.enabled'
]);

export const DEFAULT_CONFIG = Object.freeze({
  mode: 'vad',
  speechThreshold: 0.58,
  noiseFloorThreshold: 0.18,
  minSpeechMs: 120,
  silenceMs: 450,
  debounceMs: 80,
  cooldownMs: 160,
  wakeWindowMs: 4000,
  halfDuplex: {
    preventWhileAgentSpeaking: true
  },
  bargeIn: {
    enabled: true,
    whileAgentSpeaking: true,
    cancelOutput: true,
    duckOutput: true
  }
});

export const PRESET_PROFILES = Object.freeze({
  laptop_speakers: Object.freeze({
    speechThreshold: 0.64,
    noiseFloorThreshold: 0.22,
    silenceMs: 520,
    debounceMs: 90,
    minSpeechMs: 140
  }),
  wired_headset: Object.freeze({
    speechThreshold: 0.5,
    noiseFloorThreshold: 0.14,
    silenceMs: 420,
    debounceMs: 70,
    minSpeechMs: 110
  }),
  quiet_room: Object.freeze({
    speechThreshold: 0.44,
    noiseFloorThreshold: 0.1,
    silenceMs: 380,
    debounceMs: 60,
    minSpeechMs: 100
  })
});

export function canRequestBargeIn(config, currentState) {
  return config?.bargeIn?.enabled === true && currentState === 'agent_speaking';
}

export function mergeConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    halfDuplex: {
      ...DEFAULT_CONFIG.halfDuplex,
      ...(overrides.halfDuplex ?? {})
    },
    bargeIn: {
      ...DEFAULT_CONFIG.bargeIn,
      ...(overrides.bargeIn ?? {})
    }
  };
}
