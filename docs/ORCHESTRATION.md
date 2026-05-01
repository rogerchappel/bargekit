# Orchestration Handoff

## Summary

- Workspace: default
- Repository: bargekit
- Source: assistant-authored from PRD.md by Neo; designed as LLM-quality orchestration with explicit concurrency waves
- Total tasks: 9
- Dispatch now: bargekit-define-turn-taking-state-machine
- Blocked tasks: bargekit-real-world-quality-pass

## Product North Star

Build a local-first turn-taking SDK that makes voice agents interruptible, microphone-aware, echo-conscious, and honest about listening state.

## Dispatch Prompt

Dispatch Wave 1 first. These tasks may run concurrently:
- bargekit-define-turn-taking-state-machine

Wait for the whole wave to finish and pass verification before dispatching the next sequential wave. Inside a concurrent wave, assign separate agents to separate branches and merge only after each task meets its acceptance criteria.

## LLM Refinement Notes
- Turn-taking is a state machine product. Nail timing semantics before chasing advanced VAD models.
- The fastest path is synthetic audio fixtures first, then browser demo, then real-world tuning profiles.
- It must pair cleanly with VoicePath and AgentPulse: interruption and input state should be first-class events.
- Privacy posture must be explicit: local processing by default, microphone opt-in only, no covert recording.

## Concurrency Strategy

The best concurrency path is to protect the product contract first, then split work by stable interface boundaries. Do not dispatch renderer/provider/UI/demo work before the contracts they consume are stable. Once a wave is open, prefer parallel agents with narrow ownership and explicit handoff notes.

## Sequential Waves

### Wave 1: Turn-taking contract

- Mode inside wave: sequential
- Dispatch: now
- Tasks: bargekit-define-turn-taking-state-machine

### Wave 2: Core engine and synthetic proof

- Mode inside wave: concurrent
- Dispatch: after_dependencies
- Tasks: bargekit-build-core-state-engine, bargekit-synthetic-audio-fixtures

### Wave 3: Device and ecosystem integration

- Mode inside wave: concurrent
- Dispatch: after_dependencies
- Tasks: bargekit-web-microphone-adapter, bargekit-output-ducking-hooks, bargekit-agentpulse-events

### Wave 4: Demo and documentation

- Mode inside wave: concurrent
- Dispatch: after_dependencies
- Tasks: bargekit-demo-and-tuning-ui, bargekit-docs-privacy-platform-guide

### Wave 5: Real-world quality pass

- Mode inside wave: sequential
- Dispatch: after_human_decision
- Tasks: bargekit-real-world-quality-pass

## Task Dependencies

### bargekit-define-turn-taking-state-machine: Define turn-taking state machine and audio policy contract

- Phase: foundation
- Repo: bargekit
- Branch: agent/define-turn-taking-state-machine
- Risk: medium
- Depends on: None
- Can run concurrently with: None
- Dispatchable now: Yes
- Blocked by: None

**Objective**

Specify modes, states, events, thresholds, timing windows, barge-in policy, echo/duplex hooks, and integration contracts with VoicePath/AgentPulse.

**Acceptance Criteria**

Architecture doc and types define push-to-talk, VAD, wake-hook, half-duplex, muted, speech, silence, and interruption semantics.

### bargekit-build-core-state-engine: Build core turn-taking state engine

- Phase: implementation
- Repo: bargekit
- Branch: agent/build-core-state-engine
- Risk: medium
- Depends on: bargekit-define-turn-taking-state-machine
- Can run concurrently with: bargekit-synthetic-audio-fixtures
- Dispatchable now: No
- Blocked by: None

**Objective**

Implement @bargekit/core with deterministic level ingestion, debounce, min speech, silence detection, interruption policy, and event emitter.

**Acceptance Criteria**

Synthetic tests cover speech start/end, noise gate, debounce, silence windows, barge-in while speaking, muted input, and half-duplex.

### bargekit-synthetic-audio-fixtures: Create synthetic audio fixtures and tuning harness

- Phase: verification
- Repo: bargekit
- Branch: agent/synthetic-audio-fixtures
- Risk: low
- Depends on: bargekit-define-turn-taking-state-machine
- Can run concurrently with: bargekit-build-core-state-engine
- Dispatchable now: No
- Blocked by: None

