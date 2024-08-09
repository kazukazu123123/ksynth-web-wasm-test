importScripts("ksynth.js");

let ksynthInstance = null;
let sampleDataPtr = null;
let filePathPtr = null;
let sampleRate = 48000;
let isInitialized = false;
let bufferInterval = null;

function initializeKSynth(ksmpArrayBuffer) {
  if (ksynthInstance) return;

  try {
    const ksynthSampleBuffer = new Uint8Array(ksmpArrayBuffer);
    const filePath = "/home/web_user/sample.ksmp";

    FS.writeFile(filePath, ksynthSampleBuffer);

    const sampleDataSize = ksynthSampleBuffer.byteLength;
    sampleDataPtr = Module._malloc(sampleDataSize);
    Module.HEAPU8.set(ksynthSampleBuffer, sampleDataPtr);

    const filePathLen = Module.lengthBytesUTF8(filePath) + 1;
    filePathPtr = Module._malloc(filePathLen);
    Module.stringToUTF8(filePath, filePathPtr, filePathLen);

    const numChannel = 2;
    const maxPolyphony = 500;

    ksynthInstance = Module._ksynth_new(
      filePathPtr,
      sampleRate,
      numChannel,
      maxPolyphony,
      false
    );
    if (ksynthInstance === null) {
      console.error("Failed to create KSynth instance.");
      return;
    }

    Module._free(sampleDataPtr);
    sampleDataPtr = undefined;
    Module._free(filePathPtr);
    filePathPtr = undefined;

    isInitialized = true;

    self.postMessage({ type: "initialized" });
  } catch (error) {
    console.error("Initialization error:", error);
    self.postMessage({ type: "error", error });
  } finally {
    deleteFile("/home/web_user/sample.ksmp");
  }
}

function generateBuffer(bufferMultiply) {
  if (ksynthInstance === null) return;

  const chunkSize = 960;
  const totalSize = chunkSize * bufferMultiply;

  const combinedBuffer = new Float32Array(totalSize);
  let offset = 0;

  for (let i = 0; i < bufferMultiply; i++) {
    const currentChunkSize = chunkSize;
    const bufferPtr = Module._ksynth_generate_buffer(
      ksynthInstance,
      currentChunkSize
    );

    if (bufferPtr === null) {
      console.error("Failed to generate buffer. bufferPtr is null.");
      return;
    }

    const chunk = new Float32Array(
      Module.HEAPF32.buffer,
      bufferPtr,
      currentChunkSize
    );

    combinedBuffer.set(chunk, offset);
    offset += currentChunkSize;

    Module._ksynth_buffer_free(bufferPtr);
  }

  self.postMessage({ type: "audioBuffer", buffer: [...combinedBuffer] });
}

function deleteFile(filePath) {
  try {
    FS.unlink(filePath);
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error);
  }
}

function destroyKSynth() {
  if (isInitialized && ksynthInstance !== null) {
    clearInterval(bufferInterval);

    // Free the KSynth instance
    Module._ksynth_free(ksynthInstance);
    ksynthInstance = null;

    // Clear any remaining buffers and MIDI events
    audioBuffers.splice(0);
    filePathPtr = undefined;

    isInitialized = false;
  }
}

self.onmessage = function (e) {
  const message = e.data;

  switch (message.type) {
    case "initialize":
      initializeKSynth(message.sampleData);
      break;
    case "getInfo":
      const polyphony = Module._ksynth_get_polyphony(ksynthInstance);
      const maxPolyphony = Module._ksynth_get_max_polyphony(ksynthInstance);
      const renderingTime = Module._ksynth_get_rendering_time(ksynthInstance);
      self.postMessage({
        type: "info",
        polyphony,
        maxPolyphony,
        renderingTime,
      });
      break;
    case "generateBuffer":
      if (!message.bufferMultiply)
        console.error("bufferMultiply parameter not specified.");
      generateBuffer(message.bufferMultiply);
      break;
    case "setMaxPolyphony":
      if (!isInitialized) return;
      const newPolyphony = message.newPolyphony;
      if (!newPolyphony)
        return console.error("newPolyphony parameter not specified.");
      Module._ksynth_set_max_polyphony(ksynthInstance, newPolyphony);
      break;
    case "note_off_all":
      if (!isInitialized) return;
      Module._ksynth_note_off_all(ksynthInstance);
      break;
    case "midiEvent":
      if (!isInitialized) return;

      switch (message.event.type) {
        case "noteOn":
          Module._ksynth_note_on(
            ksynthInstance,
            message.event.channel,
            message.event.note,
            message.event.velocity
          );
          break;
        case "noteOff":
          Module._ksynth_note_off(ksynthInstance, message.event.channel, message.event.note);
          break;
      }
      break;
    case "destroy":
      destroyKSynth();
      break;
    default:
      console.error("Unknown message type:", message.type);
  }
};
