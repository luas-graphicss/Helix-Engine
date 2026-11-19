import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Material } from '@/engine/core/scene/material';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VisibleMesh } from '@/engine/renderer/culling/visible-set';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { flatFacesOf, type MirrorFace } from './mirror-faces';
import { createMirrorPlane } from './mirror-plane';
const MAX_ROUGHNESS = 0.1;
const MIN_CLEARANCE = 0.15;
const MIN_SCORE = 0.004;
const KEEP_BIAS = 1.6;
const DIELECTRIC_REFLECTANCE = 0.04;
const LUMA = [0.2126, 0.7152, 0.0722] as const;
function isMirrorLike(material: Material): boolean {
    return material.alphaMode === 'opaque' && material.opacity >= 1 && material.roughness <= MAX_ROUGHNESS;
}
function reflectance(material: Material): number {
    const { baseColor } = material;
    const luma = baseColor[0] * LUMA[0] + baseColor[1] * LUMA[1] + baseColor[2] * LUMA[2];
    const specular = DIELECTRIC_REFLECTANCE + (luma - DIELECTRIC_REFLECTANCE) * material.metallic;
    return specular * (1 - (0.5 * material.roughness) / MAX_ROUGHNESS);
}
export class MirrorSelector {
    readonly plane = createMirrorPlane();
    private entity: Entity | null = null;
    private face: MirrorFace | null = null;
    private readonly candidate = createMirrorPlane();
    private readonly center = vec3.create();
    private readonly edgeA = vec3.create();
    private readonly edgeB = vec3.create();
    private readonly axisOut = vec3.create();
    select(meshes: readonly VisibleMesh[], camera: PerspectiveCamera): boolean {
        if (camera.orthographic) {
            this.entity = null;
            this.face = null;
            return false;
        }
        const tangent = camera.tanHalfFov;
        const viewArea = 4 * tangent * tangent * camera.aspect;
        let bestScore = MIN_SCORE;
        let bestEntity: Entity | null = null;
        let bestFace: MirrorFace | null = null;
        for (const item of meshes) {
            const { material } = item.entity;
            if (!material || !isMirrorLike(material))
                continue;
            const weight = reflectance(material) / viewArea;
            for (const face of flatFacesOf(item.mesh)) {
                const kept = item.entity === this.entity && face === this.face;
                const score = this.coverage(item, face, camera) * weight * (kept ? KEEP_BIAS : 1);
                if (score <= bestScore)
                    continue;
                bestScore = score;
                bestEntity = item.entity;
                bestFace = face;
                vec3.copy(this.plane.normal, this.candidate.normal);
                this.plane.offset = this.candidate.offset;
            }
        }
        this.entity = bestEntity;
        this.face = bestFace;
        return bestEntity !== null;
    }
    private coverage(item: VisibleMesh, face: MirrorFace, camera: PerspectiveCamera): number {
        const { candidate, center, edgeA, edgeB, axisOut } = this;
        const { min, max } = getLocalBounds(item.mesh);
        const matrix = item.entity.worldMatrix;
        const { axis, sign } = face;
        const a = (axis + 1) % 3;
        const b = (axis + 2) % 3;
        for (let i = 0; i < 3; i++) {
            center[i] = 0.5 * (min[i] + max[i]);
            edgeA[i] = matrix[a * 4 + i] * (max[a] - min[a]);
            edgeB[i] = matrix[b * 4 + i] * (max[b] - min[b]);
            axisOut[i] = matrix[axis * 4 + i] * sign;
        }
        center[axis] = sign > 0 ? max[axis] : min[axis];
        mat4.transformPoint(center, matrix, center);
        const normal = vec3.cross(candidate.normal, edgeA, edgeB);
        const area = vec3.length(normal);
        if (area <= 0)
            return 0;
        vec3.scale(normal, normal, (vec3.dot(normal, axisOut) < 0 ? -1 : 1) / area);
        candidate.offset = vec3.dot(normal, center);
        const clearance = vec3.dot(normal, camera.position) - candidate.offset;
        if (clearance < MIN_CLEARANCE)
            return 0;
        const distance = Math.max(vec3.distance(camera.position, center), clearance);
        return (area * clearance) / (distance * distance * distance);
    }
}
