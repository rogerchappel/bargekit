# Privacy, Platform, and Integration Guide

## Privacy defaults

BargeKit is designed to be local-first.

- Core state transitions run locally.
- Synthetic fixtures are generated locally.
- The demo is a static client-side page.
- The browser microphone adapter only starts after an explicit user action.
- This repository does not ship hidden upload, analytics, or recording flows.

## What BargeKit does

- Evaluates audio levels or external wake/push signals.
- Detects speech segments using deterministic thresholds and timing windows.
- Emits interruption, ducking, mute, noise-gate, and duplex-hold events.
- Helps host apps keep UI state honest about whether input is really open.

## What BargeKit does not do

- Speech transcription
- Text to speech
- Wake-word model training
- Cloud microphone streaming
- Guaranteed full acoustic echo cancellation

## Platform notes

### Browser

- Requires a user gesture before `getUserMedia()`.
- Browser/device echo cancellation quality varies widely.
- `AudioContext` lifecycle and autoplay policies differ across Chrome, Edge, Safari, and embedded WebViews.

### Laptop speakers + built-in mic

- Expect more speaker bleed and false positives.
- Start from the `laptop_speakers` preset.
- Prefer stronger noise floor thresholds and slightly longer silence windows.

### Wired / headset path

- Usually allows a lower speech threshold.
- Start from the `wired_headset` preset.
- Half-duplex can often be disabled if the playback path is isolated enough.

## Tuning recipes

### Quick baseline

1. Run synthetic fixtures.
2. Confirm keyboard noise never crosses `speechThreshold`.
3. Confirm long utterance opens speech reliably.
4. Confirm interruption timing requests barge-in quickly while agent output is active.

### Recommended starting presets

| Profile | speechThreshold | noiseFloorThreshold | debounceMs | minSpeechMs | silenceMs |
|---|---:|---:|---:|---:|---:|
| `laptop_speakers` | 0.64 | 0.22 | 90 | 140 | 520 |
| `wired_headset` | 0.50 | 0.14 | 70 | 110 | 420 |
| `quiet_room` | 0.44 | 0.10 | 60 | 100 | 380 |

## VoicePath integration

Use BargeKit as the microphone/turn-taking layer and let VoicePath own output playback.

Suggested hooks:

- `bargekit.output.duck_requested` -> lower output gain immediately
- `bargekit.output.cancel_requested` -> stop or interrupt current speech turn
- `bargekit.user_speech.started` -> stop queued agent speech if policy prefers user-first turns
- `bargekit.user_speech.ended` -> decide whether to resume or regenerate output

`createOutputDuckingController()` helps avoid resuming stale output tokens after an interruption.

## AgentPulse integration

`createAgentPulseBridge()` maps core events into a reducer-friendly stream:

- `user.speech.started`
- `user.speech.ended`
- `input.muted`
- `input.noise_gated`
- `barge_in.requested`
- `input.half_duplex_hold`

`reduceAgentGlowState()` turns those events into a minimal visual state model for listening / speaking / interrupted indicators.

## Safe defaults for V1

- keep processing local
- require explicit microphone opt-in
- expose mute and half-duplex truthfully in the UI
- use interruption hooks, not magical echo-cancellation claims
- document known limitations instead of hiding them
