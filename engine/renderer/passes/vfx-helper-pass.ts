import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { GL } from '@/engine/renderer/gl/context';
import { LineBatch } from '@/engine/renderer/gl/line-batch';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { LINE_HELPER_FRAGMENT_SHADER, LINE_HELPER_VERTEX_SHADER } from '@/engine/renderer/shaders/line-helper.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VfxEmitter, VfxShape } from '@/engine/vfx/document/vfx-document';
export type VfxHelperMode = 'all' | 'selected' | 'off';
export const VFX_HELPER_MODES: readonly VfxHelperMode[] = ['all', 'selected', 'off'];
export const VFX_HELPER_MODE_LABEL: Record<VfxHelperMode, string> = {
    all: 'Todos os efeitos',
    selected: 'Só a seleção',
    off: 'Ocultos',
};
export interface VfxHelperState {
    readonly playing: boolean;
    readonly emitters: readonly VfxEmitter[];
    readonly focusedEmitterId: string | null;
    readonly scale: number;
}
export interface VfxHelperRequest {
    mode: VfxHelperMode;
    selection: ReadonlySet<number> | null;
    state: (entityId: number) => VfxHelperState | null;
    elapsedSeconds: number;
}
const OCCLUDED_ALPHA = 0.18;
const MARKER_ALPHA = 0.95;
const UNSELECTED_ALPHA = 0.6;
const SHAPE_ALPHA = 0.55;
const SHAPE_DIM_ALPHA = 0.2;
const MARKER_RADIUS = 0.12;
const PULSE_PERIOD = 1.4;
const EFFECT_COLOR = vec3.create(0.98, 0.62, 0.12);
const IDLE_COLOR = vec3.create(0.62, 0.6, 0.66);
const SHAPE_COLOR = vec3.create(0.36, 0.72, 1);
const position = vec3.create();
const camRight = vec3.create();
const camUp = vec3.create();
const a = vec3.create();
const b = vec3.create();
const axisX = vec3.create();
const axisY = vec3.create();
const axisZ = vec3.create();
const center = vec3.create();
const shapeMatrix = mat4.create();
const localMatrix = mat4.create();
const euler = vec3.create();
const corners: Vec3[] = Array.from({ length: 8 }, () => vec3.create());
const BOX_EDGES: ReadonlyArray<readonly [
    number,
    number
]> = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
];
export class VfxHelperPass {
    private readonly program: ShaderProgram;
    private readonly lines: LineBatch;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, LINE_HELPER_VERTEX_SHADER, LINE_HELPER_FRAGMENT_SHADER);
        this.lines = new LineBatch(gl);
    }
    render(scene: Scene, camera: PerspectiveCamera, request: VfxHelperRequest): number {
        if (request.mode === 'off' || !this.program.ready)
            return 0;
        const { lines } = this;
        const view = camera.viewMatrix;
        vec3.set(camRight, view[0], view[4], view[8]);
        vec3.set(camUp, view[1], view[5], view[9]);
        lines.begin();
        scene.traverseVisible((entity) => {
            if (!entity.vfx)
                return;
            const selected = request.selection?.has(entity.id) ?? false;
            if (request.mode === 'selected' && !selected)
                return;
            const state = request.state(entity.id);
            this.marker(entity, state, selected, request.elapsedSeconds);
            if (selected && state)
                this.shapes(entity, state);
        });
        if (lines.vertexCount === 0)
            return 0;
        lines.upload();
        const { gl, program } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(program.uniform('u_alphaScale'), 1);
        lines.draw();
        gl.depthFunc(gl.GREATER);
        gl.uniform1f(program.uniform('u_alphaScale'), OCCLUDED_ALPHA);
        lines.draw();
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        return 2;
    }
    dispose(): void {
        this.program.dispose();
        this.lines.dispose();
    }
    private marker(entity: Entity, state: VfxHelperState | null, selected: boolean, elapsedSeconds: number): void {
        const { lines } = this;
        const m = entity.worldMatrix;
        vec3.set(position, m[12], m[13], m[14]);
        const playing = state?.playing ?? false;
        const color = playing ? EFFECT_COLOR : IDLE_COLOR;
        const alpha = selected ? MARKER_ALPHA : UNSELECTED_ALPHA;
        const pulse = playing ? 1 + 0.15 * Math.sin(((elapsedSeconds + entity.id * 0.21) / PULSE_PERIOD) * Math.PI * 2) : 1;
        const radius = MARKER_RADIUS * pulse;
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const long = i % 2 === 0 ? radius * 1.9 : radius * 1.2;
            vec3.scaleAndAdd(a, position, camRight, Math.cos(angle) * long);
            vec3.scaleAndAdd(a, a, camUp, Math.sin(angle) * long);
            lines.segment(position, a, color, alpha);
        }
        lines.circle(position, camRight, camUp, radius * 0.55, color, alpha * 0.8, 16);
    }
    private shapes(entity: Entity, state: VfxHelperState): void {
        for (const emitter of state.emitters) {
            if (!emitter.enabled)
                continue;
            const focused = state.focusedEmitterId === null || state.focusedEmitterId === emitter.id;
            this.shape(entity, emitter.shape, state.scale, focused ? SHAPE_ALPHA : SHAPE_DIM_ALPHA);
        }
    }
    private shape(entity: Entity, shape: VfxShape, scale: number, alpha: number): void {
        const { lines } = this;
        vec3.set(center, shape.offset[0] * scale, shape.offset[1] * scale, shape.offset[2] * scale);
        vec3.set(euler, shape.rotation[0], shape.rotation[1], shape.rotation[2]);
        vec3.set(a, shape.scale[0] * scale, shape.scale[1] * scale, shape.scale[2] * scale);
        mat4.fromTranslationRotationScale(localMatrix, center, euler, a);
        mat4.multiply(shapeMatrix, entity.worldMatrix, localMatrix);
        const m = shapeMatrix;
        vec3.set(position, m[12], m[13], m[14]);
        vec3.set(axisX, m[0], m[1], m[2]);
        vec3.set(axisY, m[4], m[5], m[6]);
        vec3.set(axisZ, m[8], m[9], m[10]);
        const color = SHAPE_COLOR;
        switch (shape.kind) {
            case 'point':
                lines.segment(vec3.scaleAndAdd(a, position, axisY, -0.1), vec3.scaleAndAdd(b, position, axisY, 0.1), color, alpha);
                lines.segment(vec3.scaleAndAdd(a, position, axisX, -0.1), vec3.scaleAndAdd(b, position, axisX, 0.1), color, alpha);
                lines.segment(vec3.scaleAndAdd(a, position, axisZ, -0.1), vec3.scaleAndAdd(b, position, axisZ, 0.1), color, alpha);
                break;
            case 'sphere':
            case 'hemisphere': {
                const radius = shape.radius;
                lines.circle(position, axisX, axisZ, radius, color, alpha, 40);
                if (shape.kind === 'sphere') {
                    lines.circle(position, axisX, axisY, radius, color, alpha, 40);
                    lines.circle(position, axisZ, axisY, radius, color, alpha, 40);
                }
                else {
                    lines.arc(position, axisX, axisY, radius, 0, Math.PI, color, alpha, 24);
                    lines.arc(position, axisZ, axisY, radius, 0, Math.PI, color, alpha, 24);
                }
                if (shape.thickness < 1 && shape.thickness > 0)
                    lines.circle(position, axisX, axisZ, radius * (1 - shape.thickness), color, alpha * 0.5, 32);
                break;
            }
            case 'cone': {
                const spread = Math.tan(degToRad(Math.min(shape.angle, 89))) * shape.length;
                lines.circle(position, axisX, axisZ, shape.radius, color, alpha, 40);
                if (shape.radius > 0 && shape.thickness < 1 && shape.thickness > 0)
                    lines.circle(position, axisX, axisZ, shape.radius * (1 - shape.thickness), color, alpha * 0.5, 32);
                vec3.scaleAndAdd(center, position, axisY, shape.length);
                lines.circle(center, axisX, axisZ, shape.radius + spread, color, alpha * 0.8, 40);
                for (let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI) / 2;
                    vec3.scaleAndAdd(a, position, axisX, Math.cos(angle) * shape.radius);
                    vec3.scaleAndAdd(a, a, axisZ, Math.sin(angle) * shape.radius);
                    vec3.scaleAndAdd(b, center, axisX, Math.cos(angle) * (shape.radius + spread));
                    vec3.scaleAndAdd(b, b, axisZ, Math.sin(angle) * (shape.radius + spread));
                    lines.segment(a, b, color, alpha * 0.8);
                }
                break;
            }
            case 'box': {
                const [sx, sy, sz] = shape.size;
                for (let i = 0; i < 8; i++) {
                    vec3.copy(corners[i], position);
                    vec3.scaleAndAdd(corners[i], corners[i], axisX, (i & 1 ? 0.5 : -0.5) * sx);
                    vec3.scaleAndAdd(corners[i], corners[i], axisY, (i & 2 ? 0.5 : -0.5) * sy);
                    vec3.scaleAndAdd(corners[i], corners[i], axisZ, (i & 4 ? 0.5 : -0.5) * sz);
                }
                for (const [from, to] of BOX_EDGES)
                    lines.segment(corners[from], corners[to], color, alpha);
                break;
            }
            case 'circle': {
                const arc = degToRad(shape.arc);
                lines.arc(position, axisX, axisZ, shape.radius, 0, arc, color, alpha, 40);
                if (shape.thickness < 1 && shape.thickness > 0)
                    lines.arc(position, axisX, axisZ, shape.radius * (1 - shape.thickness), 0, arc, color, alpha * 0.5, 32);
                break;
            }
            case 'edge':
                lines.segment(vec3.scaleAndAdd(a, position, axisX, -shape.length * 0.5), vec3.scaleAndAdd(b, position, axisX, shape.length * 0.5), color, alpha);
                break;
        }
    }
}
