import { DEFAULT_CONFIG, PRESET_PROFILES, mergeConfig } from './contracts.js';
import { analyzeFixtureForThresholds } from './fixtures.js';

export function recommendThresholds(fixtures, options = {}) {
  const analyses = fixtures.map((fixture) => analyzeFixtureForThresholds(fixture, options));
  const peaks = analyses.map((analysis) => analysis.peakLevel).filter((level) => level > 0).sort((a, b) => a - b);
  const speechAverages = analyses
    .map((analysis) => analysis.averageSpeechLevel)
    .filter((level) => level > 0)
    .sort((a, b) => a - b);

  const noiseCeiling = percentile(peaks, 0.5) || DEFAULT_CONFIG.noiseFloorThreshold;
  const speechFloor = percentile(speechAverages, 0.25) || DEFAULT_CONFIG.speechThreshold;
  const speechThreshold = clamp(round(Math.max(speechFloor * 0.82, noiseCeiling + 0.18)), 0.2, 0.9);
  const noiseFloorThreshold = clamp(round(Math.min(noiseCeiling + 0.04, speechThreshold - 0.1)), 0.04, 0.5);
  const closestProfile = closestPreset(speechThreshold, noiseFloorThreshold);

  return {
    config: mergeConfig({
      speechThreshold,
      noiseFloorThreshold,
      minSpeechMs: options.minSpeechMs ?? DEFAULT_CONFIG.minSpeechMs,
      silenceMs: options.silenceMs ?? DEFAULT_CONFIG.silenceMs
    }),
    closestProfile,
    analyses,
    rationale: `Use speechThreshold ${speechThreshold} and noiseFloorThreshold ${noiseFloorThreshold}; closest preset is ${closestProfile}.`
  };
}

function closestPreset(speechThreshold, noiseFloorThreshold) {
  return Object.entries(PRESET_PROFILES).reduce((best, [name, profile]) => {
    const distance = Math.abs(profile.speechThreshold - speechThreshold)
      + Math.abs(profile.noiseFloorThreshold - noiseFloorThreshold);
    return !best || distance < best.distance ? { name, distance } : best;
  }, null).name;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.floor(values.length * ratio))];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
