import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Quat } from '@/engine/core/math/quat';
import { Entity } from '@/engine/core/scene/entity';
import { hexToLinearRgb, srgbToLinear } from '@/engine/core/color/srgb';
import { HelixArgumentError } from './script-errors';
export type Vec3Like = Vec3 | ArrayLike<number> | {
    x: number;
    y: number;
    z: number;
};
export type QuatLike = Quat | ArrayLike<number> | {
    x: number;
    y: number;
    z: number;
    w: number;
};
export type ColorLike = Vec3Like | string;
function isXyz(value: unknown): value is {
    x: number;
    y: number;
    z: number;
} {
    return typeof value === 'object' && value !== null && typeof (value as {
        x?: unknown;
    }).x === 'number' && typeof (value as {
        y?: unknown;
    }).y === 'number' && typeof (value as {
        z?: unknown;
    }).z === 'number';
}
function isArrayLikeNumbers(value: unknown, minimum: number): value is ArrayLike<number> {
    if (ArrayBuffer.isView(value))
        return (value as unknown as ArrayLike<number>).length >= minimum;
    if (!Array.isArray(value) || value.length < minimum)
        return false;
    for (let index = 0; index < minimum; index++)
        if (typeof value[index] !== 'number')
            return false;
    return true;
}
export function isVec3Like(value: unknown): value is Vec3Like {
    return isXyz(value) || isArrayLikeNumbers(value, 3);
}
export function toVec3(value: unknown, member: string, out: Vec3 = vec3.create()): Vec3 {
    if (isXyz(value))
        return vec3.set(out, value.x, value.y, value.z);
    if (isArrayLikeNumbers(value, 3))
        return vec3.set(out, value[0], value[1], value[2]);
    if (typeof value === 'number' && Number.isFinite(value))
        return vec3.set(out, value, value, value);
    throw new HelixArgumentError(member, `esperava um Vec3 ({x, y, z}, [x, y, z] ou Float32Array); recebido ${describeType(value)}.`);
}
export function toVec3OrNull(value: unknown, member: string): Vec3 | null {
    return value === null || value === undefined ? null : toVec3(value, member);
}
export function toQuat(value: unknown, member: string, out: Quat = quat.create()): Quat {
    if (isXyz(value) && typeof (value as {
        w?: unknown;
    }).w === 'number') {
        const q = value as {
            x: number;
            y: number;
            z: number;
            w: number;
        };
        return quat.set(out, q.x, q.y, q.z, q.w);
    }
    if (isArrayLikeNumbers(value, 4))
        return quat.set(out, value[0], value[1], value[2], value[3]);
    throw new HelixArgumentError(member, `esperava um Quat ({x, y, z, w}, [x, y, z, w] ou Float32Array); recebido ${describeType(value)}.`);
}
export function toLinearColor(value: unknown, member: string, out: Vec3 = vec3.create()): Vec3 {
    if (typeof value === 'string') {
        const text = value.trim().toLowerCase();
        if (text.startsWith('#')) {
            const expanded = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text);
            return hexToLinearRgb(out, expanded ? `#${expanded[1]}${expanded[1]}${expanded[2]}${expanded[2]}${expanded[3]}${expanded[3]}` : text);
        }
        const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/.exec(text);
        if (rgb)
            return vec3.set(out, srgbToLinear(Number(rgb[1]) / 255), srgbToLinear(Number(rgb[2]) / 255), srgbToLinear(Number(rgb[3]) / 255));
        const named = CSS_NAMED_COLORS[text];
        if (named)
            return hexToLinearRgb(out, named);
        throw new HelixArgumentError(member, `cor "${value}" não reconhecida; use #rrggbb, rgb(r, g, b), um nome CSS ou um Vec3 linear.`);
    }
    return toVec3(value, member, out);
}
const CSS_NAMED_COLORS: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    lime: '#00ff00',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    aqua: '#00ffff',
    magenta: '#ff00ff',
    fuchsia: '#ff00ff',
    orange: '#ffa500',
    purple: '#800080',
    gray: '#808080',
    grey: '#808080',
    silver: '#c0c0c0',
    maroon: '#800000',
    navy: '#000080',
    teal: '#008080',
    olive: '#808000',
    pink: '#ffc0cb',
    brown: '#a52a2a',
    gold: '#ffd700',
    coral: '#ff7f50',
    tomato: '#ff6347',
    salmon: '#fa8072',
    crimson: '#dc143c',
    indigo: '#4b0082',
    violet: '#ee82ee',
    turquoise: '#40e0d0',
    skyblue: '#87ceeb',
    steelblue: '#4682b4',
    royalblue: '#4169e1',
    slategray: '#708090',
    darkgray: '#a9a9a9',
    lightgray: '#d3d3d3',
    transparent: '#000000',
};
export function describeType(value: unknown): string {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    if (value instanceof Entity)
        return `Ator "${value.name}"`;
    if (Array.isArray(value))
        return `array(${value.length})`;
    if (ArrayBuffer.isView(value))
        return `${value.constructor.name}(${(value as unknown as ArrayLike<number>).length})`;
    if (typeof value === 'object')
        return value.constructor?.name ?? 'object';
    if (typeof value === 'string')
        return `string "${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
    return typeof value;
}
export function requireEntity(value: unknown, member: string, what = 'o ator'): Entity {
    if (value instanceof Entity)
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser um Entity da cena; recebido ${describeType(value)}.`);
}
export function requireFunction<T extends (...args: never[]) => unknown>(value: unknown, member: string, what = 'o callback'): T {
    if (typeof value === 'function')
        return value as T;
    throw new HelixArgumentError(member, `${what} precisa ser uma função; recebido ${describeType(value)}.`);
}
export function requireString(value: unknown, member: string, what = 'o nome'): string {
    if (typeof value === 'string' && value.length > 0)
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser uma string não vazia; recebido ${describeType(value)}.`);
}
export function requireNumber(value: unknown, member: string, what = 'o valor'): number {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser um número finito; recebido ${describeType(value)}.`);
}
export function optionalNumber(value: unknown, fallback: number, member: string, what = 'o valor'): number {
    return value === undefined || value === null ? fallback : requireNumber(value, member, what);
}
export function requireOneOf<T extends string>(value: unknown, options: readonly T[], member: string, what = 'a opção'): T {
    if (typeof value === 'string' && (options as readonly string[]).includes(value))
        return value as T;
    throw new HelixArgumentError(member, `${what} precisa ser ${options.map((option) => `"${option}"`).join(', ')}; recebido ${describeType(value)}.`);
}
export function requireObject(value: unknown, member: string, what = 'as opções'): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value))
        return value as Record<string, unknown>;
    if (Array.isArray(value) && value.length === 0)
        return {};
    throw new HelixArgumentError(member, `${what} precisam ser um objeto; recebido ${describeType(value)}.`);
}
export function assignSettings(target: Record<string, unknown>, patch: unknown, member: string, options: {
    allowUnknown?: boolean;
    colors?: ReadonlySet<string>;
} = {}): void {
    const source = requireObject(patch, member);
    for (const [key, value] of Object.entries(source)) {
        if (!(key in target)) {
            if (options.allowUnknown) {
                target[key] = value;
                continue;
            }
            const known = Object.keys(target).filter((name) => typeof target[name] !== 'function');
            throw new HelixArgumentError(member, `"${key}" não é um campo conhecido. Campos: ${known.join(', ')}.`);
        }
        const current = target[key];
        if (current instanceof Float32Array) {
            if (options.colors?.has(key))
                toLinearColor(value, `${member}.${key}`, current as Vec3);
            else if (current.length === 4)
                toQuat(value, `${member}.${key}`, current as Quat);
            else
                toVec3(value, `${member}.${key}`, current as Vec3);
            continue;
        }
        if (current !== null && typeof current === 'object' && !Array.isArray(current) && value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Float32Array)) {
            assignSettings(current as Record<string, unknown>, value, `${member}.${key}`, options);
            continue;
        }
        target[key] = value;
    }
}
export function xyz(v: ArrayLike<number>): {
    x: number;
    y: number;
    z: number;
} {
    return { x: v[0], y: v[1], z: v[2] };
}
export function copyVec3(v: ArrayLike<number>): Vec3 {
    return vec3.create(v[0], v[1], v[2]);
}
export function isJsonValue(value: unknown, depth = 0): boolean {
    if (depth > 32)
        return false;
    if (value === null)
        return true;
    switch (typeof value) {
        case 'string':
        case 'boolean':
            return true;
        case 'number':
            return Number.isFinite(value);
        case 'object':
            if (Array.isArray(value))
                return value.every((entry) => isJsonValue(entry, depth + 1));
            if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
                return false;
            return Object.values(value as Record<string, unknown>).every((entry) => isJsonValue(entry, depth + 1));
        default:
            return false;
    }
}
export function requireJson<T>(value: unknown, member: string, what = 'o valor'): T {
    if (!isJsonValue(value))
        throw new HelixArgumentError(member, `${what} precisa ser serializável em JSON (número, texto, booleano, null, array ou objeto simples); recebido ${describeType(value)}.`);
    return value as T;
}
