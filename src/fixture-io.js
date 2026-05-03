import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createSyntheticFixture } from './fixtures.js';

function assertSample(sample, index, fileLabel) {
  if (!sample || typeof sample !== 'object') {
    throw new Error(`${fileLabel}: sample ${index} must be an object`);
  }

  if (!Number.isFinite(sample.timestamp) || sample.timestamp < 0) {
    throw new Error(`${fileLabel}: sample ${index} has invalid timestamp`);
  }

  if (!Number.isFinite(sample.level) || sample.level < 0 || sample.level > 1) {
    throw new Error(`${fileLabel}: sample ${index} level must be between 0 and 1`);
  }
}

export function normalizeFixtureDocument(document, fileLabel = 'fixture') {
  if (!document || typeof document !== 'object') {
    throw new Error(`${fileLabel}: fixture must be a JSON object`);
  }

  if (!document.name || typeof document.name !== 'string') {
    throw new Error(`${fileLabel}: fixture.name is required`);
  }

  if (!Array.isArray(document.samples) || document.samples.length === 0) {
    throw new Error(`${fileLabel}: fixture.samples must be a non-empty array`);
  }

  document.samples.forEach((sample, index) => assertSample(sample, index, fileLabel));

  const totalMs = Number.isFinite(document.totalMs)
    ? document.totalMs
    : Math.max(...document.samples.map((sample) => sample.timestamp));

  const frameMs = Number.isFinite(document.frameMs)
    ? document.frameMs
    : inferFrameMs(document.samples);

  return {
    name: document.name,
    totalMs,
    frameMs,
    baseline: Number.isFinite(document.baseline) ? document.baseline : 0,
    segments: Array.isArray(document.segments) ? document.segments : [],
    metadata: document.metadata && typeof document.metadata === 'object' ? document.metadata : {},
    samples: document.samples.map((sample) => ({
      timestamp: sample.timestamp,
      level: sample.level,
      source: sample.source ?? 'microphone',
      metadata: sample.metadata ?? {}
    }))
  };
}

export function loadFixtureFile(path) {
  const fileLabel = basename(path);
  const document = JSON.parse(readFileSync(path, 'utf8'));
  return normalizeFixtureDocument(document, fileLabel);
}

export function saveFixtureFile(path, fixture) {
  const normalized = normalizeFixtureDocument(fixture, path);
  writeFileSync(`${path}`, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

export function createFixtureFromLevels(name, levels, frameMs = 20) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error('levels must be a non-empty array');
  }

  const samples = levels.map((level, index) => {
    if (!Number.isFinite(level) || level < 0 || level > 1) {
      throw new Error(`level ${index} must be between 0 and 1`);
    }

    return {
      timestamp: index * frameMs,
      level,
      source: 'microphone',
      metadata: { generatedFrom: 'levels' }
    };
  });

  return normalizeFixtureDocument({
    name,
    totalMs: (levels.length - 1) * frameMs,
    frameMs,
    baseline: Math.min(...levels),
    segments: [],
    metadata: { generatedFrom: 'levels' },
    samples
  }, name);
}

export function inferFrameMs(samples) {
  if (samples.length < 2) {
    return 0;
  }

  const deltas = samples
    .slice(1)
    .map((sample, index) => sample.timestamp - samples[index].timestamp)
    .filter((delta) => delta > 0);

  if (deltas.length === 0) {
    return 0;
  }

  return deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
}
