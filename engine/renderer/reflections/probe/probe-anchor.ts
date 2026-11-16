import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
const FOLLOW_DISTANCE = 4;
const STRANDED_DISTANCE = 8;
const REST_FRAMES = 3;
export class ProbeAnchor {
    readonly position = vec3.create();
    private readonly lastCameraPosition = vec3.create();
    private stillFrames = REST_FRAMES;
    trackCamera(cameraPosition: Vec3): void {
        const moved = vec3.distance(cameraPosition, this.lastCameraPosition) > 0;
        this.stillFrames = moved ? 0 : Math.min(this.stillFrames + 1, REST_FRAMES);
        vec3.copy(this.lastCameraPosition, cameraPosition);
    }
    get cameraMoving(): boolean {
        return this.stillFrames === 0;
    }
    get cameraTraveling(): boolean {
        return this.stillFrames < REST_FRAMES;
    }
    shouldFollow(cameraPosition: Vec3): boolean {
        const drift = vec3.distance(cameraPosition, this.position);
        return drift > STRANDED_DISTANCE || (drift > FOLLOW_DISTANCE && this.cameraTraveling);
    }
    moveTo(position: Vec3): void {
        vec3.copy(this.position, position);
    }
}
