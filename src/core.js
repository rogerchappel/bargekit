import { EVENTS, MODES, STATES, canRequestBargeIn, mergeConfig } from './contracts.js';

function assertKnownMode(mode) {
  if (!MODES.includes(mode)) {
    throw new Error(`Unknown BargeKit mode: ${mode}`);
  }
}

class MiniEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    const next = listeners.filter((candidate) => candidate !== listener);
    if (next.length === 0) {
      this.listeners.delete(event);
      return;
    }

    this.listeners.set(event, next);
  }

  emit(event, payload) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

function clampLevel(level) {
  if (!Number.isFinite(level)) {
    return 0;
  }

  return Math.max(0, Math.min(1, level));
}

function nowFromSample(sample) {
  return Number.isFinite(sample.timestamp) ? sample.timestamp : Date.now();
}

function normalizeSample(sample) {
  if (typeof sample === 'number') {
    return { level: sample, timestamp: Date.now() };
  }

  return {
    level: clampLevel(sample.level ?? 0),
    timestamp: nowFromSample(sample),
    source: sample.source ?? 'microphone',
    metadata: sample.metadata ?? {}
  };
}

export class BargeKitEngine {
  constructor(config = {}) {
    this.config = mergeConfig(config);
    assertKnownMode(this.config.mode);

    this.emitter = new MiniEmitter();
    this.state = 'idle';
    this.sessionActive = false;
    this.agentOutputActive = false;
    this.pushPressed = false;
    this.muted = false;
    this.wakeExpiresAt = 0;
    this.lastLevelTimestamp = 0;
    this.activeSpeech = null;
    this.candidateSpeech = null;
    this.lastBelowThresholdAt = 0;
    this.cooldownUntil = 0;
    this.duplexHoldNotifiedAt = 0;
  }

  on(event, listener) {
    return this.emitter.on(event, listener);
  }

  getSnapshot() {
    return {
      state: this.state,
      sessionActive: this.sessionActive,
      agentOutputActive: this.agentOutputActive,
      pushPressed: this.pushPressed,
      muted: this.muted,
      wakeExpiresAt: this.wakeExpiresAt,
      lastLevelTimestamp: this.lastLevelTimestamp,
      activeSpeech: this.activeSpeech ? { ...this.activeSpeech } : null,
      candidateSpeech: this.candidateSpeech ? { ...this.candidateSpeech } : null,
      cooldownUntil: this.cooldownUntil,
      config: structuredClone(this.config)
    };
  }

  start(timestamp = Date.now()) {
    this.sessionActive = true;
    this.activeSpeech = null;
    this.candidateSpeech = null;
    this.cooldownUntil = 0;
    this.lastLevelTimestamp = timestamp;
    this.emitter.emit(EVENTS[0], { type: EVENTS[0], timestamp, mode: this.config.mode });
    this.#setState(this.muted ? 'muted' : 'armed', timestamp, 'session.start');
    return this.getSnapshot();
  }

  stop(timestamp = Date.now()) {
    this.sessionActive = false;
    this.agentOutputActive = false;
    this.pushPressed = false;
    this.activeSpeech = null;
    this.candidateSpeech = null;
    this.cooldownUntil = 0;
    this.wakeExpiresAt = 0;
    this.emitter.emit(EVENTS[1], { type: EVENTS[1], timestamp });
    this.#setState('idle', timestamp, 'session.stop');
    return this.getSnapshot();
  }

  updateConfig(overrides = {}, timestamp = Date.now()) {
    this.config = mergeConfig({ ...this.config, ...overrides });
    assertKnownMode(this.config.mode);
    this.emitter.emit(EVENTS[2], {
      type: EVENTS[2],
      timestamp,
      previousState: this.state,
      nextState: this.state,
      reason: 'config.update',
      config: structuredClone(this.config)
    });
    return this.getSnapshot();
  }

  setMuted(muted, timestamp = Date.now()) {
    this.muted = Boolean(muted);

    if (!this.sessionActive) {
      return this.getSnapshot();
    }

    if (this.muted) {
      this.activeSpeech = null;
      this.candidateSpeech = null;
      this.emitter.emit('bargekit.input.muted', { type: 'bargekit.input.muted', timestamp, muted: true });
      this.#setState('muted', timestamp, 'mute.on');
      return this.getSnapshot();
    }

    this.#setState(this.agentOutputActive ? 'agent_speaking' : 'armed', timestamp, 'mute.off');
    return this.getSnapshot();
  }

