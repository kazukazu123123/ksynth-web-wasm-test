class KSynth extends EventTarget {
    constructor(ksmpArrayBuffer) {
        super();
        this.ksynthInstance = null;
        this.sampleDataPtr = null;
        this.filePathPtr = null;
        this.bufferSize = 960;
        this.sampleRate = 48000;
        this.audioBuffers = [];
        this.midiEventQueue = [];
        this.isInitialized = false;
        this.ksmpArrayBuffer = ksmpArrayBuffer;

        this.initialize();
    }

    async initialize() {
        try {
            const ksynthSampleBuffer = new Uint8Array(this.ksmpArrayBuffer);
            const filePath = '/home/web_user/sample.ksmp';

            FS.writeFile(filePath, ksynthSampleBuffer);

            const sampleDataSize = ksynthSampleBuffer.byteLength;
            this.sampleDataPtr = Module._malloc(sampleDataSize);
            Module.HEAPU8.set(ksynthSampleBuffer, this.sampleDataPtr);

            const filePathLen = Module.lengthBytesUTF8(filePath) + 1;
            this.filePathPtr = Module._malloc(filePathLen);
            Module.stringToUTF8(filePath, this.filePathPtr, filePathLen);

            const numChannel = 2;
            const maxPolyphony = 500;

            this.ksynthInstance = Module._ksynth_new(this.filePathPtr, this.sampleRate, numChannel, maxPolyphony, false);
            if (this.ksynthInstance === null) {
                console.error("Failed to create KSynth instance.");
                return;
            }

            Module._free(this.sampleDataPtr);
            Module._free(this.filePathPtr);

            this.isInitialized = true;

            this.bufferInterval = setInterval(() => {
                if (this.ksynthInstance) {
                    this.processMidiEvents();
                    this.generateAndProcessBuffer();
                }
            }, this.bufferSize / this.sampleRate * 1000)

        } catch (error) {
            console.error("Initialization error:", error);
        } finally {
            this.deleteFile('/home/web_user/sample.ksmp');
        }
    }

    generateAndProcessBuffer() {
        if (this.ksynthInstance === null) return;

        this.processMidiEvents();

        const bufferPtr = Module._ksynth_generate_buffer(this.ksynthInstance, this.bufferSize);

        if (bufferPtr === null) {
            console.error("Failed to generate buffer. bufferPtr is null.");
            return;
        }

        const buffer = new Float32Array(Module.HEAPF32.buffer, bufferPtr, this.bufferSize);

        if (this.audioBuffers.length > 4) {
            this.audioBuffers.shift();
        }
        //this.audioBuffers.push(buffer);

        // Send audio data as a custom event
        //this.dispatchEvent(new CustomEvent('audioData', { detail: { buffer } }));

        Module._ksynth_buffer_free(bufferPtr);
    }

    processMidiEvents() {
        if (this.ksynthInstance === null || this.midiEventQueue.length === 0) return;

        const events = this.midiEventQueue.splice(0, this.midiEventQueue.length);

        events.forEach(event => {
            if (event.type === 'noteOn') {
                Module._ksynth_note_on(this.ksynthInstance, event.channel, event.note, event.velocity);
            } else if (event.type === 'noteOff') {
                Module._ksynth_note_off(this.ksynthInstance, event.channel, event.note);
            }
        });
    }

    deleteFile(filePath) {
        try {
            FS.unlink(filePath);
        } catch (error) {
            console.error(`Failed to delete file ${filePath}:`, error);
        }
    }

    addMidiEvent(event) {
        if (this.ksynthInstance === null) return;
        this.midiEventQueue.push(event);
    }

    destroy() {
        if (this.ksynthInstance !== null) {
            clearInterval(this.bufferInterval)

            // Free the KSynth instance
            console.log("before free (this.ksynthInstance): ", this.ksynthInstance)
            Module._ksynth_free(this.ksynthInstance);
            console.log("after free (this.ksynthInstance): ", this.ksynthInstance)
            this.ksynthInstance = null;

            // Clear any remaining buffers and MIDI events
            this.audioBuffers.splice(0);
            this.midiEventQueue.splice(0);

            this.isInitialized = false;
        }
    }

}

window.KSynth = KSynth
