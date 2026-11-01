import { useSyncExternalStore } from 'react';
import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import { chordFromEvent, formatChord, parseChord, serializeChord } from './key-chord';
import { isShortcutActionId, SHORTCUT_ACTIONS, shortcutAction, type ShortcutActionId, type ShortcutScope } from './shortcut-actions';
const PREFERENCE_KEY = 'shortcut-bindings';
type Overrides = Partial<Record<ShortcutActionId, readonly string[]>>;
export interface ShortcutConflict {
    readonly chord: string;
    readonly actions: readonly ShortcutActionId[];
}
function sameChords(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((chord, index) => chord === b[index]);
}
function normalizeChords(chords: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const text of chords) {
        const chord = parseChord(text);
        if (chord)
            seen.add(serializeChord(chord));
    }
    return Array.from(seen);
}
class ShortcutBindingsStore {
    private overrides: Overrides = {};
    private version = 0;
    private loaded = false;
    private readonly listeners = new Set<() => void>();
    private index: Map<ShortcutScope, Map<string, ShortcutActionId>> | null = null;
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
        for (const [id, chords] of Object.entries(stored)) {
            if (!isShortcutActionId(id) || !Array.isArray(chords))
                continue;
            const normalized = normalizeChords(chords.filter((chord): chord is string => typeof chord === 'string'));
            if (!sameChords(normalized, shortcutAction(id).defaults))
                overrides[id] = normalized;
        }
        this.overrides = overrides;
        this.invalidate();
    }
    chordsFor(id: ShortcutActionId): readonly string[] {
        return this.overrides[id] ?? shortcutAction(id).defaults;
    }
    isCustomized(id: ShortcutActionId): boolean {
        return this.overrides[id] !== undefined;
    }
    get customizedCount(): number {
        return Object.keys(this.overrides).length;
    }
    set(id: ShortcutActionId, chords: readonly string[]): void {
        const normalized = normalizeChords(chords);
        if (sameChords(normalized, shortcutAction(id).defaults))
            delete this.overrides[id];
        else
            this.overrides[id] = normalized;
        this.invalidate();
        this.persist();
    }
    addChord(id: ShortcutActionId, chord: string): void {
        this.set(id, [...this.chordsFor(id), chord]);
    }
    removeChord(id: ShortcutActionId, chord: string): void {
        this.set(id, this.chordsFor(id).filter((existing) => existing !== chord));
    }
    reset(id: ShortcutActionId): void {
        if (this.overrides[id] === undefined)
            return;
        delete this.overrides[id];
        this.invalidate();
        this.persist();
    }
    resetAll(): void {
        if (this.customizedCount === 0)
            return;
        this.overrides = {};
        this.invalidate();
        this.persist();
    }
    resolve(event: KeyboardEvent, scope: ShortcutScope): ShortcutActionId | null {
        return this.indexFor(scope).get(serializeChord(chordFromEvent(event))) ?? null;
    }
    ownersOf(chord: string, scope: ShortcutScope, except?: ShortcutActionId): ShortcutActionId[] {
        const owners: ShortcutActionId[] = [];
        for (const entry of SHORTCUT_ACTIONS) {
            if (entry.scope !== scope || entry.id === except)
                continue;
            if (this.chordsFor(entry.id as ShortcutActionId).includes(chord))
                owners.push(entry.id as ShortcutActionId);
        }
        return owners;
    }
    conflicts(): ShortcutConflict[] {
        const byScope = new Map<string, ShortcutActionId[]>();
        for (const entry of SHORTCUT_ACTIONS) {
            const id = entry.id as ShortcutActionId;
            for (const chord of this.chordsFor(id)) {
                const key = `${entry.scope}\u0000${chord}`;
                const list = byScope.get(key);
                if (list)
                    list.push(id);
                else
                    byScope.set(key, [id]);
            }
        }
        const conflicts: ShortcutConflict[] = [];
        for (const [key, actions] of byScope) {
            if (actions.length > 1)
                conflicts.push({ chord: key.slice(key.indexOf('\u0000') + 1), actions });
        }
        return conflicts;
    }
    private indexFor(scope: ShortcutScope): Map<string, ShortcutActionId> {
        if (!this.index)
            this.index = new Map();
        let map = this.index.get(scope);
        if (map)
            return map;
        map = new Map();
        for (const entry of SHORTCUT_ACTIONS) {
            if (entry.scope !== scope)
                continue;
            const id = entry.id as ShortcutActionId;
            for (const chord of this.chordsFor(id))
                if (!map.has(chord))
                    map.set(chord, id);
        }
        this.index.set(scope, map);
        return map;
    }
    private invalidate(): void {
        this.index = null;
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    private persist(): void {
        void writePreference(PREFERENCE_KEY, this.overrides);
    }
}
export const shortcutBindings = new ShortcutBindingsStore();
export function useShortcutBindingsVersion(): number {
    return useSyncExternalStore(shortcutBindings.subscribe, shortcutBindings.getVersion, shortcutBindings.getVersion);
}
export function useShortcutChords(id: ShortcutActionId): readonly string[] {
    useShortcutBindingsVersion();
    return shortcutBindings.chordsFor(id);
}
export function useShortcutLabel(id: ShortcutActionId): string | null {
    const chords = useShortcutChords(id);
    return chords.length > 0 ? formatChord(chords[0]) : null;
}
export function useShortcutLabelFor(): (id: ShortcutActionId) => string | null {
    useShortcutBindingsVersion();
    return (id) => {
        const chords = shortcutBindings.chordsFor(id);
        return chords.length > 0 ? formatChord(chords[0]) : null;
    };
}
export function useShortcutHint(): (text: string, id: ShortcutActionId) => string {
    const labelFor = useShortcutLabelFor();
    return (text, id) => {
        const label = labelFor(id);
        return label ? `${text} (${label})` : text;
    };
}
