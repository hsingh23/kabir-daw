
import { analytics } from "./analytics";

export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: BlobPart[] = [];
    private recordingMimeType: string = 'audio/webm';
    private monitorNode: MediaStreamAudioSourceNode | null = null;
    private activeStream: MediaStream | null = null;
    public selectedInputDeviceId: string | undefined;
    
    constructor(
        private ctx: AudioContext, 
        private inputAnalyser: AnalyserNode, 
        private monitorGain: GainNode
    ) {}

    async getAudioDevices() {
        if (!navigator.mediaDevices) return { inputs: [], outputs: [] };
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                inputs: devices.filter(d => d.kind === 'audioinput'),
                outputs: devices.filter(d => d.kind === 'audiooutput')
            };
        } catch (e) {
            console.warn("Failed to enumerate devices", e);
            return { inputs: [], outputs: [] };
        }
    }

    async initInput(deviceId?: string) {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(t => t.stop());
        }
        try {
            const constraints = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true };
            this.activeStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.selectedInputDeviceId = deviceId;
            
            if (this.monitorNode) this.monitorNode.disconnect();
            
            this.monitorNode = this.ctx.createMediaStreamSource(this.activeStream);
            this.monitorNode.connect(this.inputAnalyser);
            this.inputAnalyser.connect(this.monitorGain);
            
        } catch (e: any) {
            console.error("Error accessing microphone", e);
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                analytics.track('permission_denied', { context: 'microphone' });
            }
            throw e;
        }
    }

    closeInput() {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(t => t.stop());
            this.activeStream = null;
        }
        if (this.monitorNode) {
            this.monitorNode.disconnect();
            this.monitorNode = null;
        }
    }

    async start(monitoring: boolean): Promise<number> {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        
        if (!this.activeStream) {
            await this.initInput(this.selectedInputDeviceId);
        }
        
        if (!this.activeStream) throw new Error("No input stream available");

        this.mediaRecorder = new MediaRecorder(this.activeStream);
        this.recordedChunks = [];
        
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        
        this.mediaRecorder.start();
        
        if (monitoring && this.monitorNode) {
            this.monitorGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.1);
        } else {
            this.monitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }

        return this.ctx.currentTime;
    }

    async stop(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(new Blob()); 
                return;
            }
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: this.recordingMimeType });
                this.recordedChunks = [];
                if (this.monitorGain) this.monitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
                resolve(blob);
            };
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        });
    }
}
