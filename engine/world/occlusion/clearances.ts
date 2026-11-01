import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { staticBlock } from '../props/static-block';
const OVERPASS_SPAN = 14;
const OVERPASS_WIDTH = 4;
const OVERPASS_CLEARANCE = 3;
const OVERPASS_DECK = 0.4;
export function createOverpass(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Viaduto', kind: 'group' }, parent);
    vec3.set(group.transform.position, 0, 0, -18);
    staticBlock(scene, group, 'Tabuleiro', [OVERPASS_SPAN, OVERPASS_DECK, OVERPASS_WIDTH], [0, OVERPASS_CLEARANCE + OVERPASS_DECK / 2, 0]);
    const pillarX = OVERPASS_SPAN / 2 - 1.5;
    const pillarZ = OVERPASS_WIDTH / 2 - 0.6;
    let index = 1;
    for (const x of [-pillarX, pillarX]) {
        for (const z of [-pillarZ, pillarZ]) {
            staticBlock(scene, group, `Pilar_${index++}`, [0.6, OVERPASS_CLEARANCE, 0.6], [x, OVERPASS_CLEARANCE / 2, z]);
        }
    }
}
const SLAB_SIZE = 2;
const SLAB_THICKNESS = 0.2;
const POST_SIZE = 0.12;
const SLAB_CLEARANCES = [0.25, 0.5, 1, 2] as const;
const SLAB_SPACING = 3.5;
export function createClearanceSlabs(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Folgas', kind: 'group' }, parent);
    vec3.set(group.transform.position, 17, 0, -7);
    const inset = SLAB_SIZE / 2 - 0.2;
    SLAB_CLEARANCES.forEach((clearance, index) => {
        const z = (index - (SLAB_CLEARANCES.length - 1) / 2) * SLAB_SPACING;
        const label = clearance.toFixed(2).replace('.', '_');
        staticBlock(scene, group, `Laje_${label}m`, [SLAB_SIZE, SLAB_THICKNESS, SLAB_SIZE], [0, clearance + SLAB_THICKNESS / 2, z]);
        let post = 1;
        for (const x of [-inset, inset]) {
            for (const dz of [-inset, inset]) {
                staticBlock(scene, group, `Laje_${label}m_Poste_${post++}`, [POST_SIZE, clearance, POST_SIZE], [x, clearance / 2, z + dz]);
            }
        }
    });
}
