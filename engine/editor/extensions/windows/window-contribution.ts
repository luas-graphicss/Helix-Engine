import type { DockArea } from '@/engine/editor/layout/dock-layout';
import type { GuiSurface } from '../gui/gui-surface';
import type { Contribution } from '../registry/contribution-registry';
export interface WindowContribution extends Contribution {
    readonly title: string;
    readonly icon: string | null;
    readonly area: DockArea;
    readonly surface: GuiSurface;
}
