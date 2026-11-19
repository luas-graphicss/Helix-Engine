import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { Command } from '@/engine/editor/history/command';
export type NavComponentKey = 'navSurface' | 'navAgent' | 'navObstacle' | 'navLink' | 'navModifier';
export function navComponentCommand<K extends NavComponentKey>(entity: Entity, key: K, label: string, next: Entity[K], mergeKey?: string): Command {
    return new SetValueCommand<Entity[K]>(label, (value) => {
        entity[key] = value;
    }, entity[key], next, mergeKey);
}
export function withAxis(vector: Vec3, axis: number, value: number): Vec3 {
    const next = vec3.copy(vec3.create(), vector);
    next[axis] = value;
    return next;
}
export function canHostNavigation(entity: Entity): boolean {
    return (entity.kind === 'mesh' || entity.kind === 'group') && !entity.csgBrush && !entity.wheel;
}
