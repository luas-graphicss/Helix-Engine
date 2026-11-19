import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { GizmoPainter } from '@/engine/editor/extensions/gizmos/gizmo-painter';
import { HelixArgumentError } from '../../runtime/script-errors';
import { describeType, requireEntity, requireFunction, requireNumber, toLinearColor, toVec3 } from '../../runtime/values';
const UP = vec3.create(0, 1, 0);
const draws = new WeakMap<GizmoPainter, GizmoDraw>();
function sizeOf(value: unknown, member: string): Vec3 {
    return typeof value === 'number' ? vec3.create(value, value, value) : toVec3(value, member);
}
function pointsOf(value: unknown, member: string): Vec3[] {
    if (!Array.isArray(value))
        throw new HelixArgumentError(member, `os pontos precisam ser uma lista; recebido ${describeType(value)}.`);
    return value.map((point: unknown) => toVec3(point, member));
}
function createGizmoDraw(painter: GizmoPainter) {
    return {
        color: (color: unknown, alpha?: unknown) => painter.setColor(toLinearColor(color, 'draw.color'), alpha === undefined ? 1 : requireNumber(alpha, 'draw.color', 'a opacidade')),
        line: (a: unknown, b: unknown) => painter.line(toVec3(a, 'draw.line'), toVec3(b, 'draw.line')),
        polyline: (points: unknown, closed?: unknown) => painter.polyline(pointsOf(points, 'draw.polyline'), closed === true),
        ray: (origin: unknown, direction: unknown, length?: unknown) => painter.ray(toVec3(origin, 'draw.ray'), toVec3(direction, 'draw.ray'), length === undefined ? 1 : requireNumber(length, 'draw.ray', 'o comprimento')),
        arrow: (from: unknown, to: unknown) => painter.arrow(toVec3(from, 'draw.arrow'), toVec3(to, 'draw.arrow')),
        cross: (center: unknown, size?: unknown) => painter.cross(toVec3(center, 'draw.cross'), size === undefined ? 1 : requireNumber(size, 'draw.cross', 'o tamanho')),
        box: (center: unknown, size: unknown) => painter.box(toVec3(center, 'draw.box'), sizeOf(size, 'draw.box')),
        sphere: (center: unknown, radius: unknown) => painter.sphere(toVec3(center, 'draw.sphere'), requireNumber(radius, 'draw.sphere', 'o raio')),
        circle: (center: unknown, radius: unknown, normal?: unknown) => painter.circle(toVec3(center, 'draw.circle'), normal === undefined ? UP : toVec3(normal, 'draw.circle'), requireNumber(radius, 'draw.circle', 'o raio')),
        local: (actor: unknown, paint: unknown) => painter.withMatrix(requireEntity(actor, 'draw.local').worldMatrix, requireFunction<() => void>(paint, 'draw.local', 'o desenho')),
    };
}
export type GizmoDraw = ReturnType<typeof createGizmoDraw>;
export function gizmoDrawFor(painter: GizmoPainter): GizmoDraw {
    let draw = draws.get(painter);
    if (!draw) {
        draw = createGizmoDraw(painter);
        draws.set(painter, draw);
    }
    return draw;
}
