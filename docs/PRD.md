# bargekit

Status: ready
Decision: promising

## Scorecard

Total: 83/100
Band: promising
Last scored: 2026-05-01
Scored by: Neo

| Criterion | Points | Notes |
|---|---:|---|
| Problem pain | 18/20 | Voice agents feel broken when users cannot interrupt naturally or when microphones pick up the agent speaking. |
| Demand signal | 16/20 | Strong internal need for mobile/desktop voice agents and broad external voice-agent momentum. |
| V1 buildability | 15/20 | Browser/device VAD and turn-taking are feasible; echo cancellation and cross-platform audio quirks add risk. |
| Differentiation | 13/15 | Focuses narrowly on turn-taking, interruption, and audio gating rather than full STT/TTS or assistant frameworks. |
| Agentic workflow leverage | 14/15 | Makes VoicePath and CrewCmd voice interactions feel fast, interruptible, and human. |
| Distribution potential | 7/10 | Easy to demo with before/after barge-in latency and echo prevention. |

## Pitch

A local-first audio turn-taking SDK for voice agents: voice activity detection, barge-in, echo guarding, push-to-talk, wake hooks, and interruption events.

## Why It Matters

Great voice agents are not just good voices. They need conversation mechanics: knowing when the user starts talking, cutting off speech quickly, ignoring their own audio output, and recovering cleanly after interruptions.

`voicepath` handles speech output routing. `bargekit` handles the microphone side of the exchange so agent apps can feel natural instead of walkie-talkie awkward.

## Qualification

### Pub Test

“Drop in natural voice turn-taking for your agent: detect speech, avoid echo, and let users interrupt without building an audio stack from scratch.”

### Competitors / Adjacent Tools

- WebRTC VAD, Silero VAD, browser speech APIs, and platform audio APIs — useful primitives but not a polished app-level turn-taking SDK.
- Realtime voice assistant frameworks — validate barge-in demand, but often require adopting the whole stack.
- Provider-specific realtime APIs — powerful when online, but they do not provide a portable local fallback or consistent UI event contract.

### Star / Demand Signal

Voice-agent demos increasingly compete on latency and interruption quality. Roger’s own use case is direct: CrewCmd/OpenClaw voice should handle driving/mobile use, half-duplex fallback, and degraded network conditions without feeling clumsy.

### Real Problem

Common failures in agent voice products:

- the user talks over the agent but nothing happens
- the agent hears its own speaker output and responds to itself
- the UI says “listening” when input is actually muted or gated
- wake/push-to-talk modes are inconsistent across platforms
- cloud voice APIs work, but local fallback has no turn-taking discipline

### V1 Buildability

V1 can start with browser and Node/Electron-friendly primitives:

- audio analyser input
- simple VAD thresholding with pluggable advanced VAD later
- interruption events
- output playback ducking/cancellation hooks
- configurable hold/silence windows
- deterministic tests using synthetic audio levels

## V1 Scope

- Package: `@bargekit/core` for turn-taking state machine and event policy.
- Package: `@bargekit/web` for browser microphone/analyser integration.
- Modes:
  - push-to-talk
  - open microphone with VAD
  - wake-hook compatible mode
  - half-duplex fallback
- Events:
  - user-speech-started
  - user-speech-ended
  - barge-in-requested
  - output-duck-requested
  - input-muted
  - input-noise-gated
- Configurable thresholds, debounce windows, silence duration, minimum utterance duration, and interruption policy.
- Demo app showing live mic level, speech segments, and interruption timing.
- Integration notes for VoicePath and AgentPulse.

## Out of Scope

- Full STT transcription.
- Full TTS playback/routing.
- Wake-word model training.
- Always-on cloud microphone service.
- Covert recording or hidden microphone access.
- Guaranteed enterprise-grade echo cancellation in V1.

## CLI/API Sketch

```ts
import { createBargeKit } from '@bargekit/core';

const barge = createBargeKit({
  mode: 'vad',
  minSpeechMs: 120,
  silenceMs: 450,
  bargeIn: { enabled: true, whileAgentSpeaking: true },
});

barge.on('barge-in-requested', () => voicepath.interrupt());
barge.on('user-speech-started', () => agentpulse.emit({ type: 'user.speech.started' }));
```

```bash
bargekit demo
bargekit tune --profile laptop-speakers
```

## Verification

- State machine tests for speech start/end, silence, debounce, and interruption.
- Synthetic audio-level fixtures.
- Browser demo with microphone opt-in only.
- README documents privacy, local processing, and platform limitations.
- No hidden network calls.

## Agent Prompt

Build `bargekit` as a local-first turn-taking SDK for voice agent apps. Keep it narrowly focused on VAD, interruption, microphone state, and echo/duplex policy hooks. It should pair cleanly with VoicePath rather than replace it.
