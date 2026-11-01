import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { AudioLibraryAsset } from '@/engine/assets/library/audio-asset';
import type { AudioEngine } from '@/engine/audio/audio-engine';
import { clipRegion, loopRegion, type AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { dbToGain } from '@/engine/audio/core/decibels';
import { AudioVoice } from '@/engine/audio/playback/audio-voice';
import { effectiveTriggerRadius, rangeFadeGain, reverbSendGain, sourceDistanceDb, SPEED_OF_SOUND, type AudioSourceSettings } from './audio-source-settings';
import { zoneWeightAt, zoneWorldVolume, type AudioZoneSettings } from './audio-zone-settings';
import { occlusionAmount } from './audio-occlusion';
import { airAbsorptionCutoff, blendCutoff, OPEN_FILTER_HZ } from './spatial-filter';
import { SpatialListener } from './spatial-listener';
import { deriveSourceClip, SpatialVoice } from './spatial-voice';
import { ZoneReverbBus } from './zone-reverb-bus';
export type AudioWorldMode = 'edit' | 'game';
export type SourceStatus = 'playing' | 'virtual' | 'loading' | 'waiting' | 'stopped' | 'muted' | 'solo-muted' | 'no-asset' | 'off' | 'locked' | 'error';
export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
    playing: 'Tocando',
    virtual: 'Fora de alcance',
    loading: 'Carregando',
    waiting: 'Aguardando',
    stopped: 'Parada',
    muted: 'Muda',
    'solo-muted': 'Calada pelo solo',
    'no-asset': 'Sem áudio',
    off: 'Audição desligada',
    locked: 'Aguardando um clique',
    error: 'Erro',
};
export interface SourceRuntimeView {
    readonly entityId: number;
    readonly status: SourceStatus;
    readonly distance: number;
    readonly distanceDb: number;
    readonly occlusion: number;
    readonly occluded: boolean;
    readonly filterHz: number;
    readonly inside: boolean;
    readonly latched: boolean;
    readonly error: string | null;
}
export interface AudioWorldStats {
    readonly sources: number;
    readonly zones: number;
    readonly playing: number;
    readonly virtual: number;
    readonly loading: number;
    readonly locked: boolean;
    readonly activeZone: {
        readonly entityId: number;
        readonly name: string;
        readonly weight: number;
    } | null;
}
export interface AudioWorldHost {
    readonly scene: Scene;
    readonly camera: PerspectiveCamera;
    readonly engine: AudioEngine;
    asset(id: string): AudioLibraryAsset | null;
    file(asset: AudioLibraryAsset): Promise<File>;
    log(level: 'info' | 'warn' | 'error', message: string): void;
}
const MAX_WORLD_VOICES = 24;
const OCCLUSION_INTERVAL = 0.15;
const OCCLUSION_PER_TICK = 2;
const OCCLUSION_SMOOTHING = 0.12;
const STATS_INTERVAL = 0.2;
const VIRTUAL_FADE = 0.25;
const AMBIENCE_FADE = 0.6;
const AMBIENCE_GRACE = 0.5;
const DOPPLER_MAX_CENTS = 1200;
const MAX_SOURCE_SPEED = 80;
class Runtime implements SourceRuntimeView {
    status: SourceStatus = 'stopped';
    distance = 0;
    distanceDb = 0;
    occlusion = 0;
    occlusionTarget = 0;
    filterHz = OPEN_FILTER_HZ;
    inside = false;
    latched = false;
    error: string | null = null;
    voice: SpatialVoice | null = null;
    settingsRef: AudioSourceSettings | null = null;
    clipRef: AudioClipSettings | null = null;
    asset: AudioLibraryAsset | null = null;
    armed = false;
    pending = false;
    done = false;
    nextShotAt = 0;
    loading = 0;
    restart = false;
    should = false;
    audible = true;
    wants = false;
    score = 0;
    seen = true;
    readonly position = vec3.create();
    readonly forward = vec3.create(0, 0, -1);
    readonly velocity = vec3.create();
    hasPose = false;
    occlusionAt = 0;
    constructor(readonly entityId: number) { }
    get occluded(): boolean {
        return this.occlusion > 0.5;
    }
    clearOcclusion(): void {
        this.occlusion = 0;
        this.occlusionTarget = 0;
        this.filterHz = OPEN_FILTER_HZ;
    }
}
interface Ambience {
    voice: AudioVoice;
    gain: GainNode;
    assetId: string;
    silentSince: number;
}
interface ZoneCandidate {
    entity: Entity;
    settings: AudioZoneSettings;
    weight: number;
    volume: number;
}
const delta = vec3.create();
const toListener = vec3.create();
export class AudioWorld {
    mode: AudioWorldMode = 'edit';
    audition = true;
    soloSourceId: number | null = null;
    activeZone: {
        entity: Entity;
        weight: number;
    } | null = null;
    private readonly runtimes = new Map<number, Runtime>();
    private readonly ambiences = new Map<number, Ambience>();
    private readonly ambienceLoading = new Set<number>();
    private listener: SpatialListener | null = null;
    private reverb: ZoneReverbBus | null = null;
    private clock = 0;
    private lastStatsAt = 0;
    private lastSignature = '';
    private zoneFilterHz = OPEN_FILTER_HZ;
    private unlockHooked = false;
    private disposed = false;
    private version = 0;
    private readonly listeners = new Set<() => void>();
    private stats: AudioWorldStats = { sources: 0, zones: 0, playing: 0, virtual: 0, loading: 0, locked: false, activeZone: null };
    constructor(private readonly host: AudioWorldHost) { }
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    getVersion = (): number => this.version;
    get snapshot(): AudioWorldStats {
        return this.stats;
    }
    get animating(): boolean {
        return this.stats.playing > 0;
    }
    runtime(entityId: number): SourceRuntimeView | null {
        return this.runtimes.get(entityId) ?? null;
    }
    isLatched(entityId: number): boolean {
        return this.runtimes.get(entityId)?.latched ?? false;
    }
    isPlaying(entityId: number): boolean {
        return (this.runtimes.get(entityId)?.voice ?? null) !== null;
    }
    setAudition(on: boolean): void {
        if (this.audition === on)
            return;
        this.audition = on;
        if (!on && this.mode === 'edit')
            this.stopAll(0.2, true);
        this.notify();
    }
    setSolo(entityId: number | null): void {
        if (this.soloSourceId === entityId)
            return;
        this.soloSourceId = entityId;
        this.notify();
    }
    play(entityId: number): void {
        const runtime = this.ensureRuntime(entityId);
        runtime.latched = true;
        runtime.pending = true;
        runtime.done = false;
        this.notify();
    }
    stop(entityId: number): void {
        const runtime = this.runtimes.get(entityId);
        if (!runtime)
            return;
        runtime.latched = false;
        runtime.pending = false;
        runtime.nextShotAt = 0;
        if (runtime.voice)
            this.release(runtime, runtime.settingsRef?.fadeOut ?? 0.3);
        runtime.status = 'stopped';
        this.notify();
    }
    toggle(entityId: number): void {
        const runtime = this.runtimes.get(entityId);
        if (runtime && (runtime.latched || runtime.voice))
            this.stop(entityId);
        else
            this.play(entityId);
    }
    stopAll(fadeSeconds = 0.3, keepLatched = false): void {
        for (const runtime of this.runtimes.values()) {
            if (keepLatched && runtime.latched)
                continue;
            runtime.latched = false;
            runtime.pending = false;
            runtime.nextShotAt = 0;
            if (runtime.voice)
                this.release(runtime, fadeSeconds);
        }
        for (const [id, ambience] of this.ambiences) {
            this.releaseAmbience(ambience, fadeSeconds);
            this.ambiences.delete(id);
        }
        this.notify();
    }
    enterGame(): void {
        this.stopAll(0.05);
        this.mode = 'game';
        this.resetTriggers();
        this.notify();
    }
    exitGame(): void {
        this.stopAll(0.3);
        this.mode = 'edit';
        this.resetTriggers();
        this.notify();
    }
    dispose(): void {
        this.disposed = true;
        this.stopAll(0.01);
        this.runtimes.clear();
        this.reverb?.dispose();
        this.reverb = null;
        this.listener = null;
    }
}
