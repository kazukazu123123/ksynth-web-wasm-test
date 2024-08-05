class PCMF32Player {
  constructor(bufferSize, channels) {
      this.bufferSize = bufferSize;
      this.channels = channels;
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;
      this.buffer = this.audioContext.createBuffer(this.channels, this.bufferSize, this.sampleRate);
      this.source = null;
      this.onEndedCallback = null;
  }

  play(float32Array) {
      const numSamples = float32Array.length;
      const numFrames = numSamples / this.channels;

      // Create a new buffer to hold the float32Array data
      const newBuffer = this.audioContext.createBuffer(this.channels, numFrames, this.sampleRate);

      for (let channel = 0; channel < this.channels; channel++) {
          const channelData = newBuffer.getChannelData(channel);

          for (let i = 0; i < numFrames; i++) {
              channelData[i] = float32Array[i * this.channels + channel];
          }
      }

      // Create a buffer source and connect it to the audio context
      this.source = this.audioContext.createBufferSource();
      this.source.buffer = newBuffer;
      this.source.connect(this.audioContext.destination);

      // Set up the onended event listener
      this.source.onended = () => {
          if (this.onEndedCallback) {
              this.onEndedCallback();
          }
      };

      // Start playback
      this.source.start();
  }

  onEnded(callback) {
      this.onEndedCallback = callback;
  }
}

window.PCMF32Player = PCMF32Player;
