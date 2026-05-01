# Task Queue: bargekit

Source: assistant-authored from PRD.md by Neo; designed as LLM-quality orchestration with explicit concurrency waves
Format: assistant-authored orchestration derived from docs/PRD.md

## Product North Star

Build a local-first turn-taking SDK that makes voice agents interruptible, microphone-aware, echo-conscious, and honest about listening state.

## Tasks

### bargekit-define-turn-taking-state-machine: Define turn-taking state machine and audio policy contract

- Repo: `bargekit`
- Phase: `foundation`
- Risk: `medium`
- Branch: `agent/define-turn-taking-state-machine`
- Depends on: None

**Objective**

Specify modes, states, events, thresholds, timing windows, barge-in policy, echo/duplex hooks, and integration contracts with VoicePath/AgentPulse.

**Acceptance Criteria**

Architecture doc and types define push-to-talk, VAD, wake-hook, half-duplex, muted, speech, silence, and interruption semantics.

### bargekit-build-core-state-engine: Build core turn-taking state engine

- Repo: `bargekit`
- Phase: `implementation`
- Risk: `medium`
- Branch: `agent/build-core-state-engine`
- Depends on: `bargekit-define-turn-taking-state-machine`

**Objective**

Implement @bargekit/core with deterministic level ingestion, debounce, min speech, silence detection, interruption policy, and event emitter.

**Acceptance Criteria**

Synthetic tests cover speech start/end, noise gate, debounce, silence windows, barge-in while speaking, muted input, and half-duplex.

### bargekit-synthetic-audio-fixtures: Create synthetic audio fixtures and tuning harness

- Repo: `bargekit`
- Phase: `verification`
- Risk: `low`
- Branch: `agent/synthetic-audio-fixtures`
- Depends on: `bargekit-define-turn-taking-state-machine`

**Objective**

Build deterministic fixtures for quiet room, keyboard noise, short utterance, long utterance, speaker echo, and interruption timing.

**Acceptance Criteria**

Fixtures are reusable in tests and demos; tuning output explains threshold decisions.

### bargekit-web-microphone-adapter: Build browser microphone/analyser adapter

- Repo: `bargekit`
- Phase: `implementation`
- Risk: `medium`
- Branch: `agent/web-microphone-adapter`
- Depends on: `bargekit-build-core-state-engine`

**Objective**

Implement @bargekit/web with explicit permission flow, analyser sampling, cleanup, device errors, and no hidden recording.

**Acceptance Criteria**

Browser smoke tests/mocks verify permission denied, device unavailable, start/stop cleanup, and level streaming.

### bargekit-output-ducking-hooks: Implement output ducking and VoicePath interruption hooks

- Repo: `bargekit`
- Phase: `integration`
- Risk: `medium`
- Branch: `agent/output-ducking-hooks`
- Depends on: `bargekit-build-core-state-engine`

**Objective**

Expose events and helpers so VoicePath can interrupt, duck, resume, or hold output when user speech begins.

**Acceptance Criteria**

Integration tests prove barge-in-requested fires within timing budget and stale output is not resumed incorrectly.

### bargekit-agentpulse-events: Map turn-taking events to AgentPulse contract

- Repo: `bargekit`
- Phase: `integration`
- Risk: `low`
- Branch: `agent/agentpulse-events`
- Depends on: `bargekit-build-core-state-engine`

**Objective**

Publish event mapping for user speech started/ended, input muted, noise gated, barge-in requested, and half-duplex hold.

**Acceptance Criteria**

Fixture-backed examples drive AgentPulse reducer and AgentGlow listening/speaking visuals.

### bargekit-demo-and-tuning-ui: Build live demo and tuning UI

- Repo: `bargekit`
- Phase: `demo`
- Risk: `medium`
- Branch: `agent/demo-and-tuning-ui`
- Depends on: `bargekit-web-microphone-adapter`, `bargekit-output-ducking-hooks`, `bargekit-agentpulse-events`

**Objective**

Create a browser demo showing mic level, detected segments, thresholds, interruption timing, and before/after barge-in behaviour.

**Acceptance Criteria**

Demo is opt-in mic only, includes synthetic playback mode, profile presets, and an obvious “interrupt the agent” scenario.

### bargekit-docs-privacy-platform-guide: Write privacy, platform, and integration docs

- Repo: `bargekit`
- Phase: `documentation`
- Risk: `low`
- Branch: `agent/docs-privacy-platform-guide`
- Depends on: `bargekit-demo-and-tuning-ui`

**Objective**

Document local processing, platform limits, echo caveats, tuning recipes, VoicePath integration, AgentPulse events, and safe default configs.

**Acceptance Criteria**

README is clear about what V1 does and does not guarantee; no enterprise echo-cancellation overclaiming.

### bargekit-real-world-quality-pass: Run real-world quality pass and release checklist

- Repo: `bargekit`
- Phase: `final_validation`
- Risk: `high`
- Branch: `agent/real-world-quality-pass`
- Depends on: `bargekit-docs-privacy-platform-guide`

**Objective**

Test on at least laptop speaker/mic and headset-style paths if available, then produce a release readiness checklist and known limitations.

**Acceptance Criteria**

Human/product review confirms interaction feels natural enough to pair with VoicePath demos.
