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
  connect() {}
  disconnect() {}
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
