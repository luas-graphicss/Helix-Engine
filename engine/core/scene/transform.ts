import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
const COMPONENTS = 9;
export class Transform {
    readonly position = vec3.create(0, 0, 0);
    readonly rotation = vec3.create(0, 0, 0);
    readonly scale = vec3.create(1, 1, 1);
    readonly localMatrix = mat4.create();
    private readonly composed = new Float32Array(COMPONENTS).fill(NaN);
    updateLocalMatrix(): boolean {
        const { position, rotation, scale, composed } = this;
        if (composed[0] === position[0] && composed[1] === position[1] && composed[2] === position[2] &&
            composed[3] === rotation[0] && composed[4] === rotation[1] && composed[5] === rotation[2] &&
            composed[6] === scale[0] && composed[7] === scale[1] && composed[8] === scale[2]) {
            return false;
        }
        composed.set(position, 0);
        composed.set(rotation, 3);
        composed.set(scale, 6);
        mat4.fromTranslationRotationScale(this.localMatrix, position, rotation, scale);
        return true;
    }
}
