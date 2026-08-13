# API reference

BargeKit is a small ESM package. The public surface is split by runtime so apps can import only what they need.

## Core

```js
import { createBargeKit, BargeKitEngine, MODES, STATES, EVENTS } from '@bargekit/core';
```

Use `createBargeKit(config)` for the deterministic turn-taking state machine. Feed it level frames with `engine.ingestLevel({ timestamp, level })`; subscribe with `engine.on(EVENTS.userSpeechStarted, handler)`.

Key behaviours:

- `vad` mode opens from level threshold and debounce timing.
- `push_to_talk` ignores hot levels until `setPushToTalk(true)`.
- `wake_hook` requires `triggerWake()` before speech can open the gate.
- `half_duplex` holds input while agent output is active.
- mute always wins over speech detection.

## Fixtures

```js
import { SYNTHETIC_FIXTURES, runFixture, loadFixtureFile } from '@bargekit/core/fixtures';
import { saveFixtureFile, createFixtureFromLevels } from '@bargekit/core/fixture-io';
```

Built-in fixtures are synthetic level traces, not recordings. Checked-in JSON fixtures live in `tests/fixtures/` for test and CLI compatibility.

## Integrations

```js
import { createOutputDuckingController, createAgentPulseBridge } from '@bargekit/core/integrations';
```

The ducking controller turns barge-in events into hold/duck/cancel/resume decisions. The AgentPulse bridge maps engine events into reducer-friendly envelopes for UI state.

## Web adapter

```js
import { createWebMicrophoneAdapter } from '@bargekit/core/web';
```

The browser adapter requests microphone permission explicitly, samples analyser levels, and does not record or upload audio. Calls to `start()` are idempotent for one active lifecycle: overlapping calls share the same startup promise, and later calls while active return the original result without requesting another stream or applying new options. Call `stop()` before starting with different options. If `stop()` overlaps startup, it waits for startup to settle and then releases that session; concurrent stops share the same teardown.

Startup is failure-atomic: if setup fails after permission is granted, the adapter stops acquired tracks, clears timers, disconnects the audio graph, closes the audio context, and releases its resource references before rejecting with the classified microphone error. After either a completed stop or a failed start, `start()` can create a fresh session.

## Observability and tuning

```js
import { createEventRecorder } from '@bargekit/core/recorder';
import { recommendThresholds } from '@bargekit/core/tuning';
```

Use the recorder for demos/tests and `recommendThresholds()` to turn fixture analyses into a safe starting config.
