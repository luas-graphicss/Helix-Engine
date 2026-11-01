'use client';
import { createContext, useContext } from 'react';
import type { LayerDropTarget, LayerRow } from './gui-layer-model';
export interface GuiLayersContextValue {
    readonly query: string;
    readonly rows: readonly LayerRow[];
    readonly renamingId: string | null;
    readonly setRenamingId: (id: string | null) => void;
    readonly anchorId: string | null;
    readonly setAnchorId: (id: string | null) => void;
    readonly dropTarget: LayerDropTarget | null;
    readonly setDropTarget: (target: LayerDropTarget | null) => void;
    readonly dragged: readonly string[];
    readonly setDragged: (ids: readonly string[]) => void;
    readonly isExpanded: (id: string) => boolean;
    readonly setExpanded: (id: string, open: boolean) => void;
    readonly toggleExpanded: (id: string) => void;
}
export const GuiLayersContext = createContext<GuiLayersContextValue | null>(null);
export function useGuiLayers(): GuiLayersContextValue {
    const value = useContext(GuiLayersContext);
    if (!value)
        throw new Error('useGuiLayers deve ser usado dentro do painel de camadas.');
    return value;
}
