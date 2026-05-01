import { PRESET_PROFILES } from './contracts.js';
import { SYNTHETIC_FIXTURES, createTuningReport } from './fixtures.js';

export function createDemoScenarioSummary() {
  return {
    presets: Object.entries(PRESET_PROFILES).map(([name, profile]) => ({
      name,
      profile
    })),
    fixtures: Object.values(SYNTHETIC_FIXTURES).map((fixture) => ({
      name: fixture.name,
      durationMs: fixture.totalMs,
      segments: fixture.segments.length
    }))
  };
}

export function createSyntheticPresetReport() {
  return createTuningReport(Object.values(SYNTHETIC_FIXTURES));
}
