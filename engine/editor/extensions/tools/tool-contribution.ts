import type { GizmoPainter } from '../gizmos/gizmo-painter';
import type { GuiSurface } from '../gui/gui-surface';
import type { Contribution } from '../registry/contribution-registry';
export type ToolPointerPhase = 'down' | 'move' | 'up';
export interface ToolPointer {
    readonly x: number;
    readonly y: number;
    readonly u: number;
    readonly v: number;
    readonly button: number;
    readonly ctrl: boolean;
    readonly shift: boolean;
    readonly alt: boolean;
}
export interface ToolContribution extends Contribution {
    readonly title: string;
    readonly icon: string | null;
    readonly shortcut: string | null;
    readonly cursor: string | null;
    readonly isAction: boolean;
    readonly handlesPointer: boolean;
    readonly surface: GuiSurface | null;
    run(): void;
    activate(): void;
    deactivate(): void;
    pointer(phase: ToolPointerPhase, pointer: ToolPointer): void;
    paint(painter: GizmoPainter): void;
}
