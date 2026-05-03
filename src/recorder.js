import { EVENTS } from './contracts.js';

export function createEventRecorder(engine, options = {}) {
  const events = options.events ?? EVENTS;
  const entries = [];
  const unsubs = events.map((eventName) => engine.on(eventName, (event) => {
    entries.push({
      index: entries.length,
      stream: streamForEvent(eventName),
      type: eventName,
      timestamp: event?.timestamp ?? Date.now(),
      event
    });
  }));

  return {
    entries,
    clear() {
      entries.splice(0, entries.length);
    },
    stop() {
      for (const unsub of unsubs.splice(0)) {
        unsub();
      }
    },
    toJSON() {
      return entries.map((entry) => ({ ...entry }));
    }
  };
}

function streamForEvent(eventName) {
  if (eventName.includes('speech')) return 'speech';
  if (eventName.includes('barge')) return 'barge';
  if (eventName.includes('output')) return 'output';
  if (eventName.includes('input')) return 'input';
  if (eventName.includes('state')) return 'state';
  if (eventName.includes('error')) return 'error';
  return 'session';
}
