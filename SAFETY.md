# Safety posture

BargeKit is deliberately boring about microphones.

- **No covert listening.** Core APIs process numeric levels passed by the host app; the browser adapter asks for microphone access only after a user gesture.
- **No hidden network calls.** VAD, fixtures, tuning reports, and demo logic run locally.
- **No recording by default.** V1 stores event metadata and synthetic samples, not raw user audio.
- **Honest echo limits.** BargeKit can gate, duck, cancel, and hold input policy; it does not claim universal acoustic echo cancellation.
- **Visible state.** Apps should surface muted, held, listening, speaking, interrupted, and error states to users.

If you add integrations that touch real microphones, preserve these defaults: explicit permission, local-first processing, and clear UI state.
