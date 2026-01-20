
import { InstrumentConfig } from '../types';

export class SynthVoice {
    osc: OscillatorNode | null = null;
    env: GainNode;
    ctx: BaseAudioContext;
    destination: AudioNode;
    config: InstrumentConfig;
    isBusy: boolean = false;
    private cleanupTimeout: number | null = null;
    
    constructor(ctx: BaseAudioContext, destination: AudioNode, config: InstrumentConfig) {
        this.ctx = ctx;
        this.destination = destination;
        this.config = config;
        
        // Permanent Envelope Node
        this.env = ctx.createGain();
        this.env.gain.value = 0;
        this.env.connect(destination);
    }

    play(freq: number, velocity: number, startTime: number, config: InstrumentConfig) {
        this.stopNow(); // Ensure clean state
        this.isBusy = true;
        this.config = config; 
        
        this.osc = this.ctx.createOscillator();
        this.osc.type = config.preset;
        this.osc.frequency.value = freq;
        this.osc.connect(this.env);
        
        const velGain = Math.pow(velocity / 127, 1.5);
        const { attack, decay, sustain } = this.config;
        
        this.osc.start(startTime);
        
        // ADSR
        this.env.gain.cancelScheduledValues(startTime);
        this.env.gain.setValueAtTime(0, startTime);
        this.env.gain.linearRampToValueAtTime(velGain, startTime + Math.max(0.005, attack)); 
        this.env.gain.exponentialRampToValueAtTime(Math.max(0.001, sustain * velGain), startTime + attack + decay);
    }

    triggerRelease(releaseTime?: number) {
        if (!this.isBusy || !this.osc) return;
        const now = releaseTime ?? this.ctx.currentTime;
        const { release } = this.config;
        
        try {
            this.env.gain.cancelScheduledValues(now);
            this.env.gain.setTargetAtTime(0, now, release / 3);
            
            const stopTime = now + release + 0.1;
            this.osc.stop(stopTime);
            
            if (this.ctx instanceof AudioContext) {
                // Store timeout ID so we can cancel it if stopNow is called
                if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
                this.cleanupTimeout = window.setTimeout(() => this.cleanup(), (release + 0.2) * 1000);
            }
        } catch(e) {
            // Context might be closed
        }
    }
    
    stopNow() {
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        
        try {
            this.env.gain.cancelScheduledValues(this.ctx.currentTime);
            this.env.gain.setValueAtTime(0, this.ctx.currentTime);
            if (this.osc) {
                try { this.osc.stop(); } catch(e) {}
                try { this.osc.disconnect(); } catch(e) {}
                this.osc = null;
            }
        } catch(e) {}
        this.isBusy = false;
    }

    cleanup() {
        this.cleanupTimeout = null;
        if (this.osc) {
            try { this.osc.disconnect(); } catch(e) {}
            this.osc = null;
        }
        this.isBusy = false;
    }

    disconnect() {
        this.stopNow();
        try {
            this.env.disconnect();
        } catch (e) {
            console.warn("Error disconnecting SynthVoice Env", e);
        }
    }
}
