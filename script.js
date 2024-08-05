document.addEventListener('DOMContentLoaded', () => {
  let ksynth = null;
  const player = new PCMF32Player(960, 2);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();

      if (ksynth) {
        ksynth = null;
      }

      ksynth = new KSynth(arrayBuffer);

      ksynth.addEventListener('audioData', (event) => {
        if (!ksynth) return; // Check if ksynth is still valid
        const buffer = event.detail.buffer;
        //console.log(buffer);

        // Convert buffer to swapped byte order if needed
        // const swappedBuffer = swapByteOrder(new Float32Array(buffer));

        // Play buffer
        player.play(buffer);
      });

      window.ksynth = ksynth; // Expose ksynth to global scope if necessary
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
      if (ksynth) {
        ksynth.addMidiEvent({ type: 'noteOn', channel: 1, note: 60, velocity: 127 });
      }
    });
  }

  if (NoteOFFButton) {
    NoteOFFButton.addEventListener('click', () => {
      if (ksynth) {
        ksynth.addMidiEvent({ type: 'noteOff', channel: 1, note: 60 });
      }
    });
  }
});

// Optional: Function to swap byte order (if needed)
function swapByteOrder(floatArray) {
  const buffer = floatArray.buffer;
  const view = new DataView(buffer);
  const length = floatArray.length;

  // Create a new Float32Array to hold the swapped bytes
  const swappedArray = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    // Read the float value in the original endianness
    const value = view.getFloat32(i * 4, true); // true for little-endian

    // Write the float value in the swapped endianness
    view.setFloat32(i * 4, value, false); // false for big-endian
  }

  return swappedArray;
}
