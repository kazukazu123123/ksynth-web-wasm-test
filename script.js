document.addEventListener('DOMContentLoaded', () => {
  const ksynthWorker = new Worker('ksynth/ksynthWorker.js');

  window.ksynthWorker = ksynthWorker;

  const limiter = new Limiter();
  const player = new PCMF32Player(960, 2);

  player.onEnded(() => {
    ksynthWorker.postMessage({ type: 'getAudioData' });
  });

  ksynthWorker.onmessage = function (e) {
    const { type } = e.data;

    switch (type) {
        case 'initialized':
            console.log('KSynth initialized');
            ksynthWorker.postMessage({ type: 'getAudioData' });
            break;
        case 'audioBuffer':
            const buffer = e.data.buffer;
            if (buffer.length === 0) return;

            for (let i = 0; i < buffer.length; i++) {
              buffer[i] = limiter.limit(buffer[i]);
            }

            // Play buffer
            player.play(buffer);
            break;
        case 'error':
            console.error('Error from worker:', e.data.error);
            break;
        default:
            console.error('Unknown message type:', type);
      }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();

      ksynthWorker.postMessage({ type: 'initialize', sampleData: arrayBuffer });
    }
  };

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  const NoteONButton = document.getElementById('NoteONButton');
  const NoteOFFButton = document.getElementById('NoteOFFButton');

  if (NoteONButton) {
    NoteONButton.addEventListener('click', () => {
      ksynthWorker.postMessage({ type: 'midiEvent', event: { type: 'noteOn', channel: 1, note: 60, velocity: 127 } });
    });
  }

  if (NoteOFFButton) {
    NoteOFFButton.addEventListener('click', () => {
      ksynthWorker.postMessage({ type: 'midiEvent', event: { type: 'noteOff', channel: 1, note: 60 } });
    });
  }
});
