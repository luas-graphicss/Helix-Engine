import { isAudioAsset, type AudioLibraryAsset } from '@/engine/assets/library/audio-asset';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { computeWaveformPeaks, type WaveformPeaks } from '@/engine/audio/analysis/waveform-peaks';
import { AudioEngine } from '@/engine/audio/audio-engine';
import { clipRegion, loopRegion, neutralizeClip, type AudioClipSettings, type ClipRegion } from '@/engine/audio/clip/audio-clip-settings';
import type { AudioVoice } from '@/engine/audio/playback/audio-voice';
import { AudioWorld } from '@/engine/audio/world/audio-world';
import type { EditorSession } from '@/engine/editor/session/editor-session';
export type AudioView = 'clip' | 'mixer' | 'scene';
export interface AudioViewRange {
    readonly start: number;
    readonly end: number;
}
type Listener = () => void;
const MIN_ZOOM_SECONDS = 0.02;
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class AudioEditor {
    readonly engine = new AudioEngine();
    readonly world: AudioWorld;
    assetId: string | null = null;
    buffer: AudioBuffer | null = null;
    peaks: WaveformPeaks | null = null;
    loading = false;
    error: string | null = null;
    view: AudioView = 'clip';
    bypass = false;
    zoom: AudioViewRange | null = null;
    openCount = 0;
    private voice: AudioVoice | null = null;
    private cursor = 0;
    private lastSettings: AudioClipSettings | null = null;
    private quick: {
        assetId: string;
        voice: AudioVoice;
    } | null = null;
    private openToken = 0;
    private frame: number | null = null;
    private version = 0;
    private readonly listeners = new Set<Listener>();
    private timeVersion = 0;
    private readonly timeListeners = new Set<Listener>();
    constructor(private readonly session: EditorSession) {
        this.engine.subscribe(() => this.notify());
        this.world = new AudioWorld({
            get scene() {
                return session.scene;
            },
            get camera() {
                return session.camera;
            },
            engine: this.engine,
            asset: (id) => {
                const asset = session.library.get(id);
                return asset && isAudioAsset(asset) ? asset : null;
            },
            file: (asset) => session.library.primaryFile(asset),
            log: (level, message) => session.log[level]('Áudio 3D', message),
        });
    }
    get asset(): AudioLibraryAsset | null {
        if (!this.assetId)
            return null;
        const asset = this.session.library.get(this.assetId);
        return asset && isAudioAsset(asset) ? asset : null;
    }
    get settings(): AudioClipSettings | null {
        return this.asset?.details.clip ?? null;
    }
    get active(): boolean {
        return this.assetId !== null;
    }
    get duration(): number {
        return this.buffer?.duration ?? this.asset?.details.durationSeconds ?? 0;
    }
    get region(): ClipRegion | null {
        const settings = this.settings;
        return settings && this.duration > 0 ? clipRegion(settings, this.duration) : null;
    }
    get loopRange(): ClipRegion | null {
        const settings = this.settings;
        return settings && this.duration > 0 ? loopRegion(settings, this.duration) : null;
    }
    get playing(): boolean {
        return this.voice?.state === 'playing';
    }
    get paused(): boolean {
        return this.voice?.state === 'paused';
    }
    get position(): number {
        return this.voice ? this.voice.position : this.cursor;
    }
    get quickPreviewAssetId(): string | null {
        return this.quick?.assetId ?? null;
    }
    get visibleRange(): AudioViewRange {
        return this.zoom ?? { start: 0, end: Math.max(this.duration, MIN_ZOOM_SECONDS) };
    }
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    getVersion = (): number => this.version;
    subscribeTime = (listener: Listener): (() => void) => {
        this.timeListeners.add(listener);
        return () => this.timeListeners.delete(listener);
    };
    getTimeVersion = (): number => this.timeVersion;
    async open(asset: LibraryAsset): Promise<{
        buffer: AudioBuffer;
        peaks: WaveformPeaks;
    } | null> {
        if (!isAudioAsset(asset))
            return null;
        this.openCount++;
        if (this.assetId === asset.id && this.buffer && this.peaks) {
            this.notify();
            return { buffer: this.buffer, peaks: this.peaks };
        }
        this.releaseVoice();
        this.assetId = asset.id;
        this.lastSettings = asset.details.clip;
        this.buffer = null;
        this.peaks = null;
        this.loading = true;
        this.error = null;
        this.zoom = null;
        this.cursor = asset.details.clip.trimStart;
        this.notify();
        const token = ++this.openToken;
        try {
            const buffer = await this.engine.load(asset.id, () => this.session.library.primaryFile(asset));
            if (token !== this.openToken)
                return null;
            const peaks = computeWaveformPeaks(buffer);
            this.buffer = buffer;
            this.peaks = peaks;
            this.loading = false;
            this.cursor = clipRegion(asset.details.clip, buffer.duration).start;
            this.notify();
            return { buffer, peaks };
        }
        catch (cause) {
            if (token !== this.openToken)
                return null;
            this.loading = false;
            this.error = errorMessage(cause);
            this.notify();
            return null;
        }
    }
    close(): void {
        if (!this.assetId)
            return;
        this.openToken++;
        this.releaseVoice();
        this.assetId = null;
        this.lastSettings = null;
        this.buffer = null;
        this.peaks = null;
        this.loading = false;
        this.error = null;
        this.zoom = null;
        this.notify();
    }
    async play(from?: number): Promise<void> {
        if (!this.buffer || !this.settings)
            return;
        await this.engine.unlock();
        if (!this.buffer || !this.settings)
            return;
        const region = clipRegion(this.settings, this.buffer.duration);
        if (!this.voice) {
            this.voice = this.engine.createVoice(this.buffer, this.effectiveSettings(), { onEnded: () => this.onVoiceEnded() });
        }
        const start = from ?? (this.cursor >= region.end - 1e-3 ? region.start : this.cursor);
        this.voice.play(start);
        this.startClock();
        this.notify();
    }
    pause(): void {
        if (!this.voice || this.voice.state !== 'playing')
            return;
        this.cursor = this.voice.position;
        this.voice.pause();
        this.stopClock();
        this.notify();
    }
    stop(): void {
        const region = this.region;
        this.cursor = region?.start ?? 0;
        this.voice?.stop();
        this.stopClock();
        this.notify();
    }
    togglePlay(): void {
        if (this.playing)
            this.pause();
        else
            void this.play();
    }
    seek(seconds: number): void {
        const region = this.region;
        if (!region)
            return;
        const target = Math.min(Math.max(seconds, region.start), region.end);
        this.cursor = target;
        this.voice?.seek(target);
        this.notifyTime();
    }
    goToStart(): void {
        const region = this.region;
        if (region)
            this.seek(region.start);
    }
    goToEnd(): void {
        const region = this.region;
        if (!region)
            return;
        if (this.playing)
            this.pause();
        this.seek(region.end);
    }
    stepSeconds(delta: number): void {
        this.seek(this.position + delta);
    }
    setView(view: AudioView): void {
        if (this.view === view)
            return;
        this.view = view;
        this.notify();
    }
    setBypass(on: boolean): void {
        if (this.bypass === on)
            return;
        this.bypass = on;
        this.voice?.update(this.effectiveSettings());
        this.notify();
    }
    setZoom(range: AudioViewRange | null): void {
        const duration = this.duration;
        if (!range || duration <= 0 || (range.start <= 0 && range.end >= duration)) {
            if (this.zoom === null)
                return;
            this.zoom = null;
            this.notify();
            return;
        }
        const span = Math.max(MIN_ZOOM_SECONDS, Math.min(duration, range.end - range.start));
        const start = Math.min(Math.max(0, range.start), duration - span);
        this.zoom = { start, end: start + span };
        this.notify();
    }
    zoomToRegion(): void {
        const region = this.region;
        if (!region)
            return;
        const margin = (region.end - region.start) * 0.05;
        this.setZoom({ start: region.start - margin, end: region.end + margin });
    }
    applyMixer(): void {
        this.engine.setMixerSettings(this.session.scene.audio);
        this.notify();
    }
}
