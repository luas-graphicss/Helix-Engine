import { LevelMeter } from '@/engine/audio/analysis/level-meter';
import { AUDIO_BUSES, CLIP_BUSES, effectiveBusGain, type AudioBusId, type ClipBusId, type MixerSettings } from './mixer-settings';
interface BusNodes {
    readonly gain: GainNode;
    readonly meter: LevelMeter;
}
const SMOOTHING_SECONDS = 0.03;
const LIMITER_THRESHOLD_DB = -1;
const LIMITER_RATIO = 20;
const LIMITER_ATTACK_SECONDS = 0.002;
const LIMITER_RELEASE_SECONDS = 0.12;
export class AudioMixer {
    private readonly buses: Record<AudioBusId, BusNodes>;
    private readonly limiter: DynamicsCompressorNode;
    private readonly monitor: GainNode;
    constructor(private readonly context: AudioContext) {
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = LIMITER_THRESHOLD_DB;
        limiter.knee.value = 0;
        limiter.ratio.value = LIMITER_RATIO;
        limiter.attack.value = LIMITER_ATTACK_SECONDS;
        limiter.release.value = LIMITER_RELEASE_SECONDS;
        const monitor = context.createGain();
        limiter.connect(monitor);
        monitor.connect(context.destination);
        this.limiter = limiter;
        this.monitor = monitor;
        const master: BusNodes = { gain: context.createGain(), meter: new LevelMeter(context, 2) };
        master.gain.connect(limiter);
        limiter.connect(master.meter.input);
        const buses = { master } as Record<AudioBusId, BusNodes>;
        for (const info of CLIP_BUSES) {
            const bus: BusNodes = { gain: context.createGain(), meter: new LevelMeter(context, 1) };
            bus.gain.connect(master.gain);
            bus.gain.connect(bus.meter.input);
            buses[info.id] = bus;
        }
        this.buses = buses;
    }
    input(bus: ClipBusId): AudioNode {
        return this.buses[bus].gain;
    }
    returnInput(): AudioNode {
        return this.buses.master.gain;
    }
    meter(bus: AudioBusId): LevelMeter {
        return this.buses[bus].meter;
    }
    get limiterReductionDb(): number {
        return this.limiter.reduction;
    }
    setMonitorGain(value: number): void {
        this.monitor.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime, SMOOTHING_SECONDS);
    }
    apply(settings: MixerSettings, immediate = false): void {
        const now = this.context.currentTime;
        for (const info of AUDIO_BUSES) {
            const param = this.buses[info.id].gain.gain;
            const value = effectiveBusGain(settings, info.id);
            if (immediate) {
                param.cancelScheduledValues(now);
                param.setValueAtTime(value, now);
            }
            else {
                param.setTargetAtTime(value, now, SMOOTHING_SECONDS);
            }
        }
    }
    dispose(): void {
        for (const info of AUDIO_BUSES) {
            this.buses[info.id].gain.disconnect();
            this.buses[info.id].meter.dispose();
        }
        this.limiter.disconnect();
        this.monitor.disconnect();
    }
}
