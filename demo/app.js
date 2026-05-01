import {
  PRESET_PROFILES,
  SYNTHETIC_FIXTURES,
  createAgentPulseBridge,
  createBargeKit,
  createOutputDuckingController,
  createSyntheticPresetReport,
  createWebMicrophoneAdapter
} from '../src/index.js';

const stateValue = document.querySelector('#state-value');
const levelValue = document.querySelector('#level-value');
const pulseValue = document.querySelector('#pulse-value');
const presetSelect = document.querySelector('#preset-select');
const modeSelect = document.querySelector('#mode-select');
const speechThreshold = document.querySelector('#speech-threshold');
const fixtureActions = document.querySelector('#fixture-actions');
const fixtureReport = document.querySelector('#fixture-report');
const eventLog = document.querySelector('#event-log');
const duckLog = document.querySelector('#duck-log');
const startMicButton = document.querySelector('#start-mic');
const stopMicButton = document.querySelector('#stop-mic');
const pushButton = document.querySelector('#push-button');
const wakeButton = document.querySelector('#wake-button');
const agentStartButton = document.querySelector('#agent-start');
const agentStopButton = document.querySelector('#agent-stop');

let engine = createEngine();
let adapter = null;
let pulseBridge = createAgentPulseBridge({ sessionId: 'demo-ui' });
let detachPulse = pulseBridge.attach(engine);
let outputController = createOutputDuckingController({
  onDuck: (payload) => appendLog(duckLog, `duck: ${JSON.stringify(payload)}`),
  onInterrupt: (payload) => appendLog(duckLog, `interrupt: ${JSON.stringify(payload)}`),
  onResume: (payload) => appendLog(duckLog, `resume: ${JSON.stringify(payload)}`)
});
let detachOutput = outputController.attach(engine);
let agentTurnCounter = 0;

wireEngine(engine);
populatePresets();
populateFixtures();
fixtureReport.textContent = JSON.stringify(createSyntheticPresetReport(), null, 2);

function createEngine() {
  return createBargeKit({
    mode: modeSelect.value,
    ...PRESET_PROFILES[presetSelect.value || 'laptop_speakers'],
    speechThreshold: Number(speechThreshold.value)
  });
}

function rebuildEngine() {
  detachPulse?.();
  detachOutput?.();
  engine.stop(Date.now());
  engine = createEngine();
  pulseBridge = createAgentPulseBridge({ sessionId: 'demo-ui' });
  detachPulse = pulseBridge.attach(engine);
  outputController = createOutputDuckingController({
    onDuck: (payload) => appendLog(duckLog, `duck: ${JSON.stringify(payload)}`),
    onInterrupt: (payload) => appendLog(duckLog, `interrupt: ${JSON.stringify(payload)}`),
    onResume: (payload) => appendLog(duckLog, `resume: ${JSON.stringify(payload)}`)
  });
  detachOutput = outputController.attach(engine);
  wireEngine(engine);
}

function wireEngine(currentEngine) {
  currentEngine.on('bargekit.state.changed', (event) => {
    stateValue.textContent = event.nextState;
    appendLog(eventLog, `${event.timestamp}: ${event.nextState} (${event.reason})`);
  });
  currentEngine.on('bargekit.user_speech.started', (event) => appendLog(eventLog, `${event.timestamp}: user speech started @ ${event.level.toFixed(2)}`));
  currentEngine.on('bargekit.user_speech.ended', (event) => appendLog(eventLog, `${event.timestamp}: user speech ended after ${event.durationMs}ms`));
  currentEngine.on('bargekit.input.noise_gated', (event) => appendLog(eventLog, `${event.timestamp}: noise gated @ ${event.level.toFixed(2)}`));
  currentEngine.on('bargekit.input.duplex_hold', (event) => appendLog(eventLog, `${event.timestamp}: half duplex hold @ ${event.level.toFixed(2)}`));
  currentEngine.on('bargekit.barge_in.requested', () => {
    pulseValue.textContent = String(pulseBridge.peek().length + 1);
  });
}

function appendLog(node, line) {
  const lines = node.textContent ? node.textContent.split('\n') : [];
  lines.unshift(line);
  node.textContent = lines.slice(0, 18).join('\n');
}

function populatePresets() {
  for (const name of Object.keys(PRESET_PROFILES)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name.replaceAll('_', ' ');
    presetSelect.append(option);
  }
  presetSelect.value = 'laptop_speakers';
}

function populateFixtures() {
  for (const [name, fixture] of Object.entries(SYNTHETIC_FIXTURES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name.replaceAll('_', ' ');
    button.addEventListener('click', () => runFixture(fixture));
    fixtureActions.append(button);
  }
}

function runFixture(fixture) {
  rebuildEngine();
  engine.start(0);
  if (fixture.name === 'interruption_timing' || fixture.name === 'speaker_echo') {
    const token = `agent-turn-${++agentTurnCounter}`;
    outputController.beginAgentOutput(token);
    engine.setAgentSpeaking(true, 0, { token });
  }
  for (const sample of fixture.samples) {
    levelValue.textContent = sample.level.toFixed(2);
    engine.ingestLevel(sample);
  }
  engine.stop(fixture.totalMs + fixture.frameMs);
  fixtureReport.textContent = JSON.stringify(createSyntheticPresetReport(), null, 2);
  pulseValue.textContent = String(pulseBridge.peek().length);
}

presetSelect.addEventListener('change', rebuildEngine);
modeSelect.addEventListener('change', rebuildEngine);
speechThreshold.addEventListener('input', () => {
  rebuildEngine();
  levelValue.textContent = Number(speechThreshold.value).toFixed(2);
});

startMicButton.addEventListener('click', async () => {
  rebuildEngine();
  adapter = createWebMicrophoneAdapter({ engine });
  try {
    await adapter.start();
    startMicButton.disabled = true;
    stopMicButton.disabled = false;
    appendLog(eventLog, 'Microphone started (opt-in only).');
  } catch (error) {
    appendLog(eventLog, `Microphone error: ${error.message}`);
  }
});

stopMicButton.addEventListener('click', async () => {
  await adapter?.stop?.();
  adapter = null;
  startMicButton.disabled = false;
  stopMicButton.disabled = true;
  appendLog(eventLog, 'Microphone stopped.');
});

pushButton.addEventListener('mousedown', () => engine.press(Date.now()));
pushButton.addEventListener('mouseup', () => engine.release(Date.now()));
pushButton.addEventListener('mouseleave', () => engine.release(Date.now()));
wakeButton.addEventListener('click', () => engine.detectWake(Date.now()));

agentStartButton.addEventListener('click', () => {
  const token = `agent-turn-${++agentTurnCounter}`;
  outputController.beginAgentOutput(token);
  engine.setAgentSpeaking(true, Date.now(), { token });
});

agentStopButton.addEventListener('click', () => {
  const snapshot = outputController.getSnapshot();
  if (snapshot.activeOutputToken) {
    outputController.endAgentOutput(snapshot.activeOutputToken);
  }
  engine.setAgentSpeaking(false, Date.now());
});
