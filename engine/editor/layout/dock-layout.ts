import { readPreference, writePreference } from '@/engine/core/storage/preferences';
export type DockArea = 'left' | 'right' | 'bottom';
export type DockPanelId = 'hierarchy' | 'inspector' | 'terrain' | 'character' | 'environment' | 'physics' | 'performance' | 'assets' | 'animation' | 'console';
export const DOCK_AREAS: readonly DockArea[] = ['left', 'right', 'bottom'];
export const DOCK_PANEL_IDS: readonly DockPanelId[] = ['hierarchy', 'inspector', 'terrain', 'character', 'environment', 'physics', 'performance', 'assets', 'animation', 'console'];
export const DOCK_AREA_LABELS: Record<DockArea, string> = { left: 'Esquerda', right: 'Direita', bottom: 'Inferior' };
export interface DockAreaLimits {
    readonly initial: number;
    readonly min: number;
    readonly max: number;
}
export const DOCK_AREA_LIMITS: Record<DockArea, DockAreaLimits> = {
    left: { initial: 260, min: 200, max: 480 },
    right: { initial: 320, min: 240, max: 560 },
    bottom: { initial: 240, min: 120, max: 520 },
};
export interface DockAreaState {
    readonly panels: readonly DockPanelId[];
    readonly active: DockPanelId | null;
    readonly size: number;
}
export interface DockLayoutState {
    readonly areas: Readonly<Record<DockArea, DockAreaState>>;
    readonly maximized: boolean;
    readonly dragging: DockPanelId | null;
}
export const DEFAULT_PANEL_AREA: Record<DockPanelId, DockArea> = {
    hierarchy: 'left',
    inspector: 'right',
    terrain: 'right',
    character: 'right',
    environment: 'right',
    physics: 'right',
    performance: 'right',
    assets: 'bottom',
    animation: 'bottom',
    console: 'bottom',
};
const PREFERENCE_KEY = 'dock-layout';
const PERSIST_VERSION = 1;
const PERSIST_DELAY_MS = 400;
interface PersistedLayout {
    version: number;
    areas: Record<DockArea, {
        panels: DockPanelId[];
        active: DockPanelId | null;
        size: number;
    }>;
    lastArea: Partial<Record<DockPanelId, DockArea>>;
}
function defaultAreas(): Record<DockArea, DockAreaState> {
    const areas: Record<DockArea, {
        panels: DockPanelId[];
        active: DockPanelId | null;
        size: number;
    }> = {
        left: { panels: [], active: null, size: DOCK_AREA_LIMITS.left.initial },
        right: { panels: [], active: null, size: DOCK_AREA_LIMITS.right.initial },
        bottom: { panels: [], active: null, size: DOCK_AREA_LIMITS.bottom.initial },
    };
    for (const id of DOCK_PANEL_IDS)
        areas[DEFAULT_PANEL_AREA[id]].panels.push(id);
    for (const area of DOCK_AREAS)
        areas[area].active = areas[area].panels[0] ?? null;
    return areas;
}
function clampSize(area: DockArea, size: number): number {
    const limits = DOCK_AREA_LIMITS[area];
    if (!Number.isFinite(size))
        return limits.initial;
    return Math.min(limits.max, Math.max(limits.min, Math.round(size)));
}
function isPanelId(value: unknown): value is DockPanelId {
    return typeof value === 'string' && (DOCK_PANEL_IDS as readonly string[]).includes(value);
}
function isArea(value: unknown): value is DockArea {
    return typeof value === 'string' && (DOCK_AREAS as readonly string[]).includes(value);
}
function sanitize(persisted: unknown): Pick<PersistedLayout, 'areas' | 'lastArea'> | null {
    if (!persisted || typeof persisted !== 'object')
        return null;
    const record = persisted as Partial<PersistedLayout>;
    if (record.version !== PERSIST_VERSION || !record.areas)
        return null;
    const seen = new Set<DockPanelId>();
    const areas = {} as PersistedLayout['areas'];
    for (const area of DOCK_AREAS) {
        const source = record.areas[area];
        const panels = Array.isArray(source?.panels) ? source.panels.filter(isPanelId).filter((id) => !seen.has(id) && (seen.add(id), true)) : [];
        const active = isPanelId(source?.active) && panels.includes(source.active) ? source.active : (panels[0] ?? null);
        areas[area] = { panels, active, size: clampSize(area, Number(source?.size)) };
    }
    const lastArea: PersistedLayout['lastArea'] = {};
    if (record.lastArea && typeof record.lastArea === 'object') {
        for (const [id, area] of Object.entries(record.lastArea))
            if (isPanelId(id) && isArea(area))
                lastArea[id] = area;
    }
    return { areas, lastArea };
}
export class DockLayoutStore {
    private state: DockLayoutState = { areas: defaultAreas(), maximized: false, dragging: null };
    private savedAreas: Readonly<Record<DockArea, DockAreaState>> | null = null;
    private lastArea: Partial<Record<DockPanelId, DockArea>> = {};
    private readonly listeners = new Set<() => void>();
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private loaded = false;
    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): DockLayoutState => this.state;
    async load(): Promise<void> {
        if (this.loaded)
            return;
        this.loaded = true;
        const restored = sanitize(await readPreference<PersistedLayout>(PREFERENCE_KEY));
        if (!restored)
            return;
        this.lastArea = restored.lastArea;
        this.commit({ ...this.state, areas: restored.areas }, false);
    }
    area(id: DockPanelId): DockArea | null {
        for (const area of DOCK_AREAS)
            if (this.state.areas[area].panels.includes(id))
                return area;
        return null;
    }
    isOpen(id: DockPanelId): boolean {
        return !this.state.maximized && this.area(id) !== null;
    }
    closedPanels(): DockPanelId[] {
        return DOCK_PANEL_IDS.filter((id) => this.area(id) === null);
    }
    open(id: DockPanelId, area: DockArea = this.lastArea[id] ?? DEFAULT_PANEL_AREA[id]): void {
        if (this.state.maximized)
            this.restorePanels();
        const current = this.area(id);
        if (current) {
            this.setActive(current, id);
            return;
        }
        const target = this.state.areas[area];
        this.updateArea(area, { panels: [...target.panels, id], active: id });
    }
    close(id: DockPanelId): void {
        const area = this.area(id);
        if (!area)
            return;
        this.lastArea[id] = area;
        const current = this.state.areas[area];
        const panels = current.panels.filter((panel) => panel !== id);
        const index = current.panels.indexOf(id);
        const active = current.active === id ? (panels[Math.min(index, panels.length - 1)] ?? null) : current.active;
        this.updateArea(area, { panels, active });
    }
    toggle(id: DockPanelId): void {
        if (this.isOpen(id))
            this.close(id);
        else
            this.open(id);
    }
    reveal(id: DockPanelId): void {
        this.open(id);
    }
    setActive(area: DockArea, id: DockPanelId): void {
        const current = this.state.areas[area];
        if (!current.panels.includes(id) || current.active === id)
            return;
        this.updateArea(area, { active: id });
    }
    setSize(area: DockArea, size: number): void {
        const clamped = clampSize(area, size);
        if (clamped === this.state.areas[area].size)
            return;
        this.updateArea(area, { size: clamped });
    }
    closeArea(area: DockArea): void {
        for (const id of this.state.areas[area].panels)
            this.lastArea[id] = area;
        this.updateArea(area, { panels: [], active: null });
    }
    move(id: DockPanelId, area: DockArea, index?: number): void {
        const from = this.area(id);
        const areas = { ...this.state.areas };
        if (from) {
            const source = areas[from];
            const panels = source.panels.filter((panel) => panel !== id);
            areas[from] = { ...source, panels, active: source.active === id ? (panels[0] ?? null) : source.active };
        }
        const target = areas[area];
        const panels = [...target.panels];
        const at = index === undefined ? panels.length : Math.max(0, Math.min(panels.length, index));
        panels.splice(at, 0, id);
        areas[area] = { ...target, panels, active: id };
        this.lastArea[id] = area;
        this.commit({ ...this.state, areas, maximized: false });
    }
    maximizeViewport(): void {
        if (this.state.maximized)
            return;
        this.savedAreas = this.state.areas;
        const areas = { ...this.state.areas };
        for (const area of DOCK_AREAS)
            areas[area] = { ...areas[area], panels: [], active: null };
        this.commit({ ...this.state, areas, maximized: true }, false);
    }
    restorePanels(): void {
        if (!this.state.maximized)
            return;
        const areas = this.savedAreas ?? defaultAreas();
        this.savedAreas = null;
        this.commit({ ...this.state, areas, maximized: false }, false);
    }
    toggleMaximized(): void {
        if (this.state.maximized)
            this.restorePanels();
        else
            this.maximizeViewport();
    }
    reset(): void {
        this.savedAreas = null;
        this.lastArea = {};
        this.commit({ ...this.state, areas: defaultAreas(), maximized: false });
    }
    setDragging(id: DockPanelId | null): void {
        if (this.state.dragging === id)
            return;
        this.commit({ ...this.state, dragging: id }, false);
    }
    private updateArea(area: DockArea, patch: Partial<DockAreaState>): void {
        this.commit({ ...this.state, areas: { ...this.state.areas, [area]: { ...this.state.areas[area], ...patch } } });
    }
    private commit(next: DockLayoutState, persist = true): void {
        this.state = next;
        for (const listener of this.listeners)
            listener();
        if (persist)
            this.schedulePersist();
    }
    private schedulePersist(): void {
        if (this.persistTimer)
            clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            const areas = this.state.maximized && this.savedAreas ? this.savedAreas : this.state.areas;
            const payload: PersistedLayout = {
                version: PERSIST_VERSION,
                areas: {
                    left: { panels: [...areas.left.panels], active: areas.left.active, size: areas.left.size },
                    right: { panels: [...areas.right.panels], active: areas.right.active, size: areas.right.size },
                    bottom: { panels: [...areas.bottom.panels], active: areas.bottom.active, size: areas.bottom.size },
                },
                lastArea: { ...this.lastArea },
            };
            void writePreference(PREFERENCE_KEY, payload);
        }, PERSIST_DELAY_MS);
    }
}
