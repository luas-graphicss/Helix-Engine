import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { accent, concrete, plaster } from '../props/prop-materials';
import { staticBlock } from '../props/static-block';
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.3;
const ROOF_THICKNESS = 0.3;
const ROOM_SIZE = 6;
interface Opening {
    offset: number;
    bottom: number;
    width: number;
    height: number;
}
interface WallSpec {
    axis: 'x' | 'z';
    across: number;
    length: number;
    height: number;
    thickness: number;
    opening?: Opening;
}
function createWall(scene: Scene, parent: Entity, name: string, spec: WallSpec): void {
    const { axis, across, length, height, thickness, opening } = spec;
    const block = (suffix: string, along: number, extent: number, bottom: number, top: number) => {
        const size = axis === 'x' ? ([extent, top - bottom, thickness] as const) : ([thickness, top - bottom, extent] as const);
        const position = axis === 'x' ? ([along, (bottom + top) / 2, across] as const) : ([across, (bottom + top) / 2, along] as const);
        staticBlock(scene, parent, suffix ? `${name}_${suffix}` : name, size, position, { material: plaster(`${name} · Reboco`) });
    };
    if (!opening) {
        block('', 0, length, 0, height);
        return;
    }
    const half = length / 2;
    const left = opening.offset - opening.width / 2;
    const right = opening.offset + opening.width / 2;
    block('Ombreira_1', (-half + left) / 2, left + half, 0, height);
    block('Ombreira_2', (right + half) / 2, half - right, 0, height);
    block('Verga', opening.offset, opening.width, opening.bottom + opening.height, height);
    if (opening.bottom > 0)
        block('Peitoril', opening.offset, opening.width, 0, opening.bottom);
}
function createRoof(scene: Scene, parent: Entity, name: string, size: number, top: number, overhang: number): void {
    const span = size + 2 * overhang;
    staticBlock(scene, parent, name, [span, ROOF_THICKNESS, span], [0, top + ROOF_THICKNESS / 2, 0], { material: accent(`${name} · Azul Helix`) });
}
export function createClosedHouse(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Casa_Fechada', kind: 'group' }, parent);
    vec3.set(group.transform.position, -14, 0, -9);
    const across = ROOM_SIZE / 2 - WALL_THICKNESS / 2;
    const sideLength = ROOM_SIZE - 2 * WALL_THICKNESS;
    createWall(scene, group, 'Parede_Norte', { axis: 'x', across: -across, length: ROOM_SIZE, height: WALL_HEIGHT, thickness: WALL_THICKNESS });
    createWall(scene, group, 'Parede_Sul', {
        axis: 'x',
        across,
        length: ROOM_SIZE,
        height: WALL_HEIGHT,
        thickness: WALL_THICKNESS,
        opening: { offset: 0, bottom: 0, width: 1.2, height: 2.2 },
    });
    createWall(scene, group, 'Parede_Oeste', { axis: 'z', across: -across, length: sideLength, height: WALL_HEIGHT, thickness: WALL_THICKNESS });
    createWall(scene, group, 'Parede_Leste', {
        axis: 'z',
        across,
        length: sideLength,
        height: WALL_HEIGHT,
        thickness: WALL_THICKNESS,
        opening: { offset: 0, bottom: 1.1, width: 1.2, height: 1.1 },
    });
    createRoof(scene, group, 'Teto', ROOM_SIZE, WALL_HEIGHT, 0.3);
}
export function createOpenShelter(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Abrigo_Aberto', kind: 'group' }, parent);
    vec3.set(group.transform.position, -14, 0, 2);
    const inset = ROOM_SIZE / 2 - 0.5;
    let index = 1;
    for (const x of [-inset, inset]) {
        for (const z of [-inset, inset]) {
            staticBlock(scene, group, `Pilar_${index++}`, [0.4, WALL_HEIGHT, 0.4], [x, WALL_HEIGHT / 2, z]);
        }
    }
    createRoof(scene, group, 'Cobertura', ROOM_SIZE, WALL_HEIGHT, 0.3);
}
const ARCADE_WIDTH = 14;
const ARCADE_WALL_HEIGHT = 3.6;
const CANOPY_HEIGHT = 2.9;
const CANOPY_THICKNESS = 0.25;
const CANOPY_DEPTH = 3.5;
const BAY_DEPTH = 2;
const BAY_COUNT = 3;
export function createShopArcade(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Arcada', kind: 'group' }, parent);
    vec3.set(group.transform.position, 0, 0, 14);
    const wallAcross = 1;
    const wallFront = wallAcross - WALL_THICKNESS / 2;
    const wallBack = wallAcross + WALL_THICKNESS / 2;
    staticBlock(scene, group, 'Fundo', [ARCADE_WIDTH, ARCADE_WALL_HEIGHT, WALL_THICKNESS], [0, ARCADE_WALL_HEIGHT / 2, wallAcross], { material: plaster('Fundo · Reboco') });
    const canopyFront = wallBack - CANOPY_DEPTH;
    staticBlock(scene, group, 'Marquise', [ARCADE_WIDTH, CANOPY_THICKNESS, CANOPY_DEPTH], [0, CANOPY_HEIGHT + CANOPY_THICKNESS / 2, (wallBack + canopyFront) / 2], {
        material: accent('Marquise · Azul Helix'),
    });
    const bayWidth = (ARCADE_WIDTH - WALL_THICKNESS) / BAY_COUNT;
    const pillarAlong = canopyFront + 0.35;
    for (let i = 0; i <= BAY_COUNT; i++) {
        const x = -ARCADE_WIDTH / 2 + WALL_THICKNESS / 2 + i * bayWidth;
        staticBlock(scene, group, `Divisoria_${i + 1}`, [WALL_THICKNESS, CANOPY_HEIGHT, BAY_DEPTH], [x, CANOPY_HEIGHT / 2, wallFront - BAY_DEPTH / 2], {
            material: plaster(`Divisória ${i + 1} · Reboco`),
        });
        staticBlock(scene, group, `Pilar_${i + 1}`, [0.35, CANOPY_HEIGHT, 0.35], [x, CANOPY_HEIGHT / 2, pillarAlong]);
    }
}
const ALLEY_LENGTH = 10;
const ALLEY_HEIGHT = 4;
const ALLEY_GAP = 1.6;
export function createAlley(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Viela', kind: 'group' }, parent);
    vec3.set(group.transform.position, 10, 0, -9);
    const thickness = 0.4;
    const across = ALLEY_GAP / 2 + thickness / 2;
    for (const [name, x] of [
        ['Muro_Oeste', -across],
        ['Muro_Leste', across],
    ] as const) {
        staticBlock(scene, group, name, [thickness, ALLEY_HEIGHT, ALLEY_LENGTH], [x, ALLEY_HEIGHT / 2, 0], { material: concrete(`${name} · Concreto`) });
    }
}
