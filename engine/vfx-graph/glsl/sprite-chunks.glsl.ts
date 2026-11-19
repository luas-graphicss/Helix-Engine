export const SPRITE_SHAPES = ['soft', 'disc', 'spark', 'smoke', 'ring', 'streak', 'square'] as const;
export type SpriteShape = (typeof SPRITE_SHAPES)[number];
export const SPRITE_MASK: Record<SpriteShape, string> = {
    soft: 'pow(max(1.0 - reach * reach, 0.0), 2.0)',
    disc: '1.0 - smoothstep(0.86, 1.0, reach)',
    spark: 'clamp(pow(max(1.0 - reach, 0.0), 4.0) * 1.5 + pow(max(1.0 - 24.0 * abs(uv.x * uv.y), 0.0), 2.0) * max(1.0 - reach, 0.0), 0.0, 1.0)',
    smoke: 'pow(max(1.0 - reach * reach, 0.0), 1.5) * smoothstep(0.15, 0.75, vfxPuffNoise(uv * 2.2 + v_seed * 37.0) + (1.0 - reach) * 0.55)',
    ring: 'exp(-pow((reach - 0.78) / 0.09, 2.0))',
    streak: '(1.0 - smoothstep(0.0, 1.0, abs(uv.x))) * (1.0 - uv.y * uv.y)',
    square: '1.0',
};
export const SPRITE_NOISE = `float vfxCellHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float vfxValueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 blend = fract(p);
    blend = blend * blend * (3.0 - 2.0 * blend);
    float low = mix(vfxCellHash(cell), vfxCellHash(cell + vec2(1.0, 0.0)), blend.x);
    float high = mix(vfxCellHash(cell + vec2(0.0, 1.0)), vfxCellHash(cell + vec2(1.0, 1.0)), blend.x);
    return mix(low, high, blend.y);
}
float vfxPuffNoise(vec2 p) {
    return vfxValueNoise(p) * 0.6 + vfxValueNoise(p * 2.3 + 11.7) * 0.4;
}`;
export const RENDER_HELPERS = `float vfxRamp(float from, float to, float t) {
    return clamp((t - from) / max(to - from, 1e-5), 0.0, 1.0);
}
vec4 vfxGradient(vec4 stops, vec4 c0, vec4 c1, vec4 c2, vec4 c3, float t) {
    vec4 color = mix(c0, c1, vfxRamp(stops.x, stops.y, t));
    color = mix(color, c2, vfxRamp(stops.y, stops.z, t));
    return mix(color, c3, vfxRamp(stops.z, stops.w, t));
}
float vfxHashFloat(float x) {
    uint bits = floatBitsToUint(x);
    bits ^= bits >> 16;
    bits *= 0x7feb352du;
    bits ^= bits >> 15;
    bits *= 0x846ca68bu;
    bits ^= bits >> 16;
    return float(bits) / 4294967296.0;
}`;
