import type { Entity } from '@/engine/core/scene/entity';
import { createNavAgentSettings, normalizeNavAgentSettings } from '@/engine/navigation/agent/nav-agent-settings';
import { createNavLinkSettings, normalizeNavLinkSettings } from '@/engine/navigation/link/nav-link-settings';
import { createNavModifierSettings, normalizeNavModifierSettings } from '@/engine/navigation/modifier/nav-modifier-settings';
import { createNavObstacleSettings, normalizeNavObstacleSettings } from '@/engine/navigation/obstacle/nav-obstacle-settings';
import { createNavSurfaceSettings, normalizeNavSurfaceSettings } from '@/engine/navigation/surface/nav-surface-settings';
import { assignSettings } from '../runtime/values';
export const NAV_COMPONENT_KINDS = ['navSurface', 'navAgent', 'navObstacle', 'navLink', 'navModifier'] as const;
export type NavComponentKind = (typeof NAV_COMPONENT_KINDS)[number];
function patched<T extends object>(defaults: T, patch: unknown, member: string): T {
    if (patch)
        assignSettings(defaults as unknown as Record<string, unknown>, patch, member);
    return defaults;
}
export function attachNavComponent(entity: Entity, kind: NavComponentKind, patch: unknown, member: string): void {
    switch (kind) {
        case 'navSurface':
            entity.navSurface = normalizeNavSurfaceSettings(patched(createNavSurfaceSettings(), patch, member));
            break;
        case 'navAgent':
            entity.navAgent = normalizeNavAgentSettings(patched(createNavAgentSettings(), patch, member));
            break;
        case 'navObstacle':
            entity.navObstacle = normalizeNavObstacleSettings(patched(createNavObstacleSettings(), patch, member));
            break;
        case 'navLink':
            entity.navLink = normalizeNavLinkSettings(patched(createNavLinkSettings(), patch, member));
            break;
        case 'navModifier':
            entity.navModifier = normalizeNavModifierSettings(patched(createNavModifierSettings(), patch, member));
            break;
    }
}
