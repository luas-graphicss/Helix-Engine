import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { effectiveTriggerRadius, type AudioSourceSettings } from '@/engine/audio/world/audio-source-settings';
import type { AudioZoneSettings } from '@/engine/audio/world/audio-zone-settings';
import type { SourceRuntimeView } from '@/engine/audio/world/audio-world';
import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { LineBatch } from '@/engine/renderer/gl/line-batch';
import { LINE_HELPER_FRAGMENT_SHADER, LINE_HELPER_VERTEX_SHADER } from '@/engine/renderer/shaders/line-helper.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export type SoundHelperMode = 'all' | 'selected' | 'off';
export const SOUND_HELPER_MODES: readonly SoundHelperMode[] = ['all', 'selected', 'off'];
export const SOUND_HELPER_MODE_LABEL: Record<SoundHelperMode, string> = {
    all: 'Todos os sons',
    selected: 'Só a seleção',
    off: 'Ocultos',
};
export interface SoundHelperRequest {
    mode: SoundHelperMode;
    selection: ReadonlySet<number> | null;
    sourceState: (entityId: number) => SourceRuntimeView | null;
    activeZoneId: number | null;
    elapsedSeconds: number;
}
const OCCLUDED_ALPHA = 0.18;
const MARKER_ALPHA = 0.95;
const UNSELECTED_ALPHA = 0.65;
const RANGE_ALPHA = 0.3;
const MIN_RANGE_ALPHA = 0.5;
const TRIGGER_ALPHA = 0.4;
const ZONE_ALPHA = 0.75;
const ZONE_FALLOFF_ALPHA = 0.22;
const RANGE_SEGMENTS = 48;
const SOURCE_COLOR = vec3.create(1, 0.74, 0.3);
const SOURCE_2D_COLOR = vec3.create(1, 0.86, 0.55);
const OCCLUDED_COLOR = vec3.create(0.78, 0.6, 0.45);
const ZONE_COLOR = vec3.create(0.35, 0.86, 0.82);
const ZONE_ACTIVE_COLOR = vec3.create(0.6, 0.98, 0.9);
const OFF_COLOR = vec3.create(0.55, 0.55, 0.58);
const MARKER_RADIUS = 0.13;
const WAVE_RADII = [0.24, 0.34, 0.44] as const;
const WAVE_HALF_ANGLE = 0.72;
const RIPPLE_PERIOD = 1.6;
const RIPPLE_MAX_RADIUS = 0.9;
const position = vec3.create();
const right = vec3.create();
const up = vec3.create();
const forward = vec3.create();
const camRight = vec3.create();
const camUp = vec3.create();
const color = vec3.create();
const a = vec3.create();
const b = vec3.create();
const c = vec3.create();
const d = vec3.create();
const corners: Vec3[] = Array.from({ length: 8 }, () => vec3.create());
const WORLD_X = vec3.create(1, 0, 0);
const WORLD_Y = vec3.create(0, 1, 0);
const WORLD_Z = vec3.create(0, 0, 1);
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
export class SoundHelperPass {
    private readonly program: ShaderProgram;
    private readonly lines: LineBatch;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, LINE_HELPER_VERTEX_SHADER, LINE_HELPER_FRAGMENT_SHADER);
        this.lines = new LineBatch(gl);
    }
    render(scene: Scene, camera: PerspectiveCamera, request: SoundHelperRequest): number {
        if (request.mode === 'off' || !this.program.ready)
            return 0;
        const { lines } = this;
        const view = camera.viewMatrix;
        vec3.set(camRight, view[0], view[4], view[8]);
        vec3.set(camUp, view[1], view[5], view[9]);
        lines.begin();
        scene.traverseVisible((entity) => {
            if (!entity.audioSource && !entity.audioZone)
                return;
            const selected = request.selection?.has(entity.id) ?? false;
            if (request.mode === 'selected' && !selected)
                return;
            this.basis(entity);
            if (entity.audioZone)
                this.zone(entity, entity.audioZone, selected, request);
            if (entity.audioSource)
                this.source(entity, entity.audioSource, selected, request);
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
    private basis(entity: Entity): void {
        const m = entity.worldMatrix;
        vec3.set(position, m[12], m[13], m[14]);
        vec3.normalize(right, vec3.set(right, m[0], m[1], m[2]));
        vec3.normalize(up, vec3.set(up, m[4], m[5], m[6]));
        vec3.normalize(forward, vec3.set(forward, -m[8], -m[9], -m[10]));
    }
    private source(entity: Entity, settings: AudioSourceSettings, selected: boolean, request: SoundHelperRequest): void {
        const { lines } = this;
        const state = request.sourceState(entity.id);
        const playing = state?.status === 'playing';
        const silent = settings.muted || settings.assetId === null;
        if (silent)
            vec3.copy(color, OFF_COLOR);
        else if (state?.occluded)
            vec3.copy(color, OCCLUDED_COLOR);
        else
            vec3.copy(color, settings.spatial ? SOURCE_COLOR : SOURCE_2D_COLOR);
        const alpha = selected ? MARKER_ALPHA : UNSELECTED_ALPHA;
        lines.circle(position, camRight, camUp, MARKER_RADIUS, color, alpha, 20);
        lines.segment(vec3.scaleAndAdd(a, position, camRight, -MARKER_RADIUS), vec3.scaleAndAdd(b, position, camRight, -MARKER_RADIUS * 2.2), color, alpha);
        lines.segment(vec3.scaleAndAdd(a, position, camUp, MARKER_RADIUS), vec3.scaleAndAdd(b, position, camUp, -MARKER_RADIUS), color, alpha * 0.6);
        const waves = settings.spatial ? WAVE_RADII.length : 1;
        for (let i = 0; i < waves; i++) {
            lines.arc(position, camRight, camUp, WAVE_RADII[i], -WAVE_HALF_ANGLE, WAVE_HALF_ANGLE, color, alpha * (1 - i * 0.2), 10);
        }
        if (!settings.spatial) {
            lines.circle(position, camRight, camUp, MARKER_RADIUS * 1.7, color, alpha * 0.5, 24);
        }
        if (playing) {
            const phase = ((request.elapsedSeconds + entity.id * 0.37) / RIPPLE_PERIOD) % 1;
            const radius = MARKER_RADIUS + phase * (RIPPLE_MAX_RADIUS - MARKER_RADIUS);
            lines.circle(position, camRight, camUp, radius, color, alpha * (1 - phase) * 0.8, 32);
        }
        if (!selected)
            return;
        if (settings.spatial) {
            this.sphere(position, settings.minDistance, MIN_RANGE_ALPHA, 32);
            this.sphere(position, settings.maxDistance, RANGE_ALPHA, RANGE_SEGMENTS);
            if (settings.cone.enabled)
                this.cone(settings);
        }
        if (settings.trigger === 'proximity') {
            vec3.copy(c, color);
            c[0] += (1 - c[0]) * 0.5;
            c[1] += (1 - c[1]) * 0.5;
            c[2] += (1 - c[2]) * 0.5;
            const radius = effectiveTriggerRadius(settings);
            lines.circle(position, WORLD_X, WORLD_Z, radius, c, TRIGGER_ALPHA, RANGE_SEGMENTS);
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                vec3.scaleAndAdd(a, position, WORLD_X, Math.cos(angle) * radius);
                vec3.scaleAndAdd(a, a, WORLD_Z, Math.sin(angle) * radius);
                lines.segment(vec3.scaleAndAdd(b, a, WORLD_Y, -0.25), vec3.scaleAndAdd(d, a, WORLD_Y, 0.25), c, TRIGGER_ALPHA);
            }
        }
    }
    private cone(settings: AudioSourceSettings): void {
        const length = Math.min(settings.maxDistance * 0.5, Math.max(settings.minDistance * 1.5, 2));
        const outerHalf = Math.min(settings.cone.outerAngle, 358) * 0.5;
        const innerHalf = Math.min(settings.cone.innerAngle, settings.cone.outerAngle) * 0.5;
        this.arrow(position, forward, Math.min(length, 1.5), MARKER_ALPHA);
        if (outerHalf >= 89.5) {
            if (innerHalf > 0 && innerHalf < 89.5)
                this.coneRing(length, innerHalf, RANGE_ALPHA, 4);
            return;
        }
        this.coneRing(length, outerHalf, MIN_RANGE_ALPHA, 4);
        if (innerHalf > 0)
            this.coneRing(length, innerHalf, RANGE_ALPHA, 0);
    }
    private coneRing(length: number, halfAngleDegrees: number, alpha: number, edges: number): void {
        const { lines } = this;
        const radius = length * Math.tan((halfAngleDegrees * Math.PI) / 180);
        vec3.scaleAndAdd(c, position, forward, length);
        lines.circle(c, right, up, radius, color, alpha, 40);
        for (let i = 0; i < edges; i++) {
            const angle = (i * Math.PI) / 2;
            vec3.scaleAndAdd(a, c, right, Math.cos(angle) * radius);
            vec3.scaleAndAdd(a, a, up, Math.sin(angle) * radius);
            lines.segment(position, a, color, alpha);
        }
    }
    private zone(entity: Entity, settings: AudioZoneSettings, selected: boolean, request: SoundHelperRequest): void {
        const { lines } = this;
        const active = request.activeZoneId === entity.id;
        if (!settings.enabled)
            vec3.copy(color, OFF_COLOR);
        else
            vec3.copy(color, active ? ZONE_ACTIVE_COLOR : ZONE_COLOR);
        const alpha = (selected ? ZONE_ALPHA : ZONE_ALPHA * 0.7) * (active ? 1 : 0.85);
        lines.circle(position, camRight, camUp, MARKER_RADIUS * 0.8, color, alpha, 16);
        lines.arc(position, camRight, camUp, MARKER_RADIUS * 1.4, Math.PI * 0.15, Math.PI * 0.85, color, alpha * 0.7, 10);
        lines.arc(position, camRight, camUp, MARKER_RADIUS * 1.4, Math.PI * 1.15, Math.PI * 1.85, color, alpha * 0.7, 10);
        if (settings.shape === 'sphere') {
            const m = entity.worldMatrix;
            const scale = (Math.hypot(m[0], m[1], m[2]) + Math.hypot(m[4], m[5], m[6]) + Math.hypot(m[8], m[9], m[10])) / 3;
            const radius = settings.radius * scale;
            this.sphere(position, radius, alpha, RANGE_SEGMENTS);
            if (selected && settings.falloff > 0)
                this.sphere(position, radius + settings.falloff, ZONE_FALLOFF_ALPHA, RANGE_SEGMENTS);
            return;
        }
        this.box(entity, settings.size, 0, alpha);
        if (selected && settings.falloff > 0)
            this.box(entity, settings.size, settings.falloff, ZONE_FALLOFF_ALPHA);
    }
    private box(entity: Entity, size: Vec3, margin: number, alpha: number): void {
        const { lines } = this;
        const m = entity.worldMatrix;
        const sx = Math.hypot(m[0], m[1], m[2]) || 1;
        const sy = Math.hypot(m[4], m[5], m[6]) || 1;
        const sz = Math.hypot(m[8], m[9], m[10]) || 1;
        const hx = size[0] * 0.5 + margin / sx;
        const hy = size[1] * 0.5 + margin / sy;
        const hz = size[2] * 0.5 + margin / sz;
        for (let i = 0; i < 8; i++) {
            vec3.set(a, i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz);
            mat4.transformPoint(corners[i], m, a);
        }
        for (const [from, to] of BOX_EDGES)
            lines.segment(corners[from], corners[to], color, alpha);
    }
    private sphere(center: Vec3, radius: number, alpha: number, segments: number): void {
        const { lines } = this;
        lines.circle(center, right, up, radius, color, alpha, segments);
        lines.circle(center, right, forward, radius, color, alpha, segments);
        lines.circle(center, up, forward, radius, color, alpha, segments);
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