**Objective**

Build deterministic fixtures for quiet room, keyboard noise, short utterance, long utterance, speaker echo, and interruption timing.

**Acceptance Criteria**

Fixtures are reusable in tests and demos; tuning output explains threshold decisions.

### bargekit-web-microphone-adapter: Build browser microphone/analyser adapter

- Phase: implementation
- Repo: bargekit
- Branch: agent/web-microphone-adapter
- Risk: medium
- Depends on: bargekit-build-core-state-engine
- Can run concurrently with: bargekit-output-ducking-hooks, bargekit-agentpulse-events
- Dispatchable now: No
- Blocked by: None

**Objective**

Implement @bargekit/web with explicit permission flow, analyser sampling, cleanup, device errors, and no hidden recording.

**Acceptance Criteria**

Browser smoke tests/mocks verify permission denied, device unavailable, start/stop cleanup, and level streaming.

### bargekit-output-ducking-hooks: Implement output ducking and VoicePath interruption hooks

- Phase: integration
- Repo: bargekit
- Branch: agent/output-ducking-hooks
- Risk: medium
- Depends on: bargekit-build-core-state-engine
- Can run concurrently with: bargekit-web-microphone-adapter, bargekit-agentpulse-events
- Dispatchable now: No
- Blocked by: None

**Objective**

Expose events and helpers so VoicePath can interrupt, duck, resume, or hold output when user speech begins.

**Acceptance Criteria**

Integration tests prove barge-in-requested fires within timing budget and stale output is not resumed incorrectly.

### bargekit-agentpulse-events: Map turn-taking events to AgentPulse contract

- Phase: integration
- Repo: bargekit
- Branch: agent/agentpulse-events
- Risk: low
- Depends on: bargekit-build-core-state-engine
- Can run concurrently with: bargekit-web-microphone-adapter, bargekit-output-ducking-hooks
- Dispatchable now: No
- Blocked by: None

**Objective**

Publish event mapping for user speech started/ended, input muted, noise gated, barge-in requested, and half-duplex hold.

**Acceptance Criteria**

Fixture-backed examples drive AgentPulse reducer and AgentGlow listening/speaking visuals.

### bargekit-demo-and-tuning-ui: Build live demo and tuning UI

- Phase: demo
- Repo: bargekit
- Branch: agent/demo-and-tuning-ui
- Risk: medium
- Depends on: bargekit-web-microphone-adapter, bargekit-output-ducking-hooks, bargekit-agentpulse-events
- Can run concurrently with: bargekit-docs-privacy-platform-guide
- Dispatchable now: No
- Blocked by: None

**Objective**

Create a browser demo showing mic level, detected segments, thresholds, interruption timing, and before/after barge-in behaviour.

**Acceptance Criteria**

Demo is opt-in mic only, includes synthetic playback mode, profile presets, and an obvious “interrupt the agent” scenario.

### bargekit-docs-privacy-platform-guide: Write privacy, platform, and integration docs

- Phase: documentation
- Repo: bargekit
- Branch: agent/docs-privacy-platform-guide
- Risk: low
- Depends on: bargekit-demo-and-tuning-ui
- Can run concurrently with: bargekit-demo-and-tuning-ui
- Dispatchable now: No
- Blocked by: None

**Objective**

Document local processing, platform limits, echo caveats, tuning recipes, VoicePath integration, AgentPulse events, and safe default configs.

**Acceptance Criteria**

README is clear about what V1 does and does not guarantee; no enterprise echo-cancellation overclaiming.

### bargekit-real-world-quality-pass: Run real-world quality pass and release checklist

- Phase: final_validation
- Repo: bargekit
- Branch: agent/real-world-quality-pass
- Risk: high
- Depends on: bargekit-docs-privacy-platform-guide
- Can run concurrently with: None
- Dispatchable now: No
- Blocked by: approve high-risk scope before dispatch

**Objective**

Test on at least laptop speaker/mic and headset-style paths if available, then produce a release readiness checklist and known limitations.

**Acceptance Criteria**

Human/product review confirms interaction feels natural enough to pair with VoicePath demos.
