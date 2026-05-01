# BargeKit Turn-Taking State Machine

Status: canonical contract after Wave 3 foundations
Spec version: `1.1.0`

## Product North Star

BargeKit is the local-first turn-taking layer for voice agents. It decides when microphone input is accepted, ignored, noise-gated, duplex-held, or treated as an interruption so agent apps can feel naturally interruptible without adopting a full voice stack.

## Design Goals

- **Local-first:** core state machine and default audio-level policy run locally.
- **Deterministic:** the same input signal sequence must produce the same state/events.
- **Interruptible:** barge-in is a first-class transition, not an afterthought.
- **Echo-aware:** agent output can gate, duck, or cancel microphone handling.
- **Mode-aware:** push-to-talk, VAD, wake-hook, and half-duplex behavior use the same state vocabulary with different guards.
- **Observable:** every important transition emits events suitable for UI, VoicePath, and AgentPulse integrations.

## Modes

| Mode | Meaning |
|---|---|
| `push_to_talk` | Input is accepted only while an explicit push control is active. |
| `vad` | Voice activity detection opens/closes speech segments. |
| `wake_hook` | External wake detector arms BargeKit before VAD/segment handling. |
| `half_duplex` | Microphone input is held while agent output is active unless the host changes policy. |

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
| `mic.level` | `level`, `timestamp` | Audio level sample or aggregate. |
| `vad.speech.start` | `timestamp` | Derived internal speech-start decision. |
| `vad.speech.end` | `timestamp` | Derived internal speech-end decision. |
| `push.down` | `timestamp` | Push-to-talk pressed. |
| `push.up` | `timestamp` | Push-to-talk released. |
| `wake.detected` | `timestamp` | External wake hook fired. |
| `agent.output.start` | `token` | Agent audio playback began. |
| `agent.output.end` | `token` | Agent audio playback ended. |
| `agent.output.ducked` | `token` | Output was ducked by host/VoicePath. |
| `mute.on` | `reason` | Host muted input. |
| `mute.off` | `reason` | Host unmuted input. |
| `config.update` | `patch` | Runtime policy changed. |
| `error.raise` | `message` | Host or adapter reported a failure. |

## Configuration Contract

```json
{
  "mode": "vad",
  "speechThreshold": 0.58,
  "noiseFloorThreshold": 0.18,
  "minSpeechMs": 120,
  "silenceMs": 450,
  "debounceMs": 80,
  "cooldownMs": 160,
  "wakeWindowMs": 4000,
  "halfDuplex": {
    "preventWhileAgentSpeaking": true
  },
  "bargeIn": {
    "enabled": true,
    "whileAgentSpeaking": true,
    "cancelOutput": true,
    "duckOutput": true
  }
}
```

Required fields: `mode`, `speechThreshold`, `noiseFloorThreshold`, `minSpeechMs`, `silenceMs`, `debounceMs`, `cooldownMs`, `bargeIn.enabled`.

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

- `armed` + qualifying speech -> `user_speaking`
- `armed` + level below `speechThreshold` but above `noiseFloorThreshold` -> `noise_gated`
- `noise_gated` + qualifying speech -> `user_speaking`
- `user_speaking` + silence for `silenceMs` -> `cooldown`
- `cooldown` after `cooldownMs` -> `armed`

### Wake-hook

- `armed` ignores speech until `wake.detected`
- `wake.detected` -> `listening`
- `listening` + qualifying speech inside `wakeWindowMs` -> `user_speaking`
- `wakeWindowMs` expiry without speech -> `armed`

### Agent output and barge-in

- `armed` + `agent.output.start` -> `agent_speaking`
- `agent_speaking` + qualifying user speech when barge-in enabled -> `barge_pending`
- `barge_pending` emits `bargekit.barge_in.requested`
- if `duckOutput` -> emit `bargekit.output.duck_requested`
- if `cancelOutput` -> emit `bargekit.output.cancel_requested`
- `barge_pending` + sustained speech -> `interrupted`
- `interrupted` may proceed to `user_speaking` once output ends or host policy releases the turn

### Half-duplex hold

- `half_duplex` + `agent.output.start` -> `agent_speaking`
- `agent_speaking` + microphone activity above noise floor -> emit `bargekit.input.duplex_hold`
- `agent.output.end` -> `armed`

### Muting

- any non-error state + `mute.on` -> `muted`
- `muted` + `mute.off` -> `armed` or `agent_speaking` depending on output state
- `muted` ignores speech/VAD inputs but may emit suppressed-state observability

## Event Contract

| Event | Emitted when |
|---|---|
| `bargekit.session.started` | Session enters `armed`. |
| `bargekit.session.stopped` | Session returns to `idle`. |
| `bargekit.state.changed` | Any state transition occurs. |
| `bargekit.user_speech.started` | User speech segment starts. |
| `bargekit.user_speech.ended` | User speech segment ends. |
| `bargekit.barge_in.requested` | Barge-in threshold is satisfied while agent audio is active. |
| `bargekit.output.duck_requested` | Output should duck for interruption. |
| `bargekit.output.cancel_requested` | Output should stop for interruption. |
| `bargekit.input.muted` | Input is muted by host/policy. |
| `bargekit.input.noise_gated` | Input is suppressed as noise/echo. |
| `bargekit.input.duplex_hold` | Half-duplex policy is holding microphone activity during agent output. |
| `bargekit.error.recorded` | State machine enters `error`. |

Events include timestamps and state or policy metadata when applicable.

## Invariants

- `user_speaking` and `agent_speaking` may overlap only through `barge_pending` / `interrupted`; otherwise the machine must choose a policy outcome.
- No barge-in may be emitted unless `bargeIn.enabled` is true.
- No speech segment starts until both debounce and minimum speech windows are satisfied.
- No speech segment ends until `silenceMs` is satisfied.
- Muted input cannot produce `user_speech.started`.
- Echo/noise suppression must emit an observable suppression event.
- The core contract never sends audio off-device.

## Integration Notes

- VoicePath should subscribe to `bargekit.output.cancel_requested` or `bargekit.output.duck_requested` to interrupt playback.
- AgentPulse should map speech, mute, noise, duplex-hold, and interruption events into its canonical event stream.
- AgentGlow can render listening/speaking/interrupted states from `bargekit.state.changed` or the reducer helper.
