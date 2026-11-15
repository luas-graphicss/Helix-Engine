import { hexToLinearRgb } from '@/engine/core/color/srgb';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { ToolFailure } from './tool-failure';
import type { ToolInput } from './tool-input';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
export const HEX_COLOR_HINT = 'sRGB hex color like #3fa9f5.';
export function optionalHexColor(input: ToolInput, key: string): string | undefined {
    const value = input.optionalText(key)?.trim();
    if (value === undefined)
        return undefined;
    if (!HEX_COLOR.test(value))
        throw new ToolFailure(`"${key}" must be a hex color like #3fa9f5.`);
    return value;
}
export function optionalLinearColor(input: ToolInput, key: string): Vec3 | undefined {
    const hex = optionalHexColor(input, key);
    return hex === undefined ? undefined : hexToLinearRgb(vec3.create(), hex);
}
