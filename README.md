# bargekit

BargeKit is a local-first turn-taking SDK for voice agents — the tiny harbor pilot that keeps agent audio from smashing into the dock.

It focuses on the messy parts that make voice products feel natural instead of brittle:

- voice activity detection gates
- barge-in / interruption requests
- half-duplex and mute state
- output duck/cancel hooks for playback stacks such as VoicePath
- AgentPulse-friendly events for UI and telemetry
- browser microphone sampling with explicit opt-in only
- synthetic fixtures for repeatable tuning and regression tests

## Status

V1 is a working foundation aimed at demos, local prototypes, and integration spikes.

What it does well right now:

- deterministic level-driven state engine
- synthetic verification for speech, noise, echo-ish paths, and interruption timing
- browser microphone adapter with explicit permission flow
- static demo UI for live mic and synthetic playback modes

What it does **not** promise yet:

- enterprise-grade echo cancellation
- STT or TTS
- covert/background recording
- perfect cross-device tuning out of the box

## Install

```sh
npm install @bargekit/core
```

## Quick start

```js
import { createBargeKit, createOutputDuckingController } from '@bargekit/core';

const barge = createBargeKit({
  mode: 'vad',
  speechThreshold: 0.58,
  noiseFloorThreshold: 0.18,
  minSpeechMs: 120,
  silenceMs: 450,
  debounceMs: 80,
  bargeIn: {
    enabled: true,
    whileAgentSpeaking: true,
    cancelOutput: true,
    duckOutput: true
  }
});

const ducking = createOutputDuckingController({
  onInterrupt: () => voicepath.interrupt(),
  onDuck: () => voicepath.duck()
});

ducking.attach(barge);

barge.on('bargekit.user_speech.started', (event) => {
  console.log('user started speaking', event);
});

barge.on('bargekit.barge_in.requested', () => {
  console.log('interrupt the agent now');
});

barge.start();
barge.setAgentSpeaking(true);
barge.ingestLevel({ timestamp: Date.now(), level: 0.81 });
```

## Packages / modules

Everything currently ships from one package with a few focused entry surfaces:

- `src/core.js` — deterministic state engine
- `src/fixtures.js` — synthetic audio fixtures + tuning reports
- `src/web.js` — browser microphone/analyser adapter
- `src/integrations.js` — VoicePath duck/cancel hooks + AgentPulse bridge
- `demo/` — local static demo UI

## CLI

```sh
bargekit fixtures --json
bargekit tune --fixture tests/fixtures/long_utterance.json --json
bargekit smoke --fixture tests/fixtures/interruption_timing.json --json
bargekit demo
```

The CLI uses synthetic/local fixture data only; it does not open a microphone.

## Demo

Run a local static server from the repo root, then open `demo/`.

```sh
python3 -m http.server 4173
```

Then visit <http://localhost:4173/demo/>.

Demo features:

- live microphone mode with explicit permission request
- synthetic fixture playback mode
- preset profiles for laptop speakers, headset, and quiet-room tuning
- push-to-talk, VAD, wake-hook, and half-duplex modes
- visible interruption / ducking event log

## Privacy and platform posture

- Audio stays local by default.
- The web adapter only accesses the microphone after an explicit user action.
- There are no hidden network calls in the core, web adapter, or demo.
- Browser/device echo behavior varies. BargeKit exposes policy hooks and state honestly; it does not claim to solve acoustic echo cancellation universally.

More detail: [docs/PRIVACY_PLATFORM_GUIDE.md](docs/PRIVACY_PLATFORM_GUIDE.md)

## Tuning workflow

Use the synthetic fixtures first, then validate with real hardware paths.

Built-in fixture coverage:

- quiet room baseline
- keyboard noise
- short utterance
- long utterance
- speaker echo pressure
- interruption timing

Built-in presets:

- `laptop_speakers`
- `wired_headset`
- `quiet_room`

## VoicePath + AgentPulse integration

- Subscribe to `bargekit.output.cancel_requested` or `bargekit.output.duck_requested` to interrupt playback.
- Use `createOutputDuckingController()` to avoid resuming stale agent turns.
- Use `createAgentPulseBridge()` to translate speech/mute/noise/duplex events into an AgentPulse-style stream.
- `reduceAgentGlowState()` turns those events into a simple listening/speaking/interrupted UI reducer.

## Verification

```sh
npm run check
npm test
npm run typecheck
npm run build
bash scripts/validate.sh
```

## Documentation

- [Turn-taking state machine contract](docs/TURN_TAKING_STATE_MACHINE.md)
- [Privacy + platform guide](docs/PRIVACY_PLATFORM_GUIDE.md)
- [Real-world quality pass](docs/REAL_WORLD_QUALITY_PASS.md)
- [Safety posture](SAFETY.md)
- [Examples](examples/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT
