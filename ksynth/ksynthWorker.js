importScripts('ksynth.js');

let ksynthInstance = null;
let sampleDataPtr = null;
let filePathPtr = null;
let bufferSize = 960;
let sampleRate = 48000;
let audioBuffers = [];
let midiEventQueue = [];
let isInitialized = false;
let bufferInterval = null;

function initializeKSynth(ksmpArrayBuffer) {
    try {
        const ksynthSampleBuffer = new Uint8Array(ksmpArrayBuffer);
        const filePath = '/home/web_user/sample.ksmp';

        FS.writeFile(filePath, ksynthSampleBuffer);

        const sampleDataSize = ksynthSampleBuffer.byteLength;
        sampleDataPtr = Module._malloc(sampleDataSize);
        Module.HEAPU8.set(ksynthSampleBuffer, sampleDataPtr);

        const filePathLen = Module.lengthBytesUTF8(filePath) + 1;
        filePathPtr = Module._malloc(filePathLen);
        Module.stringToUTF8(filePath, filePathPtr, filePathLen);

        const numChannel = 2;
        const maxPolyphony = 500;

        ksynthInstance = Module._ksynth_new(filePathPtr, sampleRate, numChannel, maxPolyphony, false);
        if (ksynthInstance === null) {
            console.error("Failed to create KSynth instance.");
            return;
        }

        Module._free(sampleDataPtr);
        sampleDataPtr = undefined;
        Module._free(filePathPtr);
        filePathPtr = undefined;

        isInitialized = true;

        bufferInterval = setInterval(() => {
            if (ksynthInstance) {
                processMidiEvents();
                generateAndStoreBuffer();
            }
        });

        self.postMessage({ type: 'initialized' });

    } catch (error) {
        console.error("Initialization error:", error);
        self.postMessage({ type: 'error', error });
    } finally {
        deleteFile('/home/web_user/sample.ksmp');
    }
}

function generateAndStoreBuffer() {
    if (ksynthInstance === null) return;

    processMidiEvents();

    if (audioBuffers.length < bufferSize * 4) {
        const bufferPtr = Module._ksynth_generate_buffer(ksynthInstance, bufferSize);

        if (bufferPtr === null) {
            console.error("Failed to generate buffer. bufferPtr is null.");
            return;
        }

        const buffer = new Float32Array(Module.HEAPF32.buffer, bufferPtr, bufferSize);

        audioBuffers.push(...buffer);

        Module._ksynth_buffer_free(bufferPtr);
    }
}

function processMidiEvents() {
    if (ksynthInstance === null || midiEventQueue.length === 0) return;

    const events = midiEventQueue.splice(0, midiEventQueue.length);

    events.forEach(event => {
        if (event.type === 'noteOn') {
            Module._ksynth_note_on(ksynthInstance, event.channel, event.note, event.velocity);
        } else if (event.type === 'noteOff') {
            Module._ksynth_note_off(ksynthInstance, event.channel, event.note);
        }
    });
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
        midiEventQueue.splice(0);
        filePathPtr = undefined;

        isInitialized = false;
    }
}

self.onmessage = function (e) {
    const message = e.data;

    switch (message.type) {
        case 'initialize':
            initializeKSynth(message.sampleData);
            break;
        case 'midiEvent':
            if (isInitialized) midiEventQueue.push(message.event);
            break;
        case 'getAudioData':
            if (audioBuffers.length > bufferSize) {
                const latestBuffer = audioBuffers.splice(0, bufferSize);
                self.postMessage({ type: 'audioBuffer', buffer: latestBuffer });
            } else {
                self.postMessage({ type: 'audioBuffer', buffer: Array(bufferSize).fill(0) });
            }
            break;
        case 'destroy':
            destroyKSynth();
            break;
        default:
            console.error('Unknown message type:', type);
    }
};
