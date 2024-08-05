document.addEventListener('DOMContentLoaded', () => {
  let ksynth;

  // Function to handle file selection and create KSynth instance
  const handleFileSelect = async (event) => {
      const file = event.target.files[0];
      if (file) {
          const arrayBuffer = await file.arrayBuffer();

          if (ksynth) {
              ksynth = null;
          }

          ksynth = new KSynth(arrayBuffer);

          ksynth.addEventListener('audioData', (event) => {
              const buffer = event.detail.buffer;
              console.log('Received audio buffer:', buffer);
          });

          window.ksynth = ksynth
      }
  };

  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', handleFileSelect);

  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');

  startButton.addEventListener('click', () => {
    ksynth.addMidiEvent({ type: 'noteOn', channel: 1, note: 60, velocity: 127 });
  });

  stopButton.addEventListener('click', () => {
    ksynth.addMidiEvent({ type: 'noteOff', channel: 1, note: 60 });
  });
});
