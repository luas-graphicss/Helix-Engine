import { Entity } from '@/engine/core/scene/entity';
import type { AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { createClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import type { AudioVoice } from '@/engine/audio/playback/audio-voice';
import { BUS_VOLUME_MAX_DB, BUS_VOLUME_MIN_DB, type AudioBusId } from '@/engine/audio/mixer/mixer-settings';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { HelixArgumentError, HelixError, HelixNotImplementedError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireNumber, requireObject, requireOneOf, requireString } from '../runtime/values';
const BUSES: readonly AudioBusId[] = ['master', 'music', 'sfx', 'ambience', 'voice', 'ui'];
const CLIP_BUSES = BUSES.filter((bus) => bus !== 'master') as Exclude<AudioBusId, 'master'>[];
export function createAudioApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    const world = session.audio.world;
    const engine = session.audio.engine;
    const voices = new Set<AudioVoice>();
    function requireSource(value: unknown, member: string): Entity {
        const entity = requireEntity(value, member);
        if (!entity.audioSource)
            throw new HelixArgumentError(member, `${entity.name} não tem componente de som (audioSource).`);
        return entity;
    }
    function clipSettingsOf(asset: LibraryAsset): AudioClipSettings {
        const details = asset.details;
        return details.kind === 'audio' ? details.clip : createClipSettings();
    }
    async function play2d(assetValue: unknown, options: unknown, member: string): Promise<object> {
        const asset = host.resolveAsset(assetValue, member, 'audio');
        const extra = options === undefined || options === null ? {} : requireObject(options, member);
        if (!engine.supported)
            throw new HelixError(`${member}: este navegador não tem Web Audio.`);
        await engine.unlock();
        const buffer = await engine.load(asset.id, () => session.library.primaryFile(asset));
        if (!host.running)
            throw new HelixError(`${member}: o jogo parou antes de o som carregar.`);
        const base = clipSettingsOf(asset);
        const settings: AudioClipSettings = { ...base, fadeIn: { ...base.fadeIn }, fadeOut: { ...base.fadeOut }, effects: base.effects };
        if (extra.volumeDb !== undefined)
            settings.volumeDb = requireNumber(extra.volumeDb, member, 'volumeDb');
        if (extra.volume !== undefined)
            settings.volumeDb = 20 * Math.log10(Math.max(1e-4, requireNumber(extra.volume, member, 'volume')));
        if (extra.pitch !== undefined)
            settings.pitch = requireNumber(extra.pitch, member, 'pitch');
        if (extra.pan !== undefined)
            settings.pan = requireNumber(extra.pan, member, 'pan');
        if (extra.loop !== undefined)
            settings.loop = Boolean(extra.loop);
        if (extra.bus !== undefined)
            settings.bus = requireOneOf(extra.bus, CLIP_BUSES, member, 'o bus');
        const voice = engine.play(buffer, settings, {
            randomize: extra.randomize !== false,
            onEnded: (ended: AudioVoice) => {
                voices.delete(ended);
                host.bus.emit('audio.ended', { asset: asset.id });
            },
        });
        voices.add(voice);
        const owner = host.current;
        owner?.track(() => {
            if (voices.has(voice)) {
                voice.stop();
                voices.delete(voice);
            }
        });
        return {
            get asset() {
                return asset;
            },
            get playing() {
                return voice.state === 'playing';
            },
            get state() {
                return voice.state;
            },
            get position() {
                return voice.position;
            },
            get duration() {
                return voice.duration;
            },
            pause: () => voice.pause(),
            resume: () => voice.resume(),
            seek: (seconds: unknown) => voice.seek(requireNumber(seconds, 'voice.seek', 'os segundos')),
            stop: (fadeSeconds?: unknown) => {
                voice.stop(fadeSeconds === undefined ? undefined : requireNumber(fadeSeconds, 'voice.stop', 'o fade'));
                voices.delete(voice);
            },
            setVolumeDb: (db: unknown) => {
                settings.volumeDb = requireNumber(db, 'voice.setVolumeDb', 'os dB');
                voice.update(settings);
            },
            setPitch: (semitones: unknown) => {
                settings.pitch = requireNumber(semitones, 'voice.setPitch', 'os semitons');
                voice.update(settings);
            },
            setDetune: (cents: unknown) => voice.setDetuneOffset(requireNumber(cents, 'voice.setDetune', 'os cents')),
            get raw() {
                return voice;
            },
        };
    }
    const mixer = {
        get settings() {
            return scene.audio;
        },
        buses: () => BUSES.slice(),
        bus: (id: unknown) => scene.audio.buses[requireOneOf(id, BUSES, 'helix.audio.mixer.bus', 'o bus')],
        setVolumeDb: (id: unknown, db: unknown) => {
            const bus = scene.audio.buses[requireOneOf(id, BUSES, 'helix.audio.mixer.setVolumeDb', 'o bus')];
            bus.volumeDb = Math.min(BUS_VOLUME_MAX_DB, Math.max(BUS_VOLUME_MIN_DB, requireNumber(db, 'helix.audio.mixer.setVolumeDb', 'os dB')));
            session.audio.applyMixer();
        },
        setMuted: (id: unknown, muted: unknown) => {
            scene.audio.buses[requireOneOf(id, BUSES, 'helix.audio.mixer.setMuted', 'o bus')].muted = Boolean(muted);
            session.audio.applyMixer();
        },
        setSolo: (id: unknown, solo: unknown) => {
            scene.audio.buses[requireOneOf(id, BUSES, 'helix.audio.mixer.setSolo', 'o bus')].solo = Boolean(solo);
            session.audio.applyMixer();
        },
        apply: () => session.audio.applyMixer(),
        meter: (id: unknown) => engine.meter(requireOneOf(id, BUSES, 'helix.audio.mixer.meter', 'o bus')),
        get limiterReductionDb() {
            return engine.limiterReductionDb;
        },
        range: Object.freeze({ minDb: BUS_VOLUME_MIN_DB, maxDb: BUS_VOLUME_MAX_DB }),
    };
    const sources = {
        settingsOf: (value: unknown) => requireSource(value, 'helix.audio.sources.settingsOf').audioSource,
        set: (value: unknown, patch: unknown) => {
            const entity = requireSource(value, 'helix.audio.sources.set');
            assignSettings(entity.audioSource as unknown as Record<string, unknown>, patch, 'helix.audio.sources.set');
            session.notify();
        },
        play: (value: unknown) => world.play(requireSource(value, 'helix.audio.sources.play').id),
        stop: (value: unknown) => world.stop(requireSource(value, 'helix.audio.sources.stop').id),
        toggle: (value: unknown) => world.toggle(requireSource(value, 'helix.audio.sources.toggle').id),
        isPlaying: (value: unknown) => world.isPlaying(requireSource(value, 'helix.audio.sources.isPlaying').id),
        status: (value: unknown) => world.runtime(requireSource(value, 'helix.audio.sources.status').id),
        stopAll: (fadeSeconds?: unknown) => world.stopAll(fadeSeconds === undefined ? undefined : requireNumber(fadeSeconds, 'helix.audio.sources.stopAll', 'o fade')),
        all: () => {
            const result: Entity[] = [];
            scene.traverse((entity) => {
                if (entity.audioSource)
                    result.push(entity);
            });
            return result;
        },
    };
    const zones = {
        settingsOf: (value: unknown) => {
            const entity = requireEntity(value, 'helix.audio.zones.settingsOf');
            if (!entity.audioZone)
                throw new HelixArgumentError('helix.audio.zones.settingsOf', `${entity.name} não tem zona acústica.`);
            return entity.audioZone;
        },
        set: (value: unknown, patch: unknown) => {
            const entity = requireEntity(value, 'helix.audio.zones.set');
            if (!entity.audioZone)
                throw new HelixArgumentError('helix.audio.zones.set', `${entity.name} não tem zona acústica.`);
            assignSettings(entity.audioZone as unknown as Record<string, unknown>, patch, 'helix.audio.zones.set');
            session.notify();
        },
        get active() {
            return world.activeZone;
        },
        all: () => {
            const result: Entity[] = [];
            scene.traverse((entity) => {
                if (entity.audioZone)
                    result.push(entity);
            });
            return result;
        },
    };
    return {
        mixer,
        sources,
        zones,
        get supported() {
            return engine.supported;
        },
        get status() {
            return engine.status;
        },
        get context() {
            return engine.context;
        },
        get stats() {
            return world.snapshot;
        },
        get voiceCount() {
            return engine.voiceCount;
        },
        get sampleRate() {
            return engine.sampleRate;
        },
        get enabled() {
            return host.switches.audio;
        },
        set enabled(value: boolean) {
            host.switches.audio = Boolean(value);
            if (!value) {
                world.stopAll(0.2, false);
                for (const voice of voices)
                    voice.stop();
                voices.clear();
            }
        },
        unlock: () => engine.unlock(),
        play: (asset: unknown, options?: unknown) => play2d(asset, options, 'helix.audio.play'),
        playOnce: (asset: unknown, options?: unknown) => play2d(asset, { ...(options && typeof options === 'object' ? (options as object) : {}), loop: false }, 'helix.audio.playOnce'),
        loop: (asset: unknown, options?: unknown) => play2d(asset, { ...(options && typeof options === 'object' ? (options as object) : {}), loop: true }, 'helix.audio.loop'),
        stopAll: (fadeSeconds?: unknown) => {
            const fade = fadeSeconds === undefined ? 0.3 : requireNumber(fadeSeconds, 'helix.audio.stopAll', 'o fade');
            world.stopAll(fade, false);
            for (const voice of voices)
                voice.stop(fade);
            voices.clear();
        },
        get activeVoices() {
            return voices.size;
        },
        preload: async (asset: unknown) => {
            const resolved = host.resolveAsset(asset, 'helix.audio.preload', 'audio');
            await engine.load(resolved.id, () => session.library.primaryFile(resolved));
            return resolved;
        },
        clipSettingsOf: (asset: unknown) => clipSettingsOf(host.resolveAsset(asset, 'helix.audio.clipSettingsOf', 'audio')),
        createClipSettings: () => createClipSettings(),
        clips: () => session.library.byKind('audio'),
        busInput: (bus: unknown) => engine.busInput(requireOneOf(bus, CLIP_BUSES, 'helix.audio.busInput', 'o bus')),
        analysis: {
            meter: (bus: unknown) => engine.meter(requireOneOf(bus, BUSES, 'helix.audio.analysis.meter', 'o bus')),
            spectrum: () => {
                throw new HelixNotImplementedError('helix.audio.analysis.spectrum', 'use helix.audio.context para ligar um AnalyserNode em helix.audio.busInput(bus).');
            },
        },
        synth: {
            tone: () => {
                throw new HelixNotImplementedError('helix.audio.synth.tone', 'síntese direta ainda não é exposta; use helix.audio.context (Web Audio) com helix.audio.busInput.');
            },
        },
        export: {
            render: () => {
                throw new HelixNotImplementedError('helix.audio.export.render');
            },
        },
        onEnded: (handler: unknown) => host.bus.on('audio.ended', handler as (payload: unknown) => void, host.current),
        ensure: (what: unknown) => requireString(what, 'helix.audio.ensure'),
    };
}
