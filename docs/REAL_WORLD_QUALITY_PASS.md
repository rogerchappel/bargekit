# Real-World Quality Pass

Status: partial overnight pass complete

## Goal

Check whether BargeKit feels natural enough for VoicePath-flavored demos on real device paths, then capture what still needs human product judgment.

## What was completed overnight

### Local verification

- synthetic interruption path verified in automated tests
- half-duplex suppression verified in automated tests
- browser microphone adapter start/stop and permission denial paths verified in automated tests
- demo UI shipped for manual laptop/headset testing

### Manual-ready checklist

Use the demo at `/demo/` and run these scenarios:

1. **Laptop speaker + built-in mic**
   - start from `laptop_speakers`
   - click “Agent starts speaking”
   - talk over it and confirm duck/cancel requests appear quickly
   - verify keyboard taps produce noise-gated events more often than speech events
2. **Headset path**
   - switch to `wired_headset`
   - confirm lower threshold still avoids false starts
   - verify interruption feels faster and cleaner than laptop speakers
3. **Half-duplex fallback**
   - select `half_duplex`
   - confirm mic holds while agent output is active
   - confirm user speech opens again after agent output ends
4. **Wake-hook honesty**
   - select `wake_hook`
   - confirm speech does not open until wake signal is fired
5. **Push-to-talk safety**
   - select `push_to_talk`
   - confirm speech is ignored unless the push button is held

## Release-readiness checklist

- [x] Core state machine documented and implemented
- [x] Synthetic fixtures cover quiet/noise/utterance/echo/interruption cases
- [x] Browser microphone adapter requires explicit permission
- [x] VoicePath-style duck/cancel hooks exist
- [x] AgentPulse event mapping exists
- [x] Demo supports synthetic mode and live mic mode
- [x] README documents privacy posture and limitations
- [ ] Human/product review confirms laptop speaker path feels natural enough
- [ ] Human/product review confirms headset path feels natural enough

## Known limitations

- No true acoustic echo cancellation engine is implemented.
- Threshold tuning is heuristic and will vary across browsers and hardware.
- Wake-word detection is an external hook, not part of this package.
- Real-world release confidence is blocked on human ears, room acoustics, and hardware testing.

## Decision

Engineering foundation is ready for human review.

Release should stay in demo/prototype status until the two manual hardware checks above are signed off.
