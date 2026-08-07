import test from 'node:test';
import assert from 'node:assert/strict';
import { createBargeKit, createWebMicrophoneAdapter } from '../src/index.js';

class FakeTrack {
  constructor() {
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor() {
    this.tracks = [new FakeTrack()];
  }

  getTracks() {
    return this.tracks;
  }
}

class FakeAnalyser {
  constructor(levels = [0.35, 0.62, 0.18]) {
    this.levels = levels;
    this.fftSize = 8;
    this.index = 0;
  }

  getFloatTimeDomainData(buffer) {
    const level = this.levels[Math.min(this.index, this.levels.length - 1)];
    this.index += 1;
    const sample = level / 2.4;
    buffer.fill(sample);
  }

  disconnect() {}
}

class FakeSourceNode {
  constructor() {
    this.disconnected = false;
  }

  connect() {}
  disconnect() {
    this.disconnected = true;
  }
}

class FakeAudioContext {
  constructor(analyser) {
    this.analyser = analyser;
    this.closed = false;
  }

  createMediaStreamSource() {
    return new FakeSourceNode();
  }

  createAnalyser() {
    return this.analyser;
  }

  async close() {
    this.closed = true;
  }
}

test('web adapter requests permission, streams levels, and stops cleanly', async () => {
  const engine = createBargeKit({ minSpeechMs: 80, debounceMs: 40 });
  const stream = new FakeStream();
  const analyser = new FakeAnalyser();
  const intervals = [];
  const navigatorRef = {
    mediaDevices: {
      async getUserMedia() {
        return stream;
      }
    }
  };

  const adapter = createWebMicrophoneAdapter({
    engine,
    navigatorRef,
    AudioContextCtor: class {
      constructor() {
        return new FakeAudioContext(analyser);
      }
    },
    setIntervalRef(handler) {
      intervals.push(handler);
      return handler;
    },
    clearIntervalRef(handler) {
      const index = intervals.indexOf(handler);
      if (index >= 0) {
        intervals.splice(index, 1);
      }
    },
    now: () => 1000
  });

  const startResult = await adapter.start();
  assert.equal(startResult.started, true);

  const sample = adapter.sampleOnce(1040);
  assert.ok(sample.level > 0);

  await adapter.stop();
  assert.equal(stream.getTracks()[0].stopped, true);
  assert.equal(intervals.length, 0);
});

test('web adapter surfaces permission denied errors', async () => {
  const engine = createBargeKit();
  const navigatorRef = {
    mediaDevices: {
      async getUserMedia() {
        const error = new Error('denied');
        error.name = 'NotAllowedError';
        throw error;
      }
    }
  };

  const adapter = createWebMicrophoneAdapter({
    engine,
    navigatorRef,
    AudioContextCtor: class {
      constructor() {
        throw new Error('should not construct');
      }
    }
  });

  await assert.rejects(() => adapter.start(), /permission_denied/);
  assert.equal(engine.getSnapshot().state, 'error');
});

test('web adapter releases the stream when AudioContext construction fails', async () => {
  const engine = createBargeKit();
  const stream = new FakeStream();
  const adapter = createWebMicrophoneAdapter({
    engine,
    navigatorRef: {
      mediaDevices: { async getUserMedia() { return stream; } }
    },
    AudioContextCtor: class {
      constructor() {
        throw new Error('context construction failed');
      }
    }
  });

  await assert.rejects(
    () => adapter.start(),
    (error) => error.message === 'microphone_error' && error.cause.message === 'context construction failed'
  );
  assert.equal(stream.getTracks()[0].stopped, true);
  assert.equal(adapter.stream, null);
  assert.equal(adapter.audioContext, null);
  assert.equal(adapter.sourceNode, null);
  assert.equal(adapter.analyser, null);
  assert.equal(adapter.intervalId, null);
  assert.equal(engine.getSnapshot().state, 'error');
});

test('web adapter tears down graph and leaves no timer after late start failure', async () => {
  const engine = createBargeKit();
  const stream = new FakeStream();
  const analyser = new FakeAnalyser();
  const context = new FakeAudioContext(analyser);
  const source = new FakeSourceNode();
  context.createMediaStreamSource = () => source;
  context.createAnalyser = () => {
    throw new Error('analyser setup failed');
  };
  const activeTimers = [];
  const adapter = createWebMicrophoneAdapter({
    engine,
    navigatorRef: {
      mediaDevices: { async getUserMedia() { return stream; } }
    },
    AudioContextCtor: class { constructor() { return context; } },
    setIntervalRef(handler) {
      activeTimers.push(handler);
      return 0;
    },
    clearIntervalRef(timer) {
      assert.equal(timer, 0);
      activeTimers.length = 0;
    }
  });

  await assert.rejects(
    () => adapter.start(),
    (error) => error.message === 'microphone_error' && error.cause.message === 'analyser setup failed'
  );
  assert.equal(stream.getTracks()[0].stopped, true);
  assert.equal(source.disconnected, true);
  assert.equal(context.closed, true);
  assert.equal(activeTimers.length, 0);
  assert.equal(adapter.stream, null);
  assert.equal(adapter.audioContext, null);
  assert.equal(adapter.sourceNode, null);
  assert.equal(adapter.analyser, null);
  assert.equal(adapter.intervalId, null);
  assert.equal(engine.getSnapshot().state, 'error');
});
