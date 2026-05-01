export const BARGEKIT_STATE_MACHINE_SPEC_VERSION = '1.0.0';

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
  'bargekit.error.recorded'
]);

export const REQUIRED_CONFIG_FIELDS = Object.freeze([
  'mode',
  'minSpeechMs',
  'silenceMs',
  'debounceMs',
  'bargeIn.enabled'
]);

export function canRequestBargeIn(config, currentState) {
  return config?.bargeIn?.enabled === true && currentState === 'agent_speaking';
}
