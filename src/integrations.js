function envelope(type, timestamp, detail = {}, metadata = {}) {
  return {
    type,
    source: 'bargekit',
    timestamp,
    detail,
    metadata
  };
}

export function createOutputDuckingController(options = {}) {
  const {
    clock = () => Date.now(),
    budgetMs = 120,
    onDuck = () => {},
    onInterrupt = () => {},
    onResume = () => {}
  } = options;

  let activeOutputToken = null;
  let lastBargeAt = null;
  let bargedToken = null;

  return {
    attach(engine) {
      const unsubs = [
        engine.on('bargekit.barge_in.requested', (event) => {
          lastBargeAt = event.timestamp;
          bargedToken = activeOutputToken;
          onDuck({ event, token: activeOutputToken, withinBudget: clock() - event.timestamp <= budgetMs });
          onInterrupt({ event, token: activeOutputToken, withinBudget: clock() - event.timestamp <= budgetMs });
        }),
        engine.on('bargekit.user_speech.ended', (event) => {
          if (!activeOutputToken) {
            return;
          }

          if (lastBargeAt !== null && event.timestamp >= lastBargeAt && activeOutputToken === bargedToken) {
            onResume({ event, token: activeOutputToken, resumable: true });
          }
        })
      ];

      return () => {
        for (const unsubscribe of unsubs) {
          unsubscribe();
        }
      };
    },
    beginAgentOutput(token) {
      activeOutputToken = token;
      lastBargeAt = null;
      bargedToken = null;
      return { activeOutputToken };
    },
    endAgentOutput(token) {
      if (token === activeOutputToken) {
        activeOutputToken = null;
      }
      if (token === bargedToken) {
        bargedToken = null;
      }
      return { activeOutputToken };
    },
    getSnapshot() {
      return { activeOutputToken, lastBargeAt, bargedToken };
    }
  };
}

export function createAgentPulseBridge(options = {}) {
  const {
    sessionId = 'bargekit-demo',
    origin = 'bargekit'
  } = options;

  const queue = [];

  function push(type, event, detail = {}) {
    queue.push(envelope(type, event.timestamp, detail, {
      origin,
      sessionId,
      bargekitType: event.type
    }));
  }

  return {
    attach(engine) {
      const unsubs = [
        engine.on('bargekit.user_speech.started', (event) => push('user.speech.started', event, {
          startedAt: event.startedAt,
          level: event.level
        })),
        engine.on('bargekit.user_speech.ended', (event) => push('user.speech.ended', event, {
          durationMs: event.durationMs,
          peakLevel: event.peakLevel
        })),
        engine.on('bargekit.input.muted', (event) => push('input.muted', event, { muted: event.muted })),
        engine.on('bargekit.input.noise_gated', (event) => push('input.noise_gated', event, { level: event.level })),
        engine.on('bargekit.barge_in.requested', (event) => push('barge_in.requested', event, { level: event.level })),
        engine.on('bargekit.input.duplex_hold', (event) => push('input.half_duplex_hold', event, { level: event.level }))
      ];

      return () => {
        for (const unsubscribe of unsubs) {
          unsubscribe();
        }
      };
    },
    drain() {
      return queue.splice(0, queue.length);
    },
    peek() {
      return [...queue];
    }
  };
}

export function reduceAgentGlowState(state, event) {
  switch (event.type) {
    case 'user.speech.started':
      return { ...state, listening: true, speaking: false, lastEvent: event.type };
    case 'user.speech.ended':
      return { ...state, listening: false, speaking: false, lastEvent: event.type };
    case 'barge_in.requested':
      return { ...state, listening: true, speaking: true, interrupted: true, lastEvent: event.type };
    case 'input.muted':
      return { ...state, muted: true, listening: false, lastEvent: event.type };
    case 'input.noise_gated':
      return { ...state, noiseGated: true, lastEvent: event.type };
    case 'input.half_duplex_hold':
      return { ...state, duplexHold: true, lastEvent: event.type };
    default:
      return { ...state, lastEvent: event.type };
  }
}
