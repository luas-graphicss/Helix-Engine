import { clipRate, clipRegion, loopRegion, rollClipVariation, type AudioClipSettings, type ClipRegion } from '@/engine/audio/clip/audio-clip-settings';
import { ClipGraph } from '@/engine/audio/graph/clip-graph';
import { scheduleFadeAutomation } from '@/engine/audio/graph/fade-curves';
export type VoiceState = 'playing' | 'paused' | 'stopped';
export interface VoiceOptions {
    readonly randomize?: boolean;
    readonly onEnded?: (voice: AudioVoice) => void;
}
const DECLICK_SECONDS = 0.012;
export class AudioVoice {
    readonly graph: ClipGraph;
    state: VoiceState = 'stopped';
    private settings: AudioClipSettings;
    private source: AudioBufferSourceNode | null = null;
    private startedAt = 0;
    private startOffset = 0;
    private heldPosition: number;
    private pitchOffset = 0;
    private detuneOffsetCents = 0;
    private generation = 0;
    constructor(private readonly context: BaseAudioContext, readonly buffer: AudioBuffer, settings: AudioClipSettings, destination: AudioNode, private readonly options: VoiceOptions = {}) {
        this.settings = settings;
        this.graph = new ClipGraph(context, settings);
        this.graph.output.connect(destination);
        this.heldPosition = this.region.start;
        if (options.randomize) {
            const variation = rollClipVariation(settings);
            this.pitchOffset = variation.pitchOffset;
            this.graph.setVolumeOffset(variation.volumeOffsetDb);
        }
    }
    get duration(): number {
        return this.buffer.duration;
    }
    get region(): ClipRegion {
        return clipRegion(this.settings, this.duration);
    }
    get rate(): number {
        return clipRate(this.settings, this.pitchOffset);
    }
    get position(): number {
        if (this.state !== 'playing')
            return this.heldPosition;
        const elapsed = (this.context.currentTime - this.startedAt) * this.rate;
        const raw = this.startOffset + elapsed;
        if (this.settings.loop) {
            const loop = loopRegion(this.settings, this.duration);
            if (raw < loop.end)
                return raw;
            const span = loop.end - loop.start;
            return loop.start + ((raw - loop.end) % span);
        }
        return Math.min(raw, this.region.end);
    }
    play(from = this.region.start): void {
        const region = this.region;
        const position = Math.min(Math.max(from, region.start), region.end - 1e-3);
        this.killSource();
        const source = this.context.createBufferSource();
        source.buffer = this.buffer;
        source.detune.value = (this.settings.pitch + this.pitchOffset) * 100 + this.detuneOffsetCents;
        this.applyLoop(source);
        source.connect(this.graph.input);
        const now = this.context.currentTime;
        const generation = ++this.generation;
        source.onended = () => {
            if (generation !== this.generation)
                return;
            this.source = null;
            this.state = 'stopped';
            this.heldPosition = this.region.start;
            this.options.onEnded?.(this);
        };
        scheduleFadeAutomation(this.graph.fade.gain, this.settings, region, position, this.rate, now);
        if (this.settings.loop)
            source.start(now, position);
        else
            source.start(now, position, Math.max(0.001, region.end - position));
        this.source = source;
        this.startedAt = now;
        this.startOffset = position;
        this.state = 'playing';
    }
    pause(): void {
        if (this.state !== 'playing')
            return;
        this.heldPosition = this.position;
        this.release();
        this.state = 'paused';
    }
    resume(): void {
        if (this.state === 'playing')
            return;
        this.play(this.heldPosition);
    }
    seek(seconds: number): void {
        const region = this.region;
        const target = Math.min(Math.max(seconds, region.start), region.end);
        if (this.state === 'playing')
            this.play(target);
        else
            this.heldPosition = target;
    }
    stop(fadeSeconds = DECLICK_SECONDS): void {
        this.heldPosition = this.region.start;
        if (this.state === 'playing')
            this.release(fadeSeconds);
        this.state = 'stopped';
    }
    update(settings: AudioClipSettings): void {
        const previousRegion = this.region;
        const wasLooping = this.settings.loop;
        const position = this.position;
        this.settings = settings;
        this.graph.apply(settings);
        if (this.state !== 'playing' || !this.source) {
            this.heldPosition = Math.min(Math.max(this.heldPosition, this.region.start), this.region.end);
            return;
        }
        const region = this.region;
        const regionChanged = region.start !== previousRegion.start || region.end !== previousRegion.end;
        const loopTurnedOff = wasLooping && !settings.loop;
        if (regionChanged || loopTurnedOff) {
            this.play(Math.min(Math.max(position, region.start), region.end - 1e-3));
            return;
        }
        this.source.detune.setTargetAtTime((settings.pitch + this.pitchOffset) * 100 + this.detuneOffsetCents, this.context.currentTime, 0.02);
        this.applyLoop(this.source);
    }
    setDetuneOffset(cents: number): void {
        if (!Number.isFinite(cents) || cents === this.detuneOffsetCents)
            return;
        this.detuneOffsetCents = cents;
        this.source?.detune.setTargetAtTime((this.settings.pitch + this.pitchOffset) * 100 + cents, this.context.currentTime, 0.05);
    }
    dispose(): void {
        this.generation++;
        this.killSource();
        this.graph.dispose();
        this.state = 'stopped';
    }
    private applyLoop(source: AudioBufferSourceNode): void {
        source.loop = this.settings.loop;
        if (this.settings.loop) {
            const loop = loopRegion(this.settings, this.duration);
            source.loopStart = loop.start;
            source.loopEnd = loop.end;
        }
    }
    private release(fadeSeconds = DECLICK_SECONDS): void {
        const source = this.source;
        if (!source)
            return;
        this.generation++;
        this.source = null;
        source.onended = null;
        const now = this.context.currentTime;
        const fade = this.graph.fade.gain;
        const current = fade.value;
        fade.cancelScheduledValues(now);
        fade.setValueAtTime(current, now);
        fade.linearRampToValueAtTime(0, now + fadeSeconds);
        try {
            source.stop(now + fadeSeconds + 0.005);
        }
        catch {
        }
        setTimeout(() => source.disconnect(), (fadeSeconds + 0.05) * 1000);
    }
    private killSource(): void {
        const source = this.source;
        if (!source)
            return;
        this.generation++;
        this.source = null;
        source.onended = null;
        try {
            source.stop();
        }
        catch {
        }
        source.disconnect();
    }
}