  setAgentSpeaking(active, timestamp = Date.now(), metadata = {}) {
    this.agentOutputActive = Boolean(active);

    if (!this.sessionActive) {
      return this.getSnapshot();
    }

    if (this.agentOutputActive) {
      this.#setState('agent_speaking', timestamp, 'agent.output.start', metadata);
      return this.getSnapshot();
    }

    const nextState = this.muted ? 'muted' : this.activeSpeech ? 'user_speaking' : 'armed';
    this.#setState(nextState, timestamp, 'agent.output.end', metadata);
    return this.getSnapshot();
  }

  press(timestamp = Date.now()) {
    this.pushPressed = true;
    if (this.sessionActive && this.config.mode === 'push_to_talk' && !this.muted) {
      this.#setState('listening', timestamp, 'push.down');
    }
    return this.getSnapshot();
  }

  release(timestamp = Date.now()) {
    this.pushPressed = false;
    if (this.activeSpeech) {
      this.#endSpeech(timestamp, 'push.up');
    }

    if (this.sessionActive && this.config.mode === 'push_to_talk' && !this.agentOutputActive && !this.muted) {
      this.#setState('armed', timestamp, 'push.up');
    }

    return this.getSnapshot();
  }

  detectWake(timestamp = Date.now()) {
    this.wakeExpiresAt = timestamp + this.config.wakeWindowMs;
    if (this.sessionActive && this.config.mode === 'wake_hook' && !this.muted) {
      this.#setState('listening', timestamp, 'wake.detected');
    }
    return this.getSnapshot();
  }

