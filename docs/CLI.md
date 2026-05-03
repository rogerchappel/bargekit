# CLI reference

The `bargekit` binary is a local fixture and demo helper. It does not open the microphone.

## `bargekit fixtures`

List built-in synthetic fixtures.

```sh
bargekit fixtures
bargekit fixtures --json
```

## `bargekit tune`

Analyze a fixture and print threshold guidance.

```sh
bargekit tune --fixture tests/fixtures/long_utterance.json
bargekit tune --fixture tests/fixtures/long_utterance.json --json
```

## `bargekit smoke`

Run a fixture through the engine and fail if no user speech is detected.

```sh
bargekit smoke --fixture tests/fixtures/interruption_timing.json
bargekit smoke --fixture tests/fixtures/interruption_timing.json --json
```

## `bargekit demo`

Print local demo server instructions.

```sh
bargekit demo
python3 -m http.server 4173
# open http://localhost:4173/demo/
```
