import type { Entity } from '@/engine/core/scene/entity';
export function findVehicleAncestor(entity: Entity): Entity | null {
    let current = entity.parent;
    while (current) {
        if (current.vehicle)
            return current;
        current = current.parent;
    }
    return null;
}
export function collectVehicleWheels(vehicle: Entity, out: Entity[] = []): Entity[] {
    for (const child of vehicle.children) {
        if (child.vehicle)
            continue;
        if (child.wheel)
            out.push(child);
        collectVehicleWheels(child, out);
    }
    return out;
}
