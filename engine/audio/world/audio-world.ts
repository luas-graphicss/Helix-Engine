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
    tick(deltaSeconds: number): void {
        if (this.disposed)
            return;
        this.clock += deltaSeconds;
        const { scene, camera, engine } = this.host;
        scene.updateWorldMatrices();
        const sources: Entity[] = [];
        const zones: Entity[] = [];
        scene.traverseVisible((entity) => {
            if (entity.audioSource)
                sources.push(entity);
            if (entity.audioZone)
                zones.push(entity);
        });
        const context = engine.context;
        const running = context !== null && context.state === 'running';
        if (running && context) {
            if (!this.listener)
                this.listener = new SpatialListener(context);
            if (!this.reverb)
                this.reverb = new ZoneReverbBus(context, engine.returnInput());
            this.listener.update(camera.position, camera.target, deltaSeconds);
        }
        const listenerPosition = camera.position;
        for (const runtime of this.runtimes.values())
            runtime.seen = false;
        this.updateZones(zones, listenerPosition, running);
        let locked = false;
        const wanting: Runtime[] = [];
        for (const entity of sources) {
            const runtime = this.evaluate(entity, listenerPosition, deltaSeconds);
            if (runtime.wants)
                wanting.push(runtime);
        }
        const allowed = new Set<Runtime>();
        if (wanting.length > MAX_WORLD_VOICES) {
            wanting.sort((a, b) => b.score - a.score);
            for (let i = 0; i < MAX_WORLD_VOICES; i++)
                allowed.add(wanting[i]);
        }
        else {
            for (const runtime of wanting)
                allowed.add(runtime);
        }
        let occlusionBudget = OCCLUSION_PER_TICK;
        let playing = 0;
        let virtual = 0;
        let loading = 0;
        for (const entity of sources) {
            const runtime = this.runtimes.get(entity.id);
            if (!runtime)
                continue;
            const result = this.apply(entity, runtime, allowed.has(runtime), running, listenerPosition, occlusionBudget);
            occlusionBudget = result.occlusionBudget;
            if (result.locked)
                locked = true;
            if (runtime.status === 'playing')
                playing++;
            else if (runtime.status === 'virtual')
                virtual++;
            else if (runtime.status === 'loading')
                loading++;
        }
        if (locked)
            this.hookUnlock();
        for (const [id, runtime] of this.runtimes) {
            if (runtime.seen)
                continue;
            if (runtime.voice)
                this.release(runtime, 0.05);
            runtime.loading = 0;
            this.runtimes.delete(id);
        }
        this.stats = {
            sources: sources.length,
            zones: zones.length,
            playing,
            virtual,
            loading,
            locked,
            activeZone: this.activeZone ? { entityId: this.activeZone.entity.id, name: this.activeZone.entity.name, weight: this.activeZone.weight } : null,
        };
        this.publish(playing);
    }
    private resetTriggers(): void {
        for (const runtime of this.runtimes.values()) {
            runtime.armed = false;
            runtime.pending = false;
            runtime.done = false;
            runtime.nextShotAt = 0;
            runtime.latched = false;
        }
    }
    private ensureRuntime(entityId: number): Runtime {
        let runtime = this.runtimes.get(entityId);
        if (!runtime) {
            runtime = new Runtime(entityId);
            runtime.occlusionAt = this.clock + Math.random() * OCCLUSION_INTERVAL;
            this.runtimes.set(entityId, runtime);
        }
        return runtime;
    }
    private evaluate(entity: Entity, listenerPosition: Vec3, deltaSeconds: number): Runtime {
        const settings = entity.audioSource as AudioSourceSettings;
        const runtime = this.ensureRuntime(entity.id);
        runtime.seen = true;
        const m = entity.worldMatrix;
        if (runtime.hasPose && deltaSeconds > 0) {
            vec3.set(delta, m[12] - runtime.position[0], m[13] - runtime.position[1], m[14] - runtime.position[2]);
            vec3.scale(delta, delta, 1 / deltaSeconds);
            if (vec3.length(delta) > MAX_SOURCE_SPEED)
                vec3.set(delta, 0, 0, 0);
            vec3.set(runtime.velocity, runtime.velocity[0] + (delta[0] - runtime.velocity[0]) * 0.25, runtime.velocity[1] + (delta[1] - runtime.velocity[1]) * 0.25, runtime.velocity[2] + (delta[2] - runtime.velocity[2]) * 0.25);
        }
        vec3.set(runtime.position, m[12], m[13], m[14]);
        vec3.set(runtime.forward, -m[8], -m[9], -m[10]);
        if (vec3.length(runtime.forward) > 1e-6)
            vec3.normalize(runtime.forward, runtime.forward);
        else
            vec3.set(runtime.forward, 0, 0, -1);
        runtime.hasPose = true;
        runtime.distance = vec3.distance(runtime.position, listenerPosition);
        runtime.distanceDb = sourceDistanceDb(settings, runtime.distance);
        runtime.inside = runtime.distance <= effectiveTriggerRadius(settings);
        if (deltaSeconds > 0 && runtime.occlusion !== runtime.occlusionTarget) {
            const blend = 1 - Math.exp(-deltaSeconds / OCCLUSION_SMOOTHING);
            runtime.occlusion += (runtime.occlusionTarget - runtime.occlusion) * blend;
            if (Math.abs(runtime.occlusion - runtime.occlusionTarget) < 1e-3)
                runtime.occlusion = runtime.occlusionTarget;
        }
        if (runtime.settingsRef !== settings) {
            const previous = runtime.settingsRef;
            if (previous && runtime.voice) {
                const topologyChanged = previous.assetId !== settings.assetId || previous.spatial !== settings.spatial || previous.panningModel !== settings.panningModel || previous.loopMode !== settings.loopMode;
                if (topologyChanged)
                    runtime.restart = true;
                else
                    runtime.voice.applySource(settings);
            }
            runtime.done = false;
            runtime.error = null;
            runtime.settingsRef = settings;
        }
        runtime.asset = settings.assetId ? this.host.asset(settings.assetId) : null;
        const clip = runtime.asset?.details.clip ?? null;
        const resolvedLoop = settings.loopMode === 'clip' ? (clip?.loop ?? false) : settings.loopMode === 'loop';
        const repeats = settings.repeatMax > 0 || settings.repeatMin > 0;
        const active = this.mode === 'game' || this.audition;
        let should: boolean;
        if (settings.muted || !runtime.asset) {
            should = false;
        }
        else if (this.soloSourceId !== null && this.soloSourceId !== entity.id) {
            should = false;
        }
        else if (runtime.latched) {
            should = true;
        }
        else if (!active) {
            should = false;
        }
        else {
            switch (settings.trigger) {
                case 'auto':
                    should = resolvedLoop || repeats || !runtime.done;
                    break;
                case 'proximity':
                    if (runtime.inside) {
                        if (!runtime.armed) {
                            runtime.armed = true;
                            runtime.pending = true;
                        }
                        should = resolvedLoop || repeats || runtime.pending || runtime.voice !== null;
                    }
                    else {
                        runtime.armed = false;
                        runtime.pending = false;
                        should = runtime.voice !== null && !settings.stopOnExit;
                    }
                    break;
                default:
                    should = runtime.voice !== null;
            }
        }
        runtime.should = should;
        runtime.audible = !settings.spatial || runtime.distance < settings.maxDistance;
        const canStart = runtime.nextShotAt === 0 || this.clock >= runtime.nextShotAt;
        runtime.wants = should && runtime.audible && (runtime.voice !== null || canStart);
        runtime.score = settings.priority * 100 + Math.max(-100, runtime.distanceDb + settings.volumeDb);
        return runtime;
    }
    private apply(entity: Entity, runtime: Runtime, allowed: boolean, running: boolean, listenerPosition: Vec3, occlusionBudget: number): {
        occlusionBudget: number;
        locked: boolean;
    } {
        const settings = entity.audioSource as AudioSourceSettings;
        if (runtime.voice && runtime.voice.voice.state === 'stopped') {
            runtime.voice.dispose();
            runtime.voice = null;
        }
        if (runtime.restart && runtime.voice) {
            this.release(runtime, 0.05);
            runtime.restart = false;
        }
        if (!runtime.should) {
            if (runtime.voice)
                this.release(runtime, settings.fadeOut);
            runtime.loading = 0;
            runtime.pending = false;
            runtime.clearOcclusion();
            runtime.status = this.idleStatus(entity, runtime, settings);
            return { occlusionBudget, locked: false };
        }
        if (!runtime.audible || !allowed) {
            if (runtime.voice)
                this.release(runtime, VIRTUAL_FADE);
            runtime.loading = 0;
            runtime.clearOcclusion();
            runtime.status = 'virtual';
            return { occlusionBudget, locked: false };
        }
        if (runtime.voice) {
            runtime.status = 'playing';
            return { occlusionBudget: this.updateVoice(entity, runtime, settings, listenerPosition, occlusionBudget), locked: false };
        }
        if (runtime.nextShotAt > 0 && this.clock < runtime.nextShotAt) {
            runtime.status = 'waiting';
            return { occlusionBudget, locked: false };
        }
        if (!this.host.engine.supported) {
            runtime.status = 'error';
            runtime.error = 'Este navegador não oferece Web Audio.';
            return { occlusionBudget, locked: false };
        }
        if (!running) {
            runtime.status = 'locked';
            return { occlusionBudget, locked: true };
        }
        if (runtime.loading) {
            runtime.status = 'loading';
            return { occlusionBudget, locked: false };
        }
        this.start(entity, runtime);
        return { occlusionBudget, locked: false };
    }
    private idleStatus(entity: Entity, runtime: Runtime, settings: AudioSourceSettings): SourceStatus {
        if (runtime.error)
            return 'error';
        if (!settings.assetId || !runtime.asset)
            return 'no-asset';
        if (settings.muted)
            return 'muted';
        if (this.soloSourceId !== null && this.soloSourceId !== entity.id)
            return 'solo-muted';
        if (this.mode === 'edit' && !this.audition)
            return 'off';
        if (settings.trigger === 'proximity' && !runtime.inside)
            return 'waiting';
        if (settings.trigger === 'manual')
            return 'waiting';
        return 'stopped';
    }
}
