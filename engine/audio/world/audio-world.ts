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
    private start(entity: Entity, runtime: Runtime): void {
        const asset = runtime.asset;
        if (!asset)
            return;
        const token = Date.now() + Math.random();
        runtime.loading = token;
        runtime.status = 'loading';
        const { engine } = this.host;
        void engine
            .load(asset.id, () => this.host.file(asset))
            .then((buffer) => {
            if (runtime.loading !== token || this.runtimes.get(runtime.entityId) !== runtime || this.disposed)
                return;
            runtime.loading = 0;
            if (!runtime.should || !runtime.audible || runtime.voice)
                return;
            this.spawn(entity, runtime, buffer);
        })
            .catch((cause) => {
            if (runtime.loading !== token)
                return;
            runtime.loading = 0;
            runtime.error = cause instanceof Error ? cause.message : String(cause);
            runtime.status = 'error';
            runtime.latched = false;
            this.host.log('error', `${entity.name}: não foi possível tocar ${asset.name}: ${runtime.error}`);
            this.notify();
        });
    }
    private spawn(entity: Entity, runtime: Runtime, buffer: AudioBuffer): void {
        const settings = entity.audioSource;
        const context = this.host.engine.context;
        const reverb = this.reverb;
        if (!settings || !context || !reverb || !runtime.asset)
            return;
        const clip = runtime.asset.details.clip;
        const { engine } = this.host;
        const voice = new SpatialVoice(context, engine, buffer, clip, settings, engine.busInput(clip.bus), reverb.input, {
            randomize: true,
            onEnded: () => this.onEnded(entity, runtime),
        });
        runtime.voice = voice;
        runtime.clipRef = clip;
        runtime.pending = false;
        runtime.nextShotAt = 0;
        runtime.occlusionAt = this.clock;
        voice.setPose(runtime.position, runtime.forward, true);
        voice.setLevel(this.levelGain(runtime, settings), true);
        const derived = deriveSourceClip(clip, settings);
        const region = clipRegion(derived, buffer.duration);
        let from = region.start;
        if (derived.loop && settings.randomStart) {
            const loop = loopRegion(derived, buffer.duration);
            from = loop.start + Math.random() * Math.max(0, loop.end - loop.start - 0.01);
        }
        voice.voice.play(from);
        voice.fadeIn(settings.fadeIn);
        runtime.status = 'playing';
        this.notify();
    }
    private onEnded(entity: Entity, runtime: Runtime): void {
        if (this.runtimes.get(runtime.entityId) !== runtime)
            return;
        if (runtime.voice) {
            runtime.voice.dispose();
            runtime.voice = null;
        }
        const settings = entity.audioSource;
        runtime.latched = false;
        if (settings && (settings.repeatMax > 0 || settings.repeatMin > 0) && runtime.should) {
            const min = Math.min(settings.repeatMin, settings.repeatMax);
            const max = Math.max(settings.repeatMin, settings.repeatMax);
            runtime.nextShotAt = this.clock + min + Math.random() * (max - min);
            runtime.status = 'waiting';
        }
        else if (settings?.trigger === 'auto') {
            runtime.done = true;
            runtime.status = 'stopped';
        }
        else {
            runtime.status = settings?.trigger === 'proximity' && runtime.inside ? 'stopped' : 'waiting';
        }
        this.notify();
    }
    private release(runtime: Runtime, fadeSeconds: number): void {
        const { voice } = runtime;
        if (!voice)
            return;
        runtime.voice = null;
        voice.fadeOutAndDispose(fadeSeconds);
    }
    private levelGain(runtime: Runtime, settings: AudioSourceSettings): number {
        let gain = dbToGain(settings.volumeDb);
        if (settings.spatial)
            gain *= rangeFadeGain(settings, runtime.distance);
        if (runtime.occlusion > 0)
            gain *= dbToGain(settings.occlusion.attenuationDb * runtime.occlusion);
        return gain;
    }
    private updateVoice(entity: Entity, runtime: Runtime, settings: AudioSourceSettings, listenerPosition: Vec3, occlusionBudget: number): number {
        const voice = runtime.voice as SpatialVoice;
        const clip = runtime.asset?.details.clip ?? null;
        if (clip && clip !== runtime.clipRef) {
            runtime.clipRef = clip;
            voice.voice.update(deriveSourceClip(clip, settings));
        }
        voice.setPose(runtime.position, runtime.forward);
        if (settings.spatial && settings.occlusion.enabled) {
            if (occlusionBudget > 0 && this.clock >= runtime.occlusionAt) {
                runtime.occlusionTarget = occlusionAmount(this.host.scene, listenerPosition, runtime.position, entity);
                runtime.occlusionAt = this.clock + OCCLUSION_INTERVAL * (0.85 + Math.random() * 0.3);
                occlusionBudget--;
            }
        }
        else {
            runtime.occlusionTarget = 0;
        }
        voice.setLevel(this.levelGain(runtime, settings));
        let filterHz = OPEN_FILTER_HZ;
        if (settings.spatial) {
            filterHz = Math.min(filterHz, airAbsorptionCutoff(runtime.distance, settings.airAbsorption), this.zoneFilterHz);
            if (runtime.occlusion > 0)
                filterHz = Math.min(filterHz, blendCutoff(settings.occlusion.lowpass, runtime.occlusion));
        }
        runtime.filterHz = filterHz;
        voice.setFilter(filterHz);
        voice.setSend(reverbSendGain(settings, runtime.distance));
        if (settings.doppler > 0 && settings.spatial && this.listener && runtime.distance > 0.05) {
            vec3.subtract(toListener, listenerPosition, runtime.position);
            vec3.scale(toListener, toListener, 1 / runtime.distance);
            const sourceApproach = vec3.dot(runtime.velocity, toListener);
            const listenerApproach = -vec3.dot(this.listener.velocity, toListener);
            const ratio = Math.min(2, Math.max(0.5, (SPEED_OF_SOUND + listenerApproach) / Math.max(1, SPEED_OF_SOUND - sourceApproach)));
            const cents = Math.min(DOPPLER_MAX_CENTS, Math.max(-DOPPLER_MAX_CENTS, 1200 * Math.log2(ratio) * settings.doppler));
            voice.setDetune(Math.abs(cents) < 0.5 ? 0 : cents);
        }
        else {
            voice.setDetune(0);
        }
        return occlusionBudget;
    }
    private updateZones(zones: Entity[], listenerPosition: Vec3, running: boolean): void {
        let best: ZoneCandidate | null = null;
        const seen = new Set<number>();
        const active = this.mode === 'game' || this.audition;
        for (const entity of zones) {
            const settings = entity.audioZone as AudioZoneSettings;
            const weight = zoneWeightAt(settings, entity.worldMatrix, listenerPosition);
            seen.add(entity.id);
            this.updateAmbience(entity, settings, active ? weight : 0, running);
            if (weight <= 0)
                continue;
            const volume = zoneWorldVolume(settings, entity.worldMatrix);
            if (!best || settings.priority > best.settings.priority || (settings.priority === best.settings.priority && volume < best.volume)) {
                best = { entity, settings, weight, volume };
            }
        }
        for (const [id, ambience] of this.ambiences) {
            if (seen.has(id))
                continue;
            this.releaseAmbience(ambience, AMBIENCE_FADE);
            this.ambiences.delete(id);
        }
        this.activeZone = best ? { entity: best.entity, weight: best.weight } : null;
        this.reverb?.apply(best?.settings ?? null, best?.weight ?? 0);
        this.zoneFilterHz = best && best.settings.filter.enabled ? blendCutoff(best.settings.filter.frequency, best.weight) : OPEN_FILTER_HZ;
    }
    private updateAmbience(entity: Entity, settings: AudioZoneSettings, weight: number, running: boolean): void {
        const { ambience } = settings;
        const existing = this.ambiences.get(entity.id);
        const wanted = settings.enabled && ambience.assetId !== null && weight > 0 && this.soloSourceId === null;
        const context = this.host.engine.context;
        const now = context?.currentTime ?? 0;
        if (!wanted) {
            if (!existing)
                return;
            if (existing.silentSince === 0)
                existing.silentSince = this.clock;
            existing.gain.gain.setTargetAtTime(0, now, 0.1);
            if (this.clock - existing.silentSince > AMBIENCE_GRACE) {
                this.releaseAmbience(existing, AMBIENCE_FADE);
                this.ambiences.delete(entity.id);
            }
            return;
        }
        const assetId = ambience.assetId as string;
        if (existing && existing.assetId !== assetId) {
            this.releaseAmbience(existing, 0.2);
            this.ambiences.delete(entity.id);
        }
        const current = this.ambiences.get(entity.id);
        if (current) {
            current.silentSince = 0;
            current.gain.gain.setTargetAtTime(dbToGain(ambience.volumeDb) * weight, now, 0.1);
            return;
        }
        if (!running || !context || this.ambienceLoading.has(entity.id)) {
            if (!running)
                this.hookUnlock();
            return;
        }
        const asset = this.host.asset(assetId);
        if (!asset)
            return;
        this.ambienceLoading.add(entity.id);
        const { engine } = this.host;
        void engine
            .load(asset.id, () => this.host.file(asset))
            .then((buffer) => {
            this.ambienceLoading.delete(entity.id);
            if (this.disposed || this.ambiences.has(entity.id))
                return;
            const live = entity.audioZone;
            if (!live || live.ambience.assetId !== assetId)
                return;
            const clip = asset.details.clip;
            const gain = context.createGain();
            gain.gain.value = 0;
            gain.connect(engine.busInput(clip.bus));
            const voice = new AudioVoice(context, buffer, { ...clip, loop: true }, gain, { randomize: false });
            engine.adopt(voice);
            const loop = loopRegion({ ...clip, loop: true }, buffer.duration);
            voice.play(loop.start + Math.random() * Math.max(0, loop.end - loop.start - 0.01));
            gain.gain.setTargetAtTime(dbToGain(live.ambience.volumeDb) * weight, context.currentTime, 0.15);
            this.ambiences.set(entity.id, { voice, gain, assetId, silentSince: 0 });
            this.notify();
        })
            .catch((cause) => {
            this.ambienceLoading.delete(entity.id);
            this.host.log('error', `${entity.name}: não foi possível tocar a cama ambiente: ${cause instanceof Error ? cause.message : String(cause)}`);
        });
    }
    private releaseAmbience(ambience: Ambience, fadeSeconds: number): void {
        const context = this.host.engine.context;
        if (context)
            ambience.gain.gain.setTargetAtTime(0, context.currentTime, Math.max(0.01, fadeSeconds / 3));
        const { engine } = this.host;
        setTimeout(() => {
            engine.release(ambience.voice);
            ambience.gain.disconnect();
        }, fadeSeconds * 1000 + 50);
    }
    private hookUnlock(): void {
        if (this.unlockHooked || typeof window === 'undefined')
            return;
        this.unlockHooked = true;
        const unlock = () => {
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
            this.unlockHooked = false;
            void this.host.engine.unlock().then(() => this.notify());
        };
        window.addEventListener('pointerdown', unlock, true);
        window.addEventListener('keydown', unlock, true);
    }
    private publish(playing: number): void {
        let signature = `${this.activeZone?.entity.id ?? ''}|${this.stats.locked ? 1 : 0}|`;
        for (const runtime of this.runtimes.values())
            signature += `${runtime.entityId}:${runtime.status}:${runtime.occluded ? 1 : 0}:${runtime.latched ? 1 : 0};`;
        if (signature !== this.lastSignature) {
            this.lastSignature = signature;
            this.lastStatsAt = this.clock;
            this.notify();
            return;
        }
        if ((playing > 0 || this.activeZone) && this.clock - this.lastStatsAt >= STATS_INTERVAL) {
            this.lastStatsAt = this.clock;
            this.notify();
        }
    }
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
