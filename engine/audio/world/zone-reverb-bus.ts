import type { AudioZoneSettings } from './audio-zone-settings';
import { createImpulseResponse, impulseResponseKey } from '@/engine/audio/graph/impulse-response';
const MAX_PREDELAY_SECONDS = 0.5;
const MAX_ECHO_SECONDS = 2;
const CROSSFADE_SECONDS = 0.35;
const SMOOTHING_SECONDS = 0.08;
export class ZoneReverbBus {
    readonly input: GainNode;
    readonly output: GainNode;
    private readonly preDelay: DelayNode;
    private readonly convolvers: [
        ConvolverNode,
        ConvolverNode
    ];
    private readonly convolverGains: [
        GainNode,
        GainNode
    ];
    private readonly wet: GainNode;
    private readonly echoDelay: DelayNode;
    private readonly echoDamping: BiquadFilterNode;
    private readonly echoFeedback: GainNode;
    private readonly echoWet: GainNode;
    private active = 0;
    private impulseKey = '';
    constructor(private readonly context: AudioContext, destination: AudioNode) {
        this.input = context.createGain();
        this.output = context.createGain();
        this.output.connect(destination);
        this.preDelay = context.createDelay(MAX_PREDELAY_SECONDS);
        this.wet = context.createGain();
        this.wet.gain.value = 0;
        this.input.connect(this.preDelay);
        this.convolvers = [context.createConvolver(), context.createConvolver()];
        this.convolverGains = [context.createGain(), context.createGain()];
        for (let i = 0; i < 2; i++) {
            this.preDelay.connect(this.convolvers[i]);
            this.convolvers[i].connect(this.convolverGains[i]);
            this.convolverGains[i].connect(this.wet);
            this.convolverGains[i].gain.value = i === 0 ? 1 : 0;
        }
        this.wet.connect(this.output);
        this.echoDelay = context.createDelay(MAX_ECHO_SECONDS);
        this.echoDamping = context.createBiquadFilter();
        this.echoDamping.type = 'lowpass';
        this.echoFeedback = context.createGain();
        this.echoWet = context.createGain();
        this.echoWet.gain.value = 0;
        this.input.connect(this.echoDelay);
        this.echoDelay.connect(this.echoDamping);
        this.echoDamping.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoDelay);
        this.echoDamping.connect(this.echoWet);
        this.echoWet.connect(this.output);
    }
    apply(zone: AudioZoneSettings | null, weight: number): void {
        const now = this.context.currentTime;
        const presence = zone ? Math.min(Math.max(weight, 0), 1) : 0;
        const reverb = zone?.reverb;
        if (reverb && reverb.enabled && presence > 0) {
            const key = impulseResponseKey(reverb);
            if (key !== this.impulseKey) {
                const next = 1 - this.active;
                this.convolvers[next].buffer = createImpulseResponse(this.context, reverb);
                this.convolverGains[next].gain.setTargetAtTime(1, now, CROSSFADE_SECONDS / 3);
                this.convolverGains[this.active].gain.setTargetAtTime(0, now, CROSSFADE_SECONDS / 3);
                this.active = next;
                this.impulseKey = key;
            }
            this.preDelay.delayTime.setTargetAtTime(Math.min(MAX_PREDELAY_SECONDS, Math.max(0, reverb.preDelay)), now, SMOOTHING_SECONDS);
            this.wet.gain.setTargetAtTime(reverb.mix * presence, now, SMOOTHING_SECONDS);
        }
        else {
            this.wet.gain.setTargetAtTime(0, now, SMOOTHING_SECONDS);
        }
        const echo = zone?.echo;
        if (echo && echo.enabled && presence > 0) {
            this.echoDelay.delayTime.setTargetAtTime(Math.min(MAX_ECHO_SECONDS, Math.max(0.001, echo.time)), now, SMOOTHING_SECONDS);
            this.echoFeedback.gain.setTargetAtTime(Math.min(0.95, Math.max(0, echo.feedback)), now, SMOOTHING_SECONDS);
            this.echoDamping.frequency.setTargetAtTime(echo.damping, now, SMOOTHING_SECONDS);
            this.echoWet.gain.setTargetAtTime(echo.mix * presence, now, SMOOTHING_SECONDS);
        }
        else {
            this.echoWet.gain.setTargetAtTime(0, now, SMOOTHING_SECONDS);
        }
    }
    dispose(): void {
        this.input.disconnect();
        this.preDelay.disconnect();
        for (const node of this.convolvers)
            node.disconnect();
        for (const node of this.convolverGains)
            node.disconnect();
        this.wet.disconnect();
        this.echoDelay.disconnect();
        this.echoDamping.disconnect();
        this.echoFeedback.disconnect();
        this.echoWet.disconnect();
        this.output.disconnect();
    }
}
