import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { assembleVehicle, vehicleRestHeight } from '@/engine/vehicle/assembly/vehicle-assembly';
import { getVehiclePreset, type VehiclePresetId } from '@/engine/vehicle/vehicle-presets';
import { addEntity, spawnPosition } from './entity-operations';
export function addVehicleActor(session: EditorSession, presetId: VehiclePresetId): Entity {
    const preset = getVehiclePreset(presetId);
    const entity = assembleVehicle(session.scene, preset);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    entity.transform.position[1] += vehicleRestHeight(preset.blueprint);
    return addEntity(session, entity);
}
