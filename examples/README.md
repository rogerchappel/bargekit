# Examples

These examples are intentionally small and local. They use synthetic fixtures unless the browser demo asks for microphone permission.

- `node-vad.mjs` — run the VAD state machine against a built-in long-utterance fixture.
- `push-to-talk.mjs` — show that push-to-talk ignores hot levels until the user holds the gate open.
- `fixture-smoke.mjs` — load a JSON fixture from `tests/fixtures/` and print a smoke-test summary.

```sh
node examples/node-vad.mjs
node examples/push-to-talk.mjs
node examples/fixture-smoke.mjs tests/fixtures/interruption_timing.json
```