  raiseError(error, timestamp = Date.now()) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    this.emitter.emit('bargekit.error.recorded', {
      type: 'bargekit.error.recorded',
      timestamp,
      error: normalizedError,
      message: normalizedError.message
    });
    this.#setState('error', timestamp, 'error.raise', { message: normalizedError.message });
    return this.getSnapshot();
  }

  ingestLevel(sample) {
    const normalized = normalizeSample(sample);
    const timestamp = normalized.timestamp;
    this.lastLevelTimestamp = timestamp;

    if (!this.sessionActive) {
      return this.getSnapshot();
    }

    if (this.muted) {
      this.#setState('muted', timestamp, 'mic.level');
      return this.getSnapshot();
    }

    if (timestamp < this.cooldownUntil) {
      this.#setState('cooldown', timestamp, 'mic.level');
      return this.getSnapshot();
    }

    if (this.#shouldHoldForHalfDuplex(normalized)) {
      this.activeSpeech = null;
      this.candidateSpeech = null;
      if (timestamp - this.duplexHoldNotifiedAt >= this.config.debounceMs) {
        this.duplexHoldNotifiedAt = timestamp;
        this.emitter.emit('bargekit.input.duplex_hold', {
          type: 'bargekit.input.duplex_hold',
          timestamp,
          level: normalized.level,
          reason: 'half_duplex_agent_output'
        });
      }
      this.#setState('agent_speaking', timestamp, 'mic.level');
      return this.getSnapshot();
    }

    if (!this.#gateOpenForMode(timestamp)) {
      this.candidateSpeech = null;
      this.#setState(this.agentOutputActive ? 'agent_speaking' : 'armed', timestamp, 'mic.level');
      return this.getSnapshot();
    }

    if (normalized.level >= this.config.speechThreshold) {
      this.lastBelowThresholdAt = timestamp;
      this.#handleSpeechLevel(normalized);
      return this.getSnapshot();
    }

    if (normalized.level >= this.config.noiseFloorThreshold) {
      this.candidateSpeech = null;
      this.emitter.emit('bargekit.input.noise_gated', {
        type: 'bargekit.input.noise_gated',
        timestamp,
        level: normalized.level
      });
      if (!this.activeSpeech) {
        this.#setState('noise_gated', timestamp, 'mic.level');
      }
      return this.getSnapshot();
    }

    this.candidateSpeech = null;
    if (this.activeSpeech) {
      if (this.lastBelowThresholdAt === 0) {
        this.lastBelowThresholdAt = timestamp;
      }

      if (timestamp - this.lastBelowThresholdAt >= this.config.silenceMs) {
        this.#endSpeech(timestamp, 'vad.speech.end');
        return this.getSnapshot();
      }

      this.#setState('user_speaking', timestamp, 'mic.level');
      return this.getSnapshot();
    }

    if (!this.agentOutputActive) {
      this.#setState('listening', timestamp, 'mic.level');
    }

    return this.getSnapshot();
  }

  #handleSpeechLevel(sample) {
    const timestamp = sample.timestamp;
    const requiredWindow = Math.max(this.config.debounceMs, this.config.minSpeechMs);

    if (!this.candidateSpeech) {
      this.candidateSpeech = {
        startedAt: timestamp,
        peakLevel: sample.level,
        source: sample.source
      };
    } else {
      this.candidateSpeech.peakLevel = Math.max(this.candidateSpeech.peakLevel, sample.level);
    }

    if (this.agentOutputActive && canRequestBargeIn(this.config, this.state) && this.config.bargeIn.whileAgentSpeaking) {
      this.emitter.emit('bargekit.barge_in.requested', {
        type: 'bargekit.barge_in.requested',
        timestamp,
        level: sample.level,
        policy: structuredClone(this.config.bargeIn)
      });

      if (this.config.bargeIn.duckOutput) {
        this.emitter.emit('bargekit.output.duck_requested', {
          type: 'bargekit.output.duck_requested',
          timestamp,
          level: sample.level
        });
      }

      if (this.config.bargeIn.cancelOutput) {
        this.emitter.emit('bargekit.output.cancel_requested', {
          type: 'bargekit.output.cancel_requested',
          timestamp,
          level: sample.level
        });
      }

      this.#setState('barge_pending', timestamp, 'vad.speech.start');
    }

    const speechDuration = timestamp - this.candidateSpeech.startedAt;
    if (!this.activeSpeech && speechDuration >= requiredWindow) {
      this.activeSpeech = {
        startedAt: this.candidateSpeech.startedAt,
        detectedAt: timestamp,
        peakLevel: this.candidateSpeech.peakLevel,
        source: sample.source
      };
      this.lastBelowThresholdAt = 0;
      this.emitter.emit('bargekit.user_speech.started', {
        type: 'bargekit.user_speech.started',
        timestamp,
        startedAt: this.activeSpeech.startedAt,
        level: sample.level,
        durationMs: speechDuration,
        source: sample.source
      });
      this.#setState(this.agentOutputActive ? 'interrupted' : 'user_speaking', timestamp, 'vad.speech.start');
      return;
    }

    if (this.activeSpeech) {
      this.activeSpeech.peakLevel = Math.max(this.activeSpeech.peakLevel, sample.level);
      this.#setState(this.agentOutputActive ? 'interrupted' : 'user_speaking', timestamp, 'mic.level');
      return;
    }

    this.#setState(this.agentOutputActive ? 'barge_pending' : 'listening', timestamp, 'mic.level');
  }

  #endSpeech(timestamp, reason) {
    if (!this.activeSpeech) {
      return;
    }

    const durationMs = Math.max(0, timestamp - this.activeSpeech.startedAt);
    const payload = {
      type: 'bargekit.user_speech.ended',
      timestamp,
      endedAt: timestamp,
      startedAt: this.activeSpeech.startedAt,
      durationMs,
      peakLevel: this.activeSpeech.peakLevel,
      source: this.activeSpeech.source,
      reason
    };

    this.activeSpeech = null;
    this.candidateSpeech = null;
    this.lastBelowThresholdAt = 0;
    this.cooldownUntil = timestamp + this.config.cooldownMs;

    this.emitter.emit('bargekit.user_speech.ended', payload);
    this.#setState('cooldown', timestamp, reason);
  }

  #gateOpenForMode(timestamp) {
    switch (this.config.mode) {
      case 'push_to_talk':
        return this.pushPressed;
      case 'wake_hook':
        return timestamp <= this.wakeExpiresAt;
      case 'half_duplex':
      case 'vad':
        return true;
      default:
        return false;
    }
  }

  #shouldHoldForHalfDuplex(sample) {
    return this.config.mode === 'half_duplex'
      && this.config.halfDuplex.preventWhileAgentSpeaking
      && this.agentOutputActive
      && sample.level >= this.config.noiseFloorThreshold;
  }

  #setState(nextState, timestamp, reason, metadata = {}) {
    if (!STATES.includes(nextState)) {
      throw new Error(`Unknown BargeKit state: ${nextState}`);
    }

    if (this.state === nextState) {
      return;
    }

    const previousState = this.state;
    this.state = nextState;
    this.emitter.emit('bargekit.state.changed', {
      type: 'bargekit.state.changed',
      timestamp,
      previousState,
      nextState,
      reason,
      metadata
    });
  }
}

export function createBargeKit(config = {}) {
  return new BargeKitEngine(config);
}
