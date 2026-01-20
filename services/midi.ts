
type MidiNoteHandler = (note: number, velocity: number, timestamp: number) => void;

class MidiService {
  private midiAccess: MIDIAccess | null = null;
  private noteOnListeners: Set<MidiNoteHandler> = new Set();
  private noteOffListeners: Set<MidiNoteHandler> = new Set();
  public isSupported: boolean = false;

  constructor() {
    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      this.isSupported = true;
    }
  }

  async init() {
    if (!this.isSupported) return;
    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.inputs.forEach((input) => {
        input.onmidimessage = this.handleMidiMessage.bind(this);
      });
      this.midiAccess.onstatechange = (e) => {
        const port = (e as MIDIConnectionEvent).port;
        if (port.type === 'input' && port.state === 'connected') {
           (port as MIDIInput).onmidimessage = this.handleMidiMessage.bind(this);
        }
      };
      console.log("MIDI Initialized");
    } catch (e) {
      console.warn("MIDI Access Failed", e);
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    const [status, data1, data2] = event.data;
    const command = status & 0xf0;
    // timestamp is in milliseconds (DOMHighResTimeStamp)
    const timestamp = event.timeStamp; 

    if (command === 0x90 && data2 > 0) {
      // Note On
      this.noteOnListeners.forEach(cb => cb(data1, data2, timestamp));
    } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
      // Note Off
      this.noteOffListeners.forEach(cb => cb(data1, 0, timestamp));
    }
  }

  onNoteOn(cb: MidiNoteHandler) {
    this.noteOnListeners.add(cb);
    return () => this.noteOnListeners.delete(cb);
  }

  onNoteOff(cb: MidiNoteHandler) {
    this.noteOffListeners.add(cb);
    return () => this.noteOffListeners.delete(cb);
  }
}

export const midi = new MidiService();
