import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import type { Contribution } from '../registry/contribution-registry';
import { menuLabelKey } from './menu-path';
export const MENU_LOCATIONS = ['main', 'actor', 'asset'] as const;
export type MenuLocation = (typeof MENU_LOCATIONS)[number];
export interface MenuTarget {
    readonly actors: readonly Entity[];
    readonly asset: LibraryAsset | null;
}
export interface MenuContribution extends Contribution {
    readonly location: MenuLocation;
    readonly path: readonly string[];
    readonly icon: string | null;
    readonly order: number;
    readonly shortcut: string | null;
    readonly separatorBefore: boolean;
    readonly checkable: boolean;
    run(target: MenuTarget): void;
    isEnabled(target: MenuTarget): boolean;
    isChecked(target: MenuTarget): boolean;
}
export function menuContributionId(location: MenuLocation, path: readonly string[]): string {
    return `${location}:${path.map(menuLabelKey).join('/')}`;
}
