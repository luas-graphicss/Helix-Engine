'use client';
import type { ReactNode } from 'react';
import { Atom, Clapperboard, CloudSun, FolderOpen, Gauge, ListTree, Mountain, PersonStanding, SlidersHorizontal, Terminal, type LucideIcon } from 'lucide-react';
import { AnimationPanel } from '@/engine/editor/panels/animation-panel';
import { HierarchyPanel } from '@/engine/editor/panels/hierarchy-panel';
import { InspectorPanel } from '@/engine/editor/panels/inspector-panel';
import { TerrainPanel } from '@/engine/editor/panels/terrain-panel';
import { CharacterPanel } from '@/engine/editor/panels/character-panel';
import { EnvironmentPanel } from '@/engine/editor/panels/environment-panel';
import { PhysicsPanel } from '@/engine/editor/panels/physics-panel';
import { PerformancePanel } from '@/engine/editor/panels/performance-panel';
import { AssetsPanel } from '@/engine/editor/panels/assets-panel';
import { ConsolePanel } from '@/engine/editor/panels/console-panel';
import type { DockPanelId } from './dock-layout';
export interface DockPanelDefinition {
    readonly id: DockPanelId;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly shortcut?: string;
    readonly inToolbar?: boolean;
    readonly render: () => ReactNode;
}
export const DOCK_PANELS: Record<DockPanelId, DockPanelDefinition> = {
    hierarchy: { id: 'hierarchy', label: 'Hierarquia', icon: ListTree, shortcut: 'Ctrl+Shift+E', inToolbar: true, render: () => <HierarchyPanel /> },
    inspector: { id: 'inspector', label: 'Inspetor', icon: SlidersHorizontal, inToolbar: true, render: () => <InspectorPanel /> },
    terrain: { id: 'terrain', label: 'Terreno', icon: Mountain, render: () => <TerrainPanel /> },
    character: { id: 'character', label: 'Personagem', icon: PersonStanding, render: () => <CharacterPanel /> },
    environment: { id: 'environment', label: 'Ambiente', icon: CloudSun, render: () => <EnvironmentPanel /> },
    physics: { id: 'physics', label: 'Física', icon: Atom, render: () => <PhysicsPanel /> },
    performance: { id: 'performance', label: 'Desempenho', icon: Gauge, render: () => <PerformancePanel /> },
    assets: { id: 'assets', label: 'Ativos', icon: FolderOpen, shortcut: 'Ctrl+Shift+A', inToolbar: true, render: () => <AssetsPanel /> },
    animation: { id: 'animation', label: 'Animação', icon: Clapperboard, shortcut: 'Ctrl+Shift+T', inToolbar: true, render: () => <AnimationPanel /> },
    console: { id: 'console', label: 'Console', icon: Terminal, shortcut: 'Ctrl+`', inToolbar: true, render: () => <ConsolePanel /> },
};
export const TOOLBAR_PANELS: readonly DockPanelDefinition[] = Object.values(DOCK_PANELS).filter((panel) => panel.inToolbar);
