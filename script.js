document.addEventListener('DOMContentLoaded', async () => {
  const limiter = new Limiter();
  const fileInput = document.getElementById('fileInput');

  const polyphonyLabel = document.getElementById('polyphonyLabel');
  const maxPolyphonyLabel = document.getElementById('maxPolyphonyLabel');
  const renderingTimeLabel = document.getElementById('renderingTimeLabel');

  const NoteONButton = document.getElementById('NoteONButton');
  const NoteOFFButton = document.getElementById('NoteOFFButton');

  const ksynthWorker = new Worker('ksynth/ksynthWorker.js');
  window.ksynthWorker = ksynthWorker;

  const player = new PCMF32Player(960, 2);
  player.onEnded(() => {
    ksynthWorker.postMessage({ type: 'generateBuffer', bufferMultiply: 4 });
  });

  ksynthWorker.onmessage = (e) => {
    const { type } = e.data;

    switch (type) {
      case 'initialized':
        console.log('KSynth initialized');
        setInterval(() => ksynthWorker.postMessage({ type: 'getInfo'}), 1000 / 5);
        ksynthWorker.postMessage({ type: 'generateBuffer', bufferMultiply: 4 });
        break;
      case 'info':
        polyphonyLabel.innerText = e.data.polyphony;
        maxPolyphonyLabel.innerText = e.data.maxPolyphony;
        renderingTimeLabel.innerText = e.data.renderingTime * 100.0;
        break;
      case 'audioBuffer':
        const buffer = e.data.buffer;
        const limitedBuffer = buffer.map(sample => limiter.limit(sample));
        player.play(new Float32Array(limitedBuffer));
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

  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  if (NoteONButton) {
    NoteONButton.addEventListener('click', () => {
      ksynthWorker.postMessage({ type: 'midiEvent', event: { type: 'noteOn', channel: 0, note: 60, velocity: 127 } });
    });
  }

  if (NoteOFFButton) {
    NoteOFFButton.addEventListener('click', () => {
      ksynthWorker.postMessage({ type: 'midiEvent', event: { type: 'noteOff', channel: 0, note: 60 } });
    });
  }
});
