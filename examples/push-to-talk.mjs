import { createBargeKit } from '../src/index.js';

const barge = createBargeKit({ mode: 'push_to_talk' });
barge.on('bargekit.user_speech.started', () => console.log('PTT speech opened'));
barge.start(0);
barge.ingestLevel({ timestamp: 100, level: 0.9 }); // ignored until pressed
barge.press(200);
barge.ingestLevel({ timestamp: 220, level: 0.9 });
barge.ingestLevel({ timestamp: 360, level: 0.9 });
barge.release(500);
barge.stop(700);
