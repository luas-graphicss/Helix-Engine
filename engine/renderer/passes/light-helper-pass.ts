import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { effectiveLightRange, resolveLocalLightColor, type AmbientLight, type DirectionalLight, type DiscLight, type Light, type LocalLight, type PointLight, type RectLight, type SpotLight, type TubeLight, } from '@/engine/core/scene/light';
import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { LineBatch } from '@/engine/renderer/gl/line-batch';
import { LINE_HELPER_FRAGMENT_SHADER, LINE_HELPER_VERTEX_SHADER } from '@/engine/renderer/shaders/line-helper.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export type LightHelperMode = 'all' | 'selected' | 'off';
export const LIGHT_HELPER_MODES: readonly LightHelperMode[] = ['all', 'selected', 'off'];
export const LIGHT_HELPER_MODE_LABEL: Record<LightHelperMode, string> = {
    all: 'Todas as luzes',
    selected: 'Só a seleção',
    off: 'Ocultos',
};
export interface LightHelperRequest {
    mode: LightHelperMode;
    selection: ReadonlySet<number> | null;
}
const OCCLUDED_ALPHA = 0.18;
const SHAPE_ALPHA = 0.95;
const UNSELECTED_ALPHA = 0.6;
const RANGE_ALPHA = 0.32;
const INNER_CONE_ALPHA = 0.45;
const COLOR_LIFT = 0.35;
const OFF_COLOR = vec3.create(0.55, 0.55, 0.58);
const COMPACT_CONE_LENGTH = 1;
const MIN_SOURCE_RADIUS = 0.08;
const SUN_DISC_RADIUS = 0.3;
const SUN_ARROW_LENGTH = 1.6;
const AMBIENT_DOME_RADIUS = 0.3;
const RANGE_SEGMENTS = 48;
const position = vec3.create();
const right = vec3.create();
const up = vec3.create();
const forward = vec3.create();
const color = vec3.create();
const a = vec3.create();
const b = vec3.create();
const c = vec3.create();
const d = vec3.create();
const WORLD_X = vec3.create(1, 0, 0);
const WORLD_Y = vec3.create(0, 1, 0);
const WORLD_Z = vec3.create(0, 0, 1);
export class LightHelperPass {
    private readonly program: ShaderProgram;
    private readonly lines: LineBatch;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, LINE_HELPER_VERTEX_SHADER, LINE_HELPER_FRAGMENT_SHADER);
        this.lines = new LineBatch(gl);
    }
    render(scene: Scene, camera: PerspectiveCamera, request: LightHelperRequest): number {
        if (request.mode === 'off' || !this.program.ready)
            return 0;
        const { lines } = this;
        lines.begin();
        scene.traverseVisible((entity) => {
            const light = entity.light;
            if (!light)
                return;
            const selected = request.selection?.has(entity.id) ?? false;
            if (request.mode === 'selected' && !selected)
                return;
            this.build(entity, light, selected);
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
    private build(entity: Entity, light: Light, selected: boolean): void {
        const m = entity.worldMatrix;
        vec3.set(position, m[12], m[13], m[14]);
        vec3.normalize(right, vec3.set(right, m[0], m[1], m[2]));
        vec3.normalize(up, vec3.set(up, m[4], m[5], m[6]));
        vec3.normalize(forward, vec3.set(forward, -m[8], -m[9], -m[10]));
        helperColor(color, light);
        const alpha = selected ? SHAPE_ALPHA : UNSELECTED_ALPHA;
        switch (light.type) {
            case 'point':
                this.point(light, alpha, selected);
                break;
            case 'spot':
                this.spot(light, alpha, selected);
                break;
            case 'rect':
                this.rect(light, alpha, selected);
                break;
            case 'disc':
                this.disc(light, alpha, selected);
                break;
            case 'tube':
                this.tube(light, alpha, selected);
                break;
            case 'directional':
                this.sun(light, alpha, selected);
                break;
            case 'ambient':
                this.ambient(light, alpha);
                break;
        }
    }
    private point(light: PointLight, alpha: number, selected: boolean): void {
        const { lines } = this;
        const radius = Math.max(light.sourceRadius, MIN_SOURCE_RADIUS);
        this.sphere(position, radius, alpha, 24);
        for (const axis of [right, up, forward]) {
            lines.segment(vec3.scaleAndAdd(a, position, axis, radius * 1.4), vec3.scaleAndAdd(b, position, axis, radius * 2.4), color, alpha);
            lines.segment(vec3.scaleAndAdd(a, position, axis, -radius * 1.4), vec3.scaleAndAdd(b, position, axis, -radius * 2.4), color, alpha);
        }
        if (selected)
            this.sphere(position, effectiveLightRange(light), RANGE_ALPHA, RANGE_SEGMENTS);
    }
    private spot(light: SpotLight, alpha: number, selected: boolean): void {
        const { lines } = this;
        const range = effectiveLightRange(light);
        const length = selected ? range : Math.min(range, COMPACT_CONE_LENGTH);
        const outer = degToRad(Math.min(Math.max(light.outerAngle, 1), 89));
        const inner = degToRad(Math.min(Math.max(light.innerAngle, 0), light.outerAngle));
        vec3.scaleAndAdd(c, position, forward, length);
        const outerRadius = length * Math.tan(outer);
        lines.circle(c, right, up, outerRadius, color, alpha, selected ? RANGE_SEGMENTS : 32);
        if (selected && inner > 0)
            lines.circle(c, right, up, length * Math.tan(inner), color, INNER_CONE_ALPHA, RANGE_SEGMENTS);
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const u = Math.cos(angle) * outerRadius;
            const v = Math.sin(angle) * outerRadius;
            vec3.scaleAndAdd(a, c, right, u);
            vec3.scaleAndAdd(a, a, up, v);
            lines.segment(position, a, color, alpha);
        }
        if (light.sourceRadius > 0)
            lines.circle(position, right, up, light.sourceRadius, color, alpha, 16);
    }
    private rect(light: RectLight, alpha: number, selected: boolean): void {
        const { lines } = this;
        const halfWidth = light.width * 0.5;
        const halfHeight = light.height * 0.5;
        corner(a, halfWidth, halfHeight);
        corner(b, -halfWidth, halfHeight);
        corner(c, -halfWidth, -halfHeight);
        corner(d, halfWidth, -halfHeight);
        lines.segment(a, b, color, alpha);
        lines.segment(b, c, color, alpha);
        lines.segment(c, d, color, alpha);
        lines.segment(d, a, color, alpha);
        this.emissionArrows(Math.max(light.width, light.height), light.twoSided, alpha);
        if (selected)
            this.emitterRange(effectiveLightRange(light), light.twoSided);
    }
    private disc(light: DiscLight, alpha: number, selected: boolean): void {
        this.lines.circle(position, right, up, light.radius, color, alpha, 40);
        this.emissionArrows(light.radius * 2, light.twoSided, alpha);
        if (selected)
            this.emitterRange(effectiveLightRange(light), light.twoSided);
    }
    private tube(light: TubeLight, alpha: number, selected: boolean): void {
        const { lines } = this;
        const half = light.length * 0.5;
        const thickness = Math.max(light.sourceRadius, MIN_SOURCE_RADIUS * 0.5);
        vec3.scaleAndAdd(a, position, right, -half);
        vec3.scaleAndAdd(b, position, right, half);
        lines.circle(a, up, forward, thickness, color, alpha, 16);
        lines.circle(b, up, forward, thickness, color, alpha, 16);
        for (const axis of [up, forward]) {
            for (const sign of [1, -1]) {
                vec3.scaleAndAdd(c, a, axis, thickness * sign);
                vec3.scaleAndAdd(d, b, axis, thickness * sign);
                lines.segment(c, d, color, alpha);
            }
        }
        if (!selected)
            return;
        const range = effectiveLightRange(light);
        lines.circle(position, up, forward, range, color, RANGE_ALPHA, RANGE_SEGMENTS);
        for (const axis of [up, forward]) {
            lines.arc(a, right, axis, range, Math.PI / 2, (Math.PI * 3) / 2, color, RANGE_ALPHA, 24);
            lines.arc(b, right, axis, range, -Math.PI / 2, Math.PI / 2, color, RANGE_ALPHA, 24);
            for (const sign of [1, -1]) {
                vec3.scaleAndAdd(c, a, axis, range * sign);
                vec3.scaleAndAdd(d, b, axis, range * sign);
                lines.segment(c, d, color, RANGE_ALPHA);
            }
        }
    }
    private sun(light: DirectionalLight, alpha: number, selected: boolean): void {
        const { lines } = this;
        lines.circle(position, right, up, SUN_DISC_RADIUS, color, alpha, 32);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const u = Math.cos(angle);
            const v = Math.sin(angle);
            radial(a, position, u, v, SUN_DISC_RADIUS * 1.3);
            radial(b, position, u, v, SUN_DISC_RADIUS * 1.75);
            lines.segment(a, b, color, alpha);
        }
        this.arrow(position, forward, SUN_ARROW_LENGTH, alpha);
        if (!selected)
            return;
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2 + Math.PI / 4;
            radial(a, position, Math.cos(angle), Math.sin(angle), SUN_DISC_RADIUS);
            vec3.scaleAndAdd(b, a, forward, SUN_ARROW_LENGTH * 0.75);
            lines.segment(a, b, color, RANGE_ALPHA);
        }
    }
    private ambient(light: AmbientLight, alpha: number): void {
        const { lines } = this;
        lines.circle(position, WORLD_X, WORLD_Z, AMBIENT_DOME_RADIUS, color, alpha, 32);
        lines.arc(position, WORLD_X, WORLD_Y, AMBIENT_DOME_RADIUS, 0, Math.PI, color, alpha, 16);
        lines.arc(position, WORLD_Z, WORLD_Y, AMBIENT_DOME_RADIUS, 0, Math.PI, color, alpha, 16);
        vec3.scale(c, light.groundColor, 1);
        helperTint(c);
        lines.arc(position, WORLD_X, WORLD_Y, AMBIENT_DOME_RADIUS * 0.6, Math.PI, Math.PI * 2, c, alpha * 0.7, 12);
        lines.arc(position, WORLD_Z, WORLD_Y, AMBIENT_DOME_RADIUS * 0.6, Math.PI, Math.PI * 2, c, alpha * 0.7, 12);
    }
    private sphere(center: Vec3, radius: number, alpha: number, segments: number): void {
        const { lines } = this;
        lines.circle(center, right, up, radius, color, alpha, segments);
        lines.circle(center, right, forward, radius, color, alpha, segments);
        lines.circle(center, up, forward, radius, color, alpha, segments);
    }
    private emissionArrows(size: number, twoSided: boolean, alpha: number): void {
        const length = Math.min(Math.max(size * 0.35, 0.25), 1);
        this.arrow(position, forward, length, alpha);
        if (twoSided) {
            vec3.scale(a, forward, -1);
            this.arrow(position, a, length, alpha);
        }
    }
    private emitterRange(range: number, twoSided: boolean): void {
        const { lines } = this;
        lines.circle(position, right, up, range, color, RANGE_ALPHA, RANGE_SEGMENTS);
        const to = twoSided ? Math.PI * 2 : Math.PI;
        lines.arc(position, right, forward, range, 0, to, color, RANGE_ALPHA, twoSided ? RANGE_SEGMENTS : 24);
        lines.arc(position, up, forward, range, 0, to, color, RANGE_ALPHA, twoSided ? RANGE_SEGMENTS : 24);
    }
    private arrow(from: Vec3, direction: Vec3, length: number, alpha: number): void {
        const { lines } = this;
        const head = Math.min(length * 0.25, 0.3);
        const tip = vec3.scaleAndAdd(c, from, direction, length);
        lines.segment(from, tip, color, alpha);
        vec3.scaleAndAdd(d, tip, direction, -head);
        const spread = head * 0.5;
        lines.segment(tip, vec3.scaleAndAdd(a, d, right, spread), color, alpha);
        lines.segment(tip, vec3.scaleAndAdd(a, d, right, -spread), color, alpha);
        lines.segment(tip, vec3.scaleAndAdd(a, d, up, spread), color, alpha);
        lines.segment(tip, vec3.scaleAndAdd(a, d, up, -spread), color, alpha);
    }
}
function degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
}
function corner(out: Vec3, u: number, v: number): Vec3 {
    vec3.scaleAndAdd(out, position, right, u);
    return vec3.scaleAndAdd(out, out, up, v);
}
function radial(out: Vec3, center: Vec3, u: number, v: number, radius: number): Vec3 {
    vec3.scaleAndAdd(out, center, right, u * radius);
    return vec3.scaleAndAdd(out, out, up, v * radius);
}
function helperTint(rgb: Vec3): Vec3 {
    const peak = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
    vec3.scale(rgb, rgb, 1 / peak);
    rgb[0] += (1 - rgb[0]) * COLOR_LIFT;
    rgb[1] += (1 - rgb[1]) * COLOR_LIFT;
    rgb[2] += (1 - rgb[2]) * COLOR_LIFT;
    return rgb;
}
function helperColor(out: Vec3, light: Light): Vec3 {
    if (light.intensity <= 0)
        return vec3.copy(out, OFF_COLOR);
    if (light.type === 'directional')
        vec3.copy(out, light.color);
    else if (light.type === 'ambient')
        vec3.copy(out, light.skyColor);
    else
        resolveLocalLightColor(out, light as LocalLight);
    return helperTint(out);
}
