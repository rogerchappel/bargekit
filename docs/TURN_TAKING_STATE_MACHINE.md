# BargeKit Turn-Taking State Machine

Status: Wave 1 canonical contract
Spec version: `1.0.0`

## Product North Star

BargeKit is the local-first turn-taking layer for voice agents. It decides when microphone input is accepted, ignored, noise-gated, or treated as an interruption so agent apps can feel naturally interruptible without adopting a full voice-agent framework.

## Design Goals

- **Local-first:** core state machine and default audio-level policy run locally.
- **Deterministic:** the same input signal sequence must produce the same state/events.
- **Interruptible:** barge-in is a first-class transition, not an afterthought.
- **Echo-aware:** agent output can gate or duck microphone handling.
- **Mode-aware:** push-to-talk, VAD, wake-hook, and half-duplex behavior use the same states with different guards.
- **Observable:** every state transition emits an event suitable for UI, VoicePath, and AgentPulse integrations.

## Modes

| Mode | Meaning |
|---|---|
| `push_to_talk` | Input is accepted only while an explicit push control is active. |
| `vad` | Voice activity detection opens/closes speech segments. |
| `wake_hook` | External wake detector arms BargeKit before VAD/segment handling. |
| `half_duplex` | Microphone input is muted while agent output is active unless interruption is explicitly enabled. |

## States

| State | Meaning |
|---|---|
| `idle` | No active input/output gating. |
| `armed` | Ready to accept user speech, waiting for a qualifying signal. |
| `listening` | Microphone input is open and being evaluated. |
| `user_speaking` | User speech segment is active. |
| `agent_speaking` | Agent output is active. |
| `barge_pending` | User speech is detected while agent output is active and may interrupt. |
| `interrupted` | Agent output was interrupted by user speech. |
| `muted` | Input is intentionally closed by policy or host app. |
| `noise_gated` | Input signal exists but is below speech qualification policy. |
| `cooldown` | Short guard window after speech/interruption to prevent flapping. |
| `error` | State machine cannot continue without host intervention. |

## Inputs

| Input | Required data | Meaning |
|---|---|---|
| `session.start` | `mode` | Turn-taking session begins. |
| `session.stop` | `reason` | Turn-taking session ends. |
| `mic.level` | `level`, `timeMs` | Audio level sample or aggregate. |
| `vad.speech.start` | `confidence`, `timeMs` | VAD says speech began. |
| `vad.speech.end` | `confidence`, `timeMs` | VAD says speech ended. |
| `push.down` | `timeMs` | Push-to-talk pressed. |
| `push.up` | `timeMs` | Push-to-talk released. |
| `wake.detected` | `confidence`, `timeMs` | External wake hook fired. |
| `agent.output.start` | `outputId` | Agent audio playback began. |
| `agent.output.end` | `outputId` | Agent audio playback ended. |
| `agent.output.ducked` | `outputId` | Output was ducked by host/VoicePath. |
| `mute.on` | `reason` | Host muted input. |
| `mute.off` | `reason` | Host unmuted input. |
| `config.update` | `patch` | Runtime policy changed. |
| `error.raise` | `code`, `summary` | Host or adapter reported a failure. |

## Configuration Contract

```json
{
  "mode": "vad",
  "speechThreshold": 0.62,
  "noiseFloor": 0.12,
  "minSpeechMs": 120,
  "silenceMs": 450,
  "debounceMs": 80,
  "cooldownMs": 250,
  "bargeIn": {
    "enabled": true,
    "whileAgentSpeaking": true,
    "minSpeechMs": 140,
    "duckOutput": true
  },
  "echoGuard": {
    "enabled": true,
    "suppressWhileOutput": false,
    "duckOnBarge": true
  }
}
```

Required fields: `mode`, `minSpeechMs`, `silenceMs`, `debounceMs`, `bargeIn.enabled`.

## Transition Rules

### Session lifecycle

- `idle` + `session.start` -> `armed`
- any non-terminal state + `session.stop` -> `idle`
- any state + `error.raise` -> `error`

### Push-to-talk

- `armed` + `push.down` -> `listening`
- `listening` + qualifying speech -> `user_speaking`
- `user_speaking` + `push.up` -> `cooldown`
- `cooldown` after `cooldownMs` -> `armed`

### VAD/open microphone

- `armed` + qualifying `vad.speech.start` -> `user_speaking`
- `armed` + level below threshold but above noise floor -> `noise_gated`
- `noise_gated` + qualifying speech -> `user_speaking`
- `noise_gated` + silence for `silenceMs` -> `armed`
- `user_speaking` + silence for `silenceMs` -> `cooldown`
- `cooldown` after `cooldownMs` -> `armed`

### Agent output and barge-in

- `armed` + `agent.output.start` -> `agent_speaking`
- `agent_speaking` + qualifying user speech when barge-in enabled -> `barge_pending`
- `barge_pending` after `bargeIn.minSpeechMs` -> `interrupted`
- `interrupted` emits output interruption/duck request and then -> `user_speaking`
- `agent_speaking` + `agent.output.end` -> `armed`
- `agent_speaking` + user speech when barge-in disabled -> `noise_gated` or remain `agent_speaking` depending on `echoGuard.suppressWhileOutput`

### Muting

- any non-error state + `mute.on` -> `muted`
- `muted` + `mute.off` -> `armed`
- `muted` ignores speech/VAD inputs but may record suppressed events.

## Event Contract

| Event | Emitted when |
|---|---|
| `bargekit.session.started` | Session enters `armed`. |
| `bargekit.session.stopped` | Session returns to `idle`. |
| `bargekit.state.changed` | Any state transition occurs. |
| `bargekit.user_speech.started` | User speech segment starts. |
| `bargekit.user_speech.ended` | User speech segment ends. |
| `bargekit.barge_in.requested` | Barge-in threshold is satisfied. |
| `bargekit.output.duck_requested` | Output should duck for interruption. |
| `bargekit.output.cancel_requested` | Output should stop for interruption. |
| `bargekit.input.muted` | Input is muted by host/policy. |
| `bargekit.input.noise_gated` | Input is suppressed as noise/echo. |
| `bargekit.error.recorded` | State machine enters `error`. |

Events include `sessionId`, `state`, `previousState`, `mode`, `timeMs`, and `reason` when applicable.

## Invariants

- `user_speaking` and `agent_speaking` may overlap only through `barge_pending`/`interrupted`; otherwise the machine must choose a policy outcome.
- No barge-in may be emitted unless `bargeIn.enabled` is true.
- No speech segment starts until `minSpeechMs` is satisfied.
- No speech segment ends until `silenceMs` is satisfied.
- Muted input cannot produce `user_speech.started`.
- Echo/noise suppression must emit an observable suppression event.
- The core contract never sends audio off-device.

## Integration Notes

- VoicePath should subscribe to `bargekit.output.cancel_requested` or `bargekit.output.duck_requested` to interrupt playback.
- AgentPulse should map speech and interruption events into its canonical event stream.
- AgentGlow can render listening/speaking/interrupted states from `bargekit.state.changed`.
