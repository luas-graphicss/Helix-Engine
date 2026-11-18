'use client';
import type { ReactNode } from 'react';
import { Aperture, Atom, AudioLines, Blocks, BotMessageSquare, Clapperboard, CloudSun, FileClock, FileCode2, FolderOpen, Gauge, LayoutPanelTop, Lightbulb, ListTree, Mountain, PersonStanding, SlidersHorizontal, Sparkles, Terminal, type LucideIcon, } from 'lucide-react';
import { AnimationPanel } from '@/engine/editor/panels/animation-panel';
import { AudioPanel } from '@/engine/editor/panels/audio-panel';
import { VfxPanel } from '@/engine/editor/panels/vfx-panel';
import { LightsPanel } from '@/engine/editor/panels/lights-panel';
import { TerrainPanel } from '@/engine/editor/panels/terrain-panel';
import { CharacterPanel } from '@/engine/editor/panels/character-panel';
import { EnvironmentPanel } from '@/engine/editor/panels/environment-panel';
import { PostProcessPanel } from '@/engine/editor/panels/postprocess-panel';
import { PhysicsPanel } from '@/engine/editor/panels/physics-panel';
import { PerformancePanel } from '@/engine/editor/panels/performance-panel';
import { AssetsPanel } from '@/engine/editor/panels/assets-panel';
import { ConsolePanel } from '@/engine/editor/panels/console-panel';
import { ActivityPanel } from '@/engine/editor/panels/activity-panel';
import { AssistantPanel } from '@/engine/editor/panels/assistant-panel';
import { InterfacePanel } from '@/engine/editor/panels/interface-panel';
import { ScriptsPanel } from '@/engine/editor/panels/scripts-panel';
import { ExtensionsPanel } from '@/engine/editor/extensions/ui/extensions-panel';
import type { EditorWorkspace } from '@/engine/editor/session/editor-session';
import type { ShortcutActionId } from '@/engine/editor/shortcuts/shortcut-actions';
import type { DockPanelId } from './dock-layout';
import { WorkspaceHierarchyPanel, WorkspaceInspectorPanel } from './workspace-panels';
export interface DockPanelDefinition {
    readonly id: DockPanelId;
    readonly label: string;
    readonly guiLabel?: string;
    readonly icon: LucideIcon;
    readonly shortcut?: ShortcutActionId;
    readonly inToolbar?: boolean;
    readonly render: () => ReactNode;
}
export const DOCK_PANELS: Record<DockPanelId, DockPanelDefinition> = {
    hierarchy: { id: 'hierarchy', label: 'Hierarquia', guiLabel: 'Camadas', icon: ListTree, shortcut: 'panel.hierarchy', inToolbar: true, render: () => <WorkspaceHierarchyPanel /> },
    inspector: { id: 'inspector', label: 'Inspetor', icon: SlidersHorizontal, inToolbar: true, render: () => <WorkspaceInspectorPanel /> },
    lights: { id: 'lights', label: 'Luzes', icon: Lightbulb, shortcut: 'panel.lights', inToolbar: true, render: () => <LightsPanel /> },
    terrain: { id: 'terrain', label: 'Terreno', icon: Mountain, render: () => <TerrainPanel /> },
    character: { id: 'character', label: 'Personagem', icon: PersonStanding, render: () => <CharacterPanel /> },
    environment: { id: 'environment', label: 'Ambiente', icon: CloudSun, render: () => <EnvironmentPanel /> },
    postprocess: { id: 'postprocess', label: 'Pós-processo', icon: Aperture, render: () => <PostProcessPanel /> },
    physics: { id: 'physics', label: 'Física', icon: Atom, render: () => <PhysicsPanel /> },
    performance: { id: 'performance', label: 'Desempenho', icon: Gauge, render: () => <PerformancePanel /> },
    assets: { id: 'assets', label: 'Ativos', icon: FolderOpen, shortcut: 'panel.assets', inToolbar: true, render: () => <AssetsPanel /> },
    animation: { id: 'animation', label: 'Animação', icon: Clapperboard, shortcut: 'panel.animation', inToolbar: true, render: () => <AnimationPanel /> },
    audio: { id: 'audio', label: 'Áudio', icon: AudioLines, shortcut: 'panel.audio', inToolbar: true, render: () => <AudioPanel /> },
    vfx: { id: 'vfx', label: 'Efeitos', icon: Sparkles, shortcut: 'panel.vfx', inToolbar: true, render: () => <VfxPanel /> },
    interface: { id: 'interface', label: 'Interface', icon: LayoutPanelTop, shortcut: 'panel.interface', inToolbar: true, render: () => <InterfacePanel /> },
    scripts: { id: 'scripts', label: 'Scripts', icon: FileCode2, shortcut: 'panel.scripts', inToolbar: true, render: () => <ScriptsPanel /> },
    console: { id: 'console', label: 'Console', icon: Terminal, shortcut: 'panel.console', inToolbar: true, render: () => <ConsolePanel /> },
    activity: { id: 'activity', label: 'Histórico de atividade', icon: FileClock, render: () => <ActivityPanel /> },
    assistant: { id: 'assistant', label: 'Assistente de IA', icon: BotMessageSquare, inToolbar: true, render: () => <AssistantPanel /> },
    extensions: { id: 'extensions', label: 'Extensões', icon: Blocks, render: () => <ExtensionsPanel /> },
};
export const TOOLBAR_PANELS: readonly DockPanelDefinition[] = Object.values(DOCK_PANELS).filter((panel) => panel.inToolbar);
export function panelLabel(id: DockPanelId, workspace: EditorWorkspace): string {
    const panel = DOCK_PANELS[id];
    return workspace === 'gui' ? (panel.guiLabel ?? panel.label) : panel.label;
}
