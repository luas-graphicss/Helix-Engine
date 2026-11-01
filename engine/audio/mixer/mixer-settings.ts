import { dbToGain } from '@/engine/audio/core/decibels';
export type AudioBusId = 'master' | 'music' | 'sfx' | 'ambience' | 'voice' | 'ui';
export type ClipBusId = Exclude<AudioBusId, 'master'>;
export interface AudioBusInfo {
    readonly id: AudioBusId;
    readonly label: string;
    readonly shortLabel: string;
    readonly description: string;
}
export const AUDIO_BUSES: readonly AudioBusInfo[] = [
    { id: 'music', label: 'Música', shortLabel: 'MUS', description: 'Trilha sonora e temas.' },
    { id: 'sfx', label: 'Efeitos', shortLabel: 'SFX', description: 'Sons de ações, impactos e objetos.' },
    { id: 'ambience', label: 'Ambiente', shortLabel: 'AMB', description: 'Vento, chuva, multidão: o fundo do mundo.' },
    { id: 'voice', label: 'Voz', shortLabel: 'VOZ', description: 'Diálogos e narração.' },
    { id: 'ui', label: 'Interface', shortLabel: 'UI', description: 'Cliques, menus e notificações.' },
    { id: 'master', label: 'Master', shortLabel: 'MST', description: 'Saída final: tudo passa por aqui.' },
];
export const CLIP_BUSES: readonly AudioBusInfo[] = AUDIO_BUSES.filter((bus) => bus.id !== 'master');
export function busInfo(id: AudioBusId): AudioBusInfo {
    const info = AUDIO_BUSES.find((bus) => bus.id === id);
    if (!info)
        throw new Error(`Barramento desconhecido: ${id}.`);
    return info;
}
export interface BusSettings {
    volumeDb: number;
    muted: boolean;
    solo: boolean;
}
export interface MixerSettings {
    readonly buses: Record<AudioBusId, BusSettings>;
}
export const BUS_VOLUME_MIN_DB = -60;
export const BUS_VOLUME_MAX_DB = 6;
function createBus(): BusSettings {
    return { volumeDb: 0, muted: false, solo: false };
}
export function createMixerSettings(): MixerSettings {
    return { buses: { master: createBus(), music: createBus(), sfx: createBus(), ambience: createBus(), voice: createBus(), ui: createBus() } };
}
export function anyBusSoloed(settings: MixerSettings): boolean {
    return CLIP_BUSES.some((bus) => settings.buses[bus.id].solo);
}
export function effectiveBusGain(settings: MixerSettings, id: AudioBusId): number {
    const bus = settings.buses[id];
    if (bus.muted)
        return 0;
    if (id !== 'master' && anyBusSoloed(settings) && !bus.solo)
        return 0;
    return dbToGain(bus.volumeDb);
}
