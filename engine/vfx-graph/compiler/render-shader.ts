import { RENDER_HELPERS, SPRITE_MASK, SPRITE_NOISE, type SpriteShape } from '../glsl/sprite-chunks.glsl';
import { indentBlocks } from './simulation-shader';
export const SPRITE_ORIENTATIONS = ['camera', 'ground', 'velocity'] as const;
export type SpriteOrientation = (typeof SPRITE_ORIENTATIONS)[number];
export const EFFECT_BLENDS = ['additive', 'alpha'] as const;
export type EffectBlend = (typeof EFFECT_BLENDS)[number];
export interface RenderShaderParts {
    readonly declarations: string;
    readonly body: readonly string[];
    readonly orientation: SpriteOrientation;
    readonly shape: SpriteShape;
    readonly blend: EffectBlend;
    readonly intensity: string;
}
const ROTATED_CORNER = `float turnCos = cos(rotation);
    float turnSin = sin(rotation);
    vec2 corner = vec2(a_corner.x * turnCos - a_corner.y * turnSin, a_corner.x * turnSin + a_corner.y * turnCos) * size * 0.5;`;
const ORIENTATION_CODE: Record<SpriteOrientation, string> = {
    camera: `${ROTATED_CORNER}
    vec4 viewCenter = u_view * vec4(position, 1.0);
    viewCenter.xy += corner;
    gl_Position = u_projection * viewCenter;`,
    ground: `${ROTATED_CORNER}
    gl_Position = u_projection * u_view * vec4(position + vec3(corner.x, 0.0, corner.y), 1.0);`,
    velocity: `vec4 viewCenter = u_view * vec4(position, 1.0);
    vec2 viewVelocity = (u_view * vec4(velocity, 0.0)).xy;
    float viewSpeed = length(viewVelocity);
    vec2 along = viewSpeed > 1e-5 ? viewVelocity / viewSpeed : vec2(0.0, 1.0);
    vec2 across = vec2(-along.y, along.x);
    viewCenter.xy += along * a_corner.y * (size + viewSpeed * stretch) * 0.5 + across * a_corner.x * size * 0.5;
    gl_Position = u_projection * viewCenter;`,
};
const FRAGMENT_OUTPUT: Record<EffectBlend, string> = {
    additive: 'fragColor = vec4(light * alpha, 0.0);',
    alpha: 'fragColor = vec4(light * alpha, alpha);',
};
const BODY_INDENT = '    ';
export function writeRenderShaders({ declarations, body, orientation, shape, blend, intensity }: RenderShaderParts): {
    vertex: string;
    fragment: string;
} {
    const vertex = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_positionAge;
layout(location = 2) in vec4 a_velocityLife;
layout(location = 3) in vec4 a_color;
layout(location = 4) in vec4 a_shape;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform float u_time;
${declarations}
out vec2 v_uv;
out vec4 v_color;
out float v_seed;
${RENDER_HELPERS}
void main() {
    float age = a_positionAge.w;
    float lifetime = a_velocityLife.w;
    if (age >= lifetime) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    float life = clamp(age / max(lifetime, 1e-4), 0.0, 1.0);
    vec3 position = a_positionAge.xyz;
    vec3 velocity = a_velocityLife.xyz;
    vec4 color = a_color;
    float size = a_shape.x;
    float rotation = a_shape.y;
    float seed = a_shape.w;
    float stretch = 0.0;
    float time = u_time;
${indentBlocks(body, BODY_INDENT)}
    ${ORIENTATION_CODE[orientation]}
    v_uv = a_corner;
    v_color = color;
    v_seed = seed;
}
`;
    const fragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
in vec4 v_color;
in float v_seed;
${declarations}
out vec4 fragColor;
${SPRITE_NOISE}
void main() {
    vec2 uv = v_uv;
    float reach = length(uv);
    float alpha = clamp(v_color.a, 0.0, 1.0) * (${SPRITE_MASK[shape]});
    if (alpha <= 0.002)
        discard;
    vec3 light = max(v_color.rgb, 0.0) * ${intensity};
    ${FRAGMENT_OUTPUT[blend]}
}
`;
    return { vertex, fragment };
}
