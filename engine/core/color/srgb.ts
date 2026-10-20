import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
export function srgbToLinear(channel: number): number {
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
export function linearToSrgb(channel: number): number {
    return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}
export function hexToLinearRgb(out: Vec3, hex: string): Vec3 {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match)
        return vec3.set(out, 0, 0, 0);
    const value = Number.parseInt(match[1], 16);
    return vec3.set(out, srgbToLinear(((value >> 16) & 0xff) / 255), srgbToLinear(((value >> 8) & 0xff) / 255), srgbToLinear((value & 0xff) / 255));
}
export function linearRgbToHex(rgb: Vec3): string {
    const toByte = (channel: number) => Math.round(clamp(linearToSrgb(channel), 0, 1) * 255);
    return `#${[toByte(rgb[0]), toByte(rgb[1]), toByte(rgb[2])].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function linearRgbToCss(rgb: Vec3): string {
    return `color(srgb-linear ${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}
