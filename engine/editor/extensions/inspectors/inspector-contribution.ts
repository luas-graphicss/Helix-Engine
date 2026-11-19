import type { GuiSurface } from '../gui/gui-surface';
import type { Contribution } from '../registry/contribution-registry';
import type { EntityFilter } from '../targeting/entity-filter';
export interface InspectorContribution extends Contribution, EntityFilter {
    readonly title: string;
    readonly order: number;
    readonly defaultOpen: boolean;
    readonly multiple: boolean;
    readonly surface: GuiSurface;
}
