import * as vec3 from '@/engine/core/math/vec3';
import { createMaterial, type Material } from '@/engine/core/scene/material';
type Rgb = readonly [
    number,
    number,
    number
];
const CONCRETE: Rgb = [0.64, 0.65, 0.68];
const PLASTER: Rgb = [0.8, 0.78, 0.74];
const STONE: Rgb = [0.5, 0.47, 0.43];
const ACCENT: Rgb = [0.16, 0.4, 0.76];
const CRATE: Rgb = [0.76, 0.54, 0.3];
export function concrete(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...CONCRETE), roughness: 0.88 });
}
export function plaster(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...PLASTER), roughness: 0.92 });
}
export function stone(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...STONE), roughness: 0.96 });
}
export function accent(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...ACCENT), roughness: 0.45 });
}
export function crate(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...CRATE), roughness: 0.75 });
}
