import type { InputActionMap } from '../actions/input-asset';
import type { InputDevice } from '../devices/input-device';
import { BindingOverrides } from '../rebinding/binding-overrides';
import { ActionState, type ActionListener } from './action-state';
import { resolveBinding } from './resolved-binding';
export interface ActionSource {
    readonly devices: readonly InputDevice[];
    readonly scheme: string | null;
    readonly version: number;
}
const UNRESOLVED = -1;
const PATH_SEPARATOR = '/';
export class ActionSet {
    readonly overrides = new BindingOverrides();
    private maps: readonly InputActionMap[] = [];
    private readonly states = new Map<string, ActionState>();
    private readonly paths = new Map<string, ActionState>();
    private readonly disabledMaps = new Set<string>();
    private sourceVersion = UNRESOLVED;
    private overridesVersion = UNRESOLVED;
    private frame = 0;
    constructor(maps: readonly InputActionMap[], private readonly source: ActionSource, private readonly player: number | null, private readonly announce: ActionListener) {
        this.setMaps(maps);
    }
    get actionMaps(): readonly InputActionMap[] {
        return this.maps;
    }
    get all(): ActionState[] {
        return Array.from(this.states.values());
    }
    setMaps(maps: readonly InputActionMap[]): void {
        if (maps === this.maps)
            return;
        this.maps = maps;
        this.paths.clear();
        const stale = new Set(this.states.keys());
        for (const map of maps)
            for (const action of map.actions) {
                stale.delete(action.id);
                const state = this.states.get(action.id) ?? new ActionState(map, action, this.player, this.announce);
                state.redefine(map, action);
                this.states.set(action.id, state);
                this.paths.set(state.path, state);
            }
        for (const id of stale)
            this.states.delete(id);
        this.sourceVersion = UNRESOLVED;
    }
    isEnabled(mapId: string): boolean {
        return !this.disabledMaps.has(mapId);
    }
    enable(mapId: string): void {
        this.disabledMaps.delete(mapId);
    }
    disable(mapId: string): void {
        if (this.disabledMaps.has(mapId))
            return;
        this.disabledMaps.add(mapId);
        for (const state of this.states.values())
            if (state.map.id === mapId)
                state.release(this.frame);
    }
    enableOnly(mapId: string): void {
        for (const map of this.maps)
            if (map.id !== mapId)
                this.disable(map.id);
        this.enable(mapId);
    }
    find(path: string): ActionState | null {
        const exact = this.paths.get(path);
        if (exact || path.includes(PATH_SEPARATOR))
            return exact ?? null;
        let match: ActionState | null = null;
        for (const state of this.states.values()) {
            if (state.action.name !== path)
                continue;
            if (match)
                return null;
            match = state;
        }
        return match;
    }
    byId(actionId: string): ActionState | null {
        return this.states.get(actionId) ?? null;
    }
    inMap(mapId: string): ActionState[] {
        return this.all.filter((state) => state.map.id === mapId);
    }
    update(delta: number, frame: number): void {
        this.frame = frame;
        if (this.source.version !== this.sourceVersion || this.overrides.version !== this.overridesVersion)
            this.resolve();
        for (const state of this.states.values())
            if (!this.disabledMaps.has(state.map.id))
                state.update(delta, frame);
    }
    private resolve(): void {
        const { devices, scheme, version } = this.source;
        this.sourceVersion = version;
        this.overridesVersion = this.overrides.version;
        for (const state of this.states.values()) {
            const active = state.action.bindings.filter((binding) => scheme === null || binding.schemes.length === 0 || binding.schemes.includes(scheme));
            state.bind(active.map((binding) => resolveBinding(binding, devices, this.overrides)));
        }
    }
}
