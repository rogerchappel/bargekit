import { mergeConfig } from './contracts.js';
import { createBargeKit } from './core.js';

function computeLevelFromAnalyser(analyser, reuseBuffer) {
  if (typeof analyser.getFloatTimeDomainData === 'function') {
    const buffer = reuseBuffer.length === analyser.fftSize ? reuseBuffer : new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample ** 2, 0) / buffer.length);
    return { level: Math.max(0, Math.min(1, rms * 2.4)), buffer };
  }

  const buffer = reuseBuffer.length === analyser.fftSize ? reuseBuffer : new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  const centered = Array.from(buffer, (sample) => (sample - 128) / 128);
  const rms = Math.sqrt(centered.reduce((sum, sample) => sum + sample ** 2, 0) / centered.length);
  return { level: Math.max(0, Math.min(1, rms * 2.4)), buffer };
}

function classifyMediaError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'permission_denied';
  }

  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'device_unavailable';
  }

  return 'microphone_error';
}

export class WebMicrophoneAdapter {
  constructor(options = {}) {
    const {
      engine = createBargeKit(),
      config = {},
      navigatorRef = globalThis.navigator,
      AudioContextCtor = globalThis.AudioContext,
      setIntervalRef = globalThis.setInterval,
      clearIntervalRef = globalThis.clearInterval,
      now = () => Date.now()
    } = options;

    this.config = {
      frameIntervalMs: 40,
      analyserFftSize: 256,
      ...mergeConfig(config)
    };
    this.engine = engine;
    this.navigatorRef = navigatorRef;
    this.AudioContextCtor = AudioContextCtor;
    this.setIntervalRef = setIntervalRef;
    this.clearIntervalRef = clearIntervalRef;
    this.now = now;

    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyser = null;
    this.intervalId = null;
    this.reuseBuffer = new Float32Array(0);
  }

  async start(options = {}) {
    if (!this.navigatorRef?.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not available in this environment');
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(options.audio ?? {})
      },
      video: false
    };

    try {
      this.stream = await this.navigatorRef.mediaDevices.getUserMedia(constraints);
      this.audioContext = new this.AudioContextCtor();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.analyserFftSize;
      this.sourceNode.connect(this.analyser);
      this.engine.start(this.now());
      this.intervalId = this.setIntervalRef(() => this.sampleOnce(), this.config.frameIntervalMs);
      return { started: true, constraints };
    } catch (error) {
      const code = classifyMediaError(error);
      this.engine.raiseError(new Error(code), this.now());
      throw Object.assign(new Error(code), { cause: error });
    }
  }

  sampleOnce(timestamp = this.now()) {
    if (!this.analyser) {
      return null;
    }

    const { level, buffer } = computeLevelFromAnalyser(this.analyser, this.reuseBuffer);
    this.reuseBuffer = buffer;
    this.engine.ingestLevel({ timestamp, level, source: 'microphone' });
    return { timestamp, level };
  }

  async stop() {
    if (this.intervalId) {
      this.clearIntervalRef(this.intervalId);
      this.intervalId = null;
    }

    this.sourceNode?.disconnect?.();
    this.analyser?.disconnect?.();
    this.stream?.getTracks?.().forEach((track) => track.stop());
    await this.audioContext?.close?.();
    this.engine.stop(this.now());

    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyser = null;
    return { stopped: true };
  }
}

export function createWebMicrophoneAdapter(options = {}) {
  return new WebMicrophoneAdapter(options);
}
