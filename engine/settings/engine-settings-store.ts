import { useSyncExternalStore } from 'react';
import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import { ENGINE_SETTINGS, ENGINE_SETTING_SECTIONS, SETTING_IDS, type SettingId, type SettingValue } from './engine-settings-schema';
import { coerceSettingValue } from './setting-definitions';
const PREFERENCE_KEY = 'engine-settings';
const PERSIST_DELAY_MS = 400;
type Overrides = Partial<Record<SettingId, boolean | number | string>>;
function isSettingId(value: string): value is SettingId {
    return value in ENGINE_SETTINGS;
}
class EngineSettingsStore {
    private overrides: Overrides = {};
    private version = 0;
    private loaded = false;
    private persistEnabled = true;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly listeners = new Set<() => void>();
    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    async load(): Promise<void> {
        if (this.loaded)
            return;
        this.loaded = true;
        const stored = await readPreference<Record<string, unknown>>(PREFERENCE_KEY);
        if (!stored || typeof stored !== 'object')
            return;
        const overrides: Overrides = {};
        for (const [id, raw] of Object.entries(stored)) {
            if (!isSettingId(id))
                continue;
            const value = coerceSettingValue(ENGINE_SETTINGS[id], raw);
            if (value !== undefined && value !== ENGINE_SETTINGS[id].default)
                overrides[id] = value;
        }
        this.overrides = overrides;
        this.notify();
    }
    adopt(values: Readonly<Record<string, unknown>>): void {
        this.loaded = true;
        const overrides: Overrides = {};
        for (const [id, raw] of Object.entries(values)) {
            if (!isSettingId(id))
                continue;
            const value = coerceSettingValue(ENGINE_SETTINGS[id], raw);
            if (value !== undefined && value !== ENGINE_SETTINGS[id].default)
                overrides[id] = value;
        }
        this.overrides = overrides;
        this.persistEnabled = false;
        this.notify();
    }
    snapshot(ids: readonly SettingId[]): Record<string, boolean | number | string> {
        const result: Record<string, boolean | number | string> = {};
        for (const id of ids) {
            const value = this.overrides[id];
            if (value !== undefined)
                result[id] = value;
        }
        return result;
    }
    get<K extends SettingId>(id: K): SettingValue<K> {
        return (this.overrides[id] ?? ENGINE_SETTINGS[id].default) as SettingValue<K>;
    }
    set<K extends SettingId>(id: K, value: SettingValue<K>): void {
        const coerced = coerceSettingValue(ENGINE_SETTINGS[id], value);
        if (coerced === undefined)
            return;
        const current = this.get(id);
        if (coerced === current)
            return;
        if (coerced === ENGINE_SETTINGS[id].default)
            delete this.overrides[id];
        else
            this.overrides[id] = coerced;
        this.notify();
        this.schedulePersist();
    }
    isDefault(id: SettingId): boolean {
        return this.overrides[id] === undefined;
    }
    get customizedCount(): number {
        return Object.keys(this.overrides).length;
    }
    reset(id: SettingId): void {
        if (this.overrides[id] === undefined)
            return;
        delete this.overrides[id];
        this.notify();
        this.schedulePersist();
    }
    resetSection(sectionId: string): void {
        const section = ENGINE_SETTING_SECTIONS.find((candidate) => candidate.id === sectionId);
        if (!section)
            return;
        let changed = false;
        for (const group of section.groups) {
            for (const id of group.settings) {
                if (this.overrides[id] === undefined)
                    continue;
                delete this.overrides[id];
                changed = true;
            }
        }
        if (!changed)
            return;
        this.notify();
        this.schedulePersist();
    }
    resetAll(): void {
        if (this.customizedCount === 0)
            return;
        this.overrides = {};
        this.notify();
        this.schedulePersist();
    }
    flush(): void {
        if (!this.persistTimer)
            return;
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
        void writePreference(PREFERENCE_KEY, this.overrides);
    }
    private schedulePersist(): void {
        if (!this.persistEnabled)
            return;
        if (this.persistTimer)
            clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            void writePreference(PREFERENCE_KEY, this.overrides);
        }, PERSIST_DELAY_MS);
    }
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
export const engineSettings = new EngineSettingsStore();
export function useEngineSettingsVersion(): number {
    return useSyncExternalStore(engineSettings.subscribe, engineSettings.getVersion, engineSettings.getVersion);
}
export function useEngineSetting<K extends SettingId>(id: K): SettingValue<K> {
    useEngineSettingsVersion();
    return engineSettings.get(id);
}
export function customizedCountInSection(sectionId: string): number {
    const section = ENGINE_SETTING_SECTIONS.find((candidate) => candidate.id === sectionId);
    if (!section)
        return 0;
    let count = 0;
    for (const group of section.groups)
        for (const id of group.settings)
            if (!engineSettings.isDefault(id))
                count++;
    return count;
}
if (process.env.NODE_ENV !== 'production') {
    const placed = new Set(ENGINE_SETTING_SECTIONS.flatMap((section) => section.groups.flatMap((group) => group.settings)));
    for (const id of SETTING_IDS)
        if (!placed.has(id))
            console.warn(`[Helix] A preferência ${id} não aparece em nenhuma seção do painel.`);
}
