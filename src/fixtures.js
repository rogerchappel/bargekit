import { PRESET_PROFILES, mergeConfig } from './contracts.js';

function createSegment({ startMs, endMs, level, source = 'microphone', label = source }) {
  return { startMs, endMs, level, source, label };
}

export function createSyntheticFixture(name, options = {}) {
  const {
    totalMs = 3000,
    frameMs = 20,
    baseline = 0.03,
    segments = [],
    metadata = {}
  } = options;

  const samples = [];
  for (let timestamp = 0; timestamp <= totalMs; timestamp += frameMs) {
    let level = baseline;
    let source = 'microphone';
    let label = 'baseline';

    for (const segment of segments) {
      if (timestamp >= segment.startMs && timestamp <= segment.endMs) {
        level = segment.level;
        source = segment.source ?? source;
        label = segment.label ?? label;
      }
    }

    samples.push({ timestamp, level, source, metadata: { label } });
  }

  return {
    name,
    totalMs,
    frameMs,
    baseline,
    segments,
    metadata,
    samples
  };
}

export const SYNTHETIC_FIXTURES = Object.freeze({
  quiet_room: createSyntheticFixture('quiet_room', {
    totalMs: 2200,
    baseline: 0.04,
    segments: []
  }),
  keyboard_noise: createSyntheticFixture('keyboard_noise', {
    totalMs: 2400,
    baseline: 0.04,
    segments: [
      createSegment({ startMs: 360, endMs: 540, level: 0.23, source: 'room_noise', label: 'keyboard-burst' }),
      createSegment({ startMs: 1240, endMs: 1380, level: 0.2, source: 'room_noise', label: 'keyboard-burst' })
    ]
  }),
  short_utterance: createSyntheticFixture('short_utterance', {
    totalMs: 2600,
    baseline: 0.04,
    segments: [
      createSegment({ startMs: 600, endMs: 700, level: 0.63, label: 'short-utterance' })
    ]
  }),
  long_utterance: createSyntheticFixture('long_utterance', {
    totalMs: 3200,
    baseline: 0.04,
    segments: [
      createSegment({ startMs: 520, endMs: 1520, level: 0.72, label: 'long-utterance' })
    ]
  }),
  speaker_echo: createSyntheticFixture('speaker_echo', {
    totalMs: 2800,
    baseline: 0.04,
    segments: [
      createSegment({ startMs: 300, endMs: 1440, level: 0.27, source: 'speaker', label: 'speaker-echo' }),
      createSegment({ startMs: 900, endMs: 1160, level: 0.66, label: 'user-vs-speaker' })
    ]
  }),
  interruption_timing: createSyntheticFixture('interruption_timing', {
    totalMs: 3000,
    baseline: 0.04,
    segments: [
      createSegment({ startMs: 0, endMs: 900, level: 0.24, source: 'speaker', label: 'agent-speaking' }),
      createSegment({ startMs: 420, endMs: 1260, level: 0.74, label: 'user-barge-in' })
    ]
  })
});

export function runFixture(engine, fixture) {
  const transcript = [];
  const unsubs = [
    engine.on('bargekit.state.changed', (event) => transcript.push({ stream: 'state', event })),
    engine.on('bargekit.user_speech.started', (event) => transcript.push({ stream: 'speech', event })),
    engine.on('bargekit.user_speech.ended', (event) => transcript.push({ stream: 'speech', event })),
    engine.on('bargekit.barge_in.requested', (event) => transcript.push({ stream: 'barge', event })),
    engine.on('bargekit.input.noise_gated', (event) => transcript.push({ stream: 'noise', event })),
    engine.on('bargekit.input.duplex_hold', (event) => transcript.push({ stream: 'duplex', event }))
  ];

  engine.start(0);
  for (const sample of fixture.samples) {
    engine.ingestLevel(sample);
  }
  engine.stop(fixture.totalMs + fixture.frameMs);

  for (const unsubscribe of unsubs) {
    unsubscribe();
  }

  return transcript;
}

export function analyzeFixtureForThresholds(fixture, overrides = {}) {
  const config = mergeConfig(overrides);
  let speechFrames = 0;
  let noiseFrames = 0;
  let quietFrames = 0;
  let peakLevel = 0;

  for (const sample of fixture.samples) {
    peakLevel = Math.max(peakLevel, sample.level);
    if (sample.level >= config.speechThreshold) {
      speechFrames += 1;
      continue;
    }

    if (sample.level >= config.noiseFloorThreshold) {
      noiseFrames += 1;
      continue;
    }

    quietFrames += 1;
  }

  const averageSpeechLevel = speechFrames === 0
    ? 0
    : fixture.samples.filter((sample) => sample.level >= config.speechThreshold)
      .reduce((sum, sample) => sum + sample.level, 0) / speechFrames;

  const suggestedProfile = Object.entries(PRESET_PROFILES).reduce((best, [name, profile]) => {
    const distance = Math.abs(profile.speechThreshold - averageSpeechLevel || config.speechThreshold);
    if (!best || distance < best.distance) {
      return { name, distance };
    }
    return best;
  }, null)?.name ?? 'quiet_room';

  return {
    fixture: fixture.name,
    speechFrames,
    noiseFrames,
    quietFrames,
    peakLevel,
    averageSpeechLevel,
    suggestedProfile,
    explanation: speechFrames === 0
      ? 'No speech crossed the configured speech threshold; lower speechThreshold or confirm the microphone path.'
      : `Speech clears the threshold ${speechFrames} frames while ${noiseFrames} frames are noise-gated. Profile ${suggestedProfile} is the closest built-in tuning baseline.`
  };
}

export function createTuningReport(fixtures = Object.values(SYNTHETIC_FIXTURES), overrides = {}) {
  return fixtures.map((fixture) => analyzeFixtureForThresholds(fixture, overrides));
}
