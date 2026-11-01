import type { AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { effectsTopologyKey, type AudioEffectsSettings, type CompressorSettings, type DelaySettings, type DistortionSettings, type EqSettings, type FilterSettings, type ReverbSettings } from '@/engine/audio/clip/audio-effects';
import { dbToGain } from '@/engine/audio/core/decibels';
import { createDistortionCurve } from './distortion-curve';
import { createImpulseResponse, impulseResponseKey } from './impulse-response';
const SMOOTHING_SECONDS = 0.02;
const MAX_DELAY_SECONDS = 2;
const MAX_PREDELAY_SECONDS = 0.5;
interface Stage {
    readonly head: AudioNode;
    readonly tail: AudioNode;
    readonly nodes: AudioNode[];
}
function mixGains(mix: number): {
    dry: number;
    wet: number;
} {
    const angle = Math.max(0, Math.min(1, mix)) * Math.PI * 0.5;
    return { dry: Math.cos(angle), wet: Math.sin(angle) };
}
export class ClipGraph {
    readonly input: GainNode;
    readonly fade: GainNode;
    readonly output: GainNode;
    private readonly volume: GainNode;
    private readonly pan: StereoPannerNode;
    private chain: AudioNode[] = [];
    private readonly params = new Map<string, AudioParam>();
    private shaper: WaveShaperNode | null = null;
    private convolver: ConvolverNode | null = null;
    private impulseKey = '';
    private topology = '';
    private volumeOffsetDb = 0;
    private lastSettings: AudioClipSettings;
    constructor(private readonly context: BaseAudioContext, settings: AudioClipSettings) {
        this.input = context.createGain();
        this.volume = context.createGain();
        this.fade = context.createGain();
        this.pan = context.createStereoPanner();
        this.output = context.createGain();
        this.volume.connect(this.fade);
        this.fade.connect(this.pan);
        this.pan.connect(this.output);
        this.lastSettings = settings;
        this.apply(settings, true);
    }
    setVolumeOffset(db: number): void {
        this.volumeOffsetDb = db;
        this.set(this.volume.gain, dbToGain(this.lastSettings.volumeDb + db), true);
    }
    apply(settings: AudioClipSettings, immediate = false): void {
        this.lastSettings = settings;
        const topology = effectsTopologyKey(settings.effects);
        if (topology !== this.topology) {
            this.rebuild(settings.effects);
            this.topology = topology;
        }
        this.set(this.volume.gain, dbToGain(settings.volumeDb + this.volumeOffsetDb), immediate);
        this.set(this.pan.pan, settings.pan, immediate);
        this.updateEffects(settings.effects, immediate);
    }
    dispose(): void {
        this.input.disconnect();
        for (const node of this.chain)
            node.disconnect();
        this.volume.disconnect();
        this.fade.disconnect();
        this.pan.disconnect();
        this.output.disconnect();
        this.chain = [];
        this.params.clear();
    }
    private set(param: AudioParam, value: number, immediate: boolean): void {
        const now = this.context.currentTime;
        if (immediate) {
            param.cancelScheduledValues(now);
            param.setValueAtTime(value, now);
        }
        else {
            param.setTargetAtTime(value, now, SMOOTHING_SECONDS);
        }
    }
    private setNamed(name: string, value: number, immediate: boolean): void {
        const param = this.params.get(name);
        if (param)
            this.set(param, value, immediate);
    }
    private rebuild(effects: AudioEffectsSettings): void {
        this.input.disconnect();
        for (const node of this.chain)
            node.disconnect();
        this.chain = [];
        this.params.clear();
        this.shaper = null;
        this.convolver = null;
        this.impulseKey = '';
        const stages: Stage[] = [];
        if (effects.eq.enabled)
            stages.push(this.buildEq(effects.eq));
        if (effects.filter.enabled)
            stages.push(this.buildFilter(effects.filter));
        if (effects.distortion.enabled)
            stages.push(this.buildDistortion(effects.distortion));
        if (effects.compressor.enabled)
            stages.push(this.buildCompressor(effects.compressor));
        if (effects.delay.enabled)
            stages.push(this.buildDelay(effects.delay));
        if (effects.reverb.enabled)
            stages.push(this.buildReverb(effects.reverb));
        let previous: AudioNode = this.input;
        for (const stage of stages) {
            previous.connect(stage.head);
            previous = stage.tail;
            this.chain.push(...stage.nodes);
        }
        previous.connect(this.volume);
    }
    private updateEffects(effects: AudioEffectsSettings, immediate: boolean): void {
        const { eq, filter, distortion, compressor, delay, reverb } = effects;
        if (eq.enabled) {
            this.setNamed('eq.lowGain', eq.lowGainDb, immediate);
            this.setNamed('eq.lowFrequency', eq.lowFrequency, immediate);
            this.setNamed('eq.midGain', eq.midGainDb, immediate);
            this.setNamed('eq.midFrequency', eq.midFrequency, immediate);
            this.setNamed('eq.midQ', eq.midQ, immediate);
            this.setNamed('eq.highGain', eq.highGainDb, immediate);
            this.setNamed('eq.highFrequency', eq.highFrequency, immediate);
        }
        if (filter.enabled) {
            this.setNamed('filter.frequency', filter.frequency, immediate);
            this.setNamed('filter.q', filter.q, immediate);
        }
        if (distortion.enabled && this.shaper) {
            this.shaper.curve = createDistortionCurve(distortion.drive);
            const { dry, wet } = mixGains(distortion.mix);
            this.setNamed('distortion.dry', dry, immediate);
            this.setNamed('distortion.wet', wet / (1 + distortion.drive * 0.5), immediate);
        }
        if (compressor.enabled) {
            this.setNamed('compressor.threshold', compressor.thresholdDb, immediate);
            this.setNamed('compressor.knee', compressor.knee, immediate);
            this.setNamed('compressor.ratio', compressor.ratio, immediate);
            this.setNamed('compressor.attack', compressor.attack, immediate);
            this.setNamed('compressor.release', compressor.release, immediate);
            this.setNamed('compressor.makeup', dbToGain(compressor.makeupDb), immediate);
        }
        if (delay.enabled) {
            const { dry, wet } = mixGains(delay.mix);
            this.setNamed('delay.time', Math.min(MAX_DELAY_SECONDS, Math.max(0.001, delay.time)), immediate);
            this.setNamed('delay.feedback', Math.min(0.95, Math.max(0, delay.feedback)), immediate);
            this.setNamed('delay.damping', delay.damping, immediate);
            this.setNamed('delay.dry', dry, immediate);
            this.setNamed('delay.wet', wet, immediate);
        }
        if (reverb.enabled && this.convolver) {
            const key = impulseResponseKey(reverb);
            if (key !== this.impulseKey) {
                this.convolver.buffer = createImpulseResponse(this.context, reverb);
                this.impulseKey = key;
            }
            const { dry, wet } = mixGains(reverb.mix);
            this.setNamed('reverb.preDelay', Math.min(MAX_PREDELAY_SECONDS, Math.max(0, reverb.preDelay)), immediate);
            this.setNamed('reverb.dry', dry, immediate);
            this.setNamed('reverb.wet', wet, immediate);
        }
    }
    private buildEq(settings: EqSettings): Stage {
        const low = this.context.createBiquadFilter();
        low.type = 'lowshelf';
        const mid = this.context.createBiquadFilter();
        mid.type = 'peaking';
        const high = this.context.createBiquadFilter();
        high.type = 'highshelf';
        low.connect(mid);
        mid.connect(high);
        this.params.set('eq.lowGain', low.gain);
        this.params.set('eq.lowFrequency', low.frequency);
        this.params.set('eq.midGain', mid.gain);
        this.params.set('eq.midFrequency', mid.frequency);
        this.params.set('eq.midQ', mid.Q);
        this.params.set('eq.highGain', high.gain);
        this.params.set('eq.highFrequency', high.frequency);
        low.frequency.value = settings.lowFrequency;
        mid.frequency.value = settings.midFrequency;
        high.frequency.value = settings.highFrequency;
        return { head: low, tail: high, nodes: [low, mid, high] };
    }
    private buildFilter(settings: FilterSettings): Stage {
        const filter = this.context.createBiquadFilter();
        filter.type = settings.type;
        filter.frequency.value = settings.frequency;
        filter.Q.value = settings.q;
        this.params.set('filter.frequency', filter.frequency);
        this.params.set('filter.q', filter.Q);
        return { head: filter, tail: filter, nodes: [filter] };
    }
    private buildDistortion(settings: DistortionSettings): Stage {
        const head = this.context.createGain();
        const dry = this.context.createGain();
        const shaper = this.context.createWaveShaper();
        shaper.oversample = settings.oversample ? '4x' : 'none';
        const wet = this.context.createGain();
        const sum = this.context.createGain();
        head.connect(dry);
        dry.connect(sum);
        head.connect(shaper);
        shaper.connect(wet);
        wet.connect(sum);
        this.shaper = shaper;
        this.params.set('distortion.dry', dry.gain);
        this.params.set('distortion.wet', wet.gain);
        return { head, tail: sum, nodes: [head, dry, shaper, wet, sum] };
    }
    private buildCompressor(settings: CompressorSettings): Stage {
        const compressor = this.context.createDynamicsCompressor();
        const makeup = this.context.createGain();
        compressor.connect(makeup);
        compressor.threshold.value = settings.thresholdDb;
        compressor.knee.value = settings.knee;
        compressor.ratio.value = settings.ratio;
        compressor.attack.value = settings.attack;
        compressor.release.value = settings.release;
        this.params.set('compressor.threshold', compressor.threshold);
        this.params.set('compressor.knee', compressor.knee);
        this.params.set('compressor.ratio', compressor.ratio);
        this.params.set('compressor.attack', compressor.attack);
        this.params.set('compressor.release', compressor.release);
        this.params.set('compressor.makeup', makeup.gain);
        return { head: compressor, tail: makeup, nodes: [compressor, makeup] };
    }
    private buildDelay(settings: DelaySettings): Stage {
        const head = this.context.createGain();
        const dry = this.context.createGain();
        const delay = this.context.createDelay(MAX_DELAY_SECONDS);
        const damping = this.context.createBiquadFilter();
        damping.type = 'lowpass';
        const feedback = this.context.createGain();
        const wet = this.context.createGain();
        const sum = this.context.createGain();
        head.connect(dry);
        dry.connect(sum);
        head.connect(delay);
        delay.connect(damping);
        damping.connect(feedback);
        feedback.connect(delay);
        damping.connect(wet);
        wet.connect(sum);
        delay.delayTime.value = Math.min(MAX_DELAY_SECONDS, settings.time);
        this.params.set('delay.time', delay.delayTime);
        this.params.set('delay.feedback', feedback.gain);
        this.params.set('delay.damping', damping.frequency);
        this.params.set('delay.dry', dry.gain);
        this.params.set('delay.wet', wet.gain);
        return { head, tail: sum, nodes: [head, dry, delay, damping, feedback, wet, sum] };
    }
    private buildReverb(settings: ReverbSettings): Stage {
        const head = this.context.createGain();
        const dry = this.context.createGain();
        const preDelay = this.context.createDelay(MAX_PREDELAY_SECONDS);
        const convolver = this.context.createConvolver();
        const wet = this.context.createGain();
        const sum = this.context.createGain();
        head.connect(dry);
        dry.connect(sum);
        head.connect(preDelay);
        preDelay.connect(convolver);
        convolver.connect(wet);
        wet.connect(sum);
        preDelay.delayTime.value = Math.min(MAX_PREDELAY_SECONDS, settings.preDelay);
        this.convolver = convolver;
        this.params.set('reverb.preDelay', preDelay.delayTime);
        this.params.set('reverb.dry', dry.gain);
        this.params.set('reverb.wet', wet.gain);
        return { head, tail: sum, nodes: [head, dry, preDelay, convolver, wet, sum] };
    }
}
