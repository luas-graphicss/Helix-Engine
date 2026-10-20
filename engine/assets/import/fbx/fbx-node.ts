import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export type FbxArray = Float64Array | Float32Array | Int32Array;
export type FbxValue = number | string | boolean | FbxArray | Uint8Array;
export interface FbxNode {
    name: string;
    props: FbxValue[];
    children: FbxNode[];
}
export function createFbxNode(name: string, props: FbxValue[] = []): FbxNode {
    return { name, props, children: [] };
}
export function findChild(node: FbxNode, name: string): FbxNode | null {
    return node.children.find((child) => child.name === name) ?? null;
}
export function findChildren(node: FbxNode, name: string): FbxNode[] {
    return node.children.filter((child) => child.name === name);
}
export function isFbxArray(value: FbxValue | undefined): value is FbxArray {
    return value instanceof Float64Array || value instanceof Float32Array || value instanceof Int32Array;
}
export function propNumber(node: FbxNode | null, index: number, fallback: number): number {
    const value = node?.props[index];
    if (typeof value === 'number')
        return value;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
}
export function propString(node: FbxNode | null, index: number, fallback = ''): string {
    const value = node?.props[index];
    return typeof value === 'string' ? value : fallback;
}
export function propArray(node: FbxNode | null): FbxArray | null {
    if (!node)
        return null;
    for (const value of node.props)
        if (isFbxArray(value))
            return value;
    if (node.props.length > 0 && node.props.every((value) => typeof value === 'number'))
        return Float64Array.from(node.props as number[]);
    return null;
}
export function childArray(node: FbxNode, name: string): FbxArray | null {
    return propArray(findChild(node, name));
}
export function normalizeObjectName(raw: string): string {
    const separator = raw.indexOf('\0\x01');
    if (separator === -1)
        return raw;
    return `${raw.slice(separator + 2)}::${raw.slice(0, separator)}`;
}
export function stripClassPrefix(name: string): string {
    const separator = name.indexOf('::');
    return separator === -1 ? name : name.slice(separator + 2);
}
export class FbxProperties {
    private readonly values = new Map<string, FbxValue[]>();
    static fromNode(node: FbxNode | null): FbxProperties {
        const properties = new FbxProperties();
        if (!node)
            return properties;
        const block70 = findChild(node, 'Properties70');
        if (block70) {
            for (const entry of findChildren(block70, 'P'))
                properties.values.set(propString(entry, 0), entry.props.slice(4));
            return properties;
        }
        const block60 = findChild(node, 'Properties60');
        if (block60) {
            for (const entry of findChildren(block60, 'Property'))
                properties.values.set(propString(entry, 0), entry.props.slice(3));
        }
        return properties;
    }
    has(name: string): boolean {
        return this.values.has(name);
    }
    get names(): string[] {
        return Array.from(this.values.keys());
    }
    raw(name: string): FbxValue[] | undefined {
        return this.values.get(name);
    }
    number(name: string, fallback: number): number {
        const value = this.values.get(name)?.[0];
        if (typeof value === 'number')
            return value;
        if (typeof value === 'boolean')
            return value ? 1 : 0;
        return fallback;
    }
    bool(name: string, fallback: boolean): boolean {
        const value = this.values.get(name)?.[0];
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value !== 0;
        return fallback;
    }
    string(name: string, fallback = ''): string {
        const value = this.values.get(name)?.[0];
        return typeof value === 'string' ? value : fallback;
    }
    vector3(out: Vec3, name: string, fallback: Vec3): Vec3 {
        const values = this.values.get(name);
        if (!values || values.length < 3 || values.slice(0, 3).some((value) => typeof value !== 'number'))
            return vec3.copy(out, fallback);
        return vec3.set(out, values[0] as number, values[1] as number, values[2] as number);
    }
}
