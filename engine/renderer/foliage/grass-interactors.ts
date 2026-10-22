import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export const INTERACTOR_FLOATS = 16;
export const INTERACTOR_CENTER = 0;
export const INTERACTOR_AXES = 3;
export const INTERACTOR_RADIUS = 12;
export const INTERACTOR_BOTTOM = 13;
export const INTERACTOR_VELOCITY = 14;
const INITIAL_CAPACITY = 64;
const MAX_SPEED = 20;
const center = vec3.create();
const axis = vec3.create();
export class GrassInteractors {
    data = new Float32Array(INITIAL_CAPACITY * INTERACTOR_FLOATS);
    count = 0;
    readonly terrains: Entity[] = [];
    private readonly lastCenters = new WeakMap<Entity, Float32Array>();
    private deltaSeconds = 1 / 60;
    private readonly visit = (entity: Entity): void => {
        if (entity.terrain) {
            this.terrains.push(entity);
            return;
        }
        if (entity.character)
            this.addCharacter(entity);
        else if (entity.rigidBody)
            this.addRigidBody(entity);
    };
    collect(scene: Scene, deltaSeconds: number): void {
        this.count = 0;
        this.terrains.length = 0;
        this.deltaSeconds = Math.max(deltaSeconds, 1e-3);
        scene.traverseVisible(this.visit);
    }
    private addCharacter(entity: Entity): void {
        const settings = entity.character;
        if (!settings)
            return;
        const m = entity.worldMatrix;
        const base = this.allocate();
        const { data } = this;
        vec3.set(center, m[12], m[13] + settings.radius, m[14]);
        this.writeCenter(base, entity, center);
        data.fill(0, base + INTERACTOR_AXES, base + INTERACTOR_AXES + 9);
        data[base + INTERACTOR_RADIUS] = settings.radius;
        data[base + INTERACTOR_BOTTOM] = m[13];
    }
    private addRigidBody(entity: Entity): void {
        const settings = entity.rigidBody;
        if (!settings)
            return;
        const m = entity.worldMatrix;
        const base = this.allocate();
        const { data } = this;
        mat4.transformPoint(center, m, settings.center);
        this.writeCenter(base, entity, center);
        data.fill(0, base + INTERACTOR_AXES, base + INTERACTOR_AXES + 9);
        const sx = columnLength(m, 0);
        const sy = columnLength(m, 4);
        const sz = columnLength(m, 8);
        let radius = 0;
        let verticalReach = 0;
        switch (settings.collider) {
            case 'mesh':
            case 'box': {
                const half = settings.boxSize;
                for (let i = 0; i < 3; i++) {
                    const column = i * 4;
                    const extent = half[i] * 0.5;
                    const offset = base + INTERACTOR_AXES + i * 3;
                    data[offset] = m[column] * extent;
                    data[offset + 1] = m[column + 1] * extent;
                    data[offset + 2] = m[column + 2] * extent;
                    verticalReach += Math.abs(data[offset + 1]);
                }
                break;
            }
            case 'sphere':
                radius = settings.radius * Math.max(sx, sy, sz);
                break;
            case 'capsule': {
                radius = settings.radius * Math.max(sx, sz);
                const halfHeight = Math.max(0, settings.height * 0.5 * sy - radius);
                const offset = base + INTERACTOR_AXES;
                const scale = sy > 1e-6 ? halfHeight / sy : 0;
                vec3.set(axis, m[4] * scale, m[5] * scale, m[6] * scale);
                data[offset] = axis[0];
                data[offset + 1] = axis[1];
                data[offset + 2] = axis[2];
                verticalReach += Math.abs(axis[1]);
                break;
            }
        }
        data[base + INTERACTOR_RADIUS] = radius;
        data[base + INTERACTOR_BOTTOM] = center[1] - verticalReach - radius;
    }
    private writeCenter(base: number, entity: Entity, position: Vec3): void {
        const { data } = this;
        data[base + INTERACTOR_CENTER] = position[0];
        data[base + INTERACTOR_CENTER + 1] = position[1];
        data[base + INTERACTOR_CENTER + 2] = position[2];
        let last = this.lastCenters.get(entity);
        let vx = 0;
        let vz = 0;
        if (last) {
            vx = (position[0] - last[0]) / this.deltaSeconds;
            vz = (position[2] - last[2]) / this.deltaSeconds;
            if (vx * vx + vz * vz > MAX_SPEED * MAX_SPEED) {
                vx = 0;
                vz = 0;
            }
        }
        else {
            last = new Float32Array(3);
            this.lastCenters.set(entity, last);
        }
        last[0] = position[0];
        last[1] = position[1];
        last[2] = position[2];
        data[base + INTERACTOR_VELOCITY] = vx;
        data[base + INTERACTOR_VELOCITY + 1] = vz;
    }
    private allocate(): number {
        const base = this.count * INTERACTOR_FLOATS;
        if (base + INTERACTOR_FLOATS > this.data.length) {
            const grown = new Float32Array(this.data.length * 2);
            grown.set(this.data);
            this.data = grown;
        }
        this.count++;
        return base;
    }
}
function columnLength(m: Mat4, column: number): number {
    return Math.hypot(m[column], m[column + 1], m[column + 2]);
}
