export const SCREEN_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
export const TONEMAP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
out vec4 fragColor;
void main() {
    vec3 hdr = texture(u_scene, v_uv).rgb;
    vec3 mapped = (hdr * (2.51 * hdr + 0.03)) / (hdr * (2.43 * hdr + 0.59) + 0.14);
    fragColor = vec4(pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
`;
export const GROUND_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_corner;
uniform mat4 u_viewProjection;
uniform float u_extent;
out vec2 v_ground;
void main() {
    v_ground = a_corner * u_extent;
    gl_Position = u_viewProjection * vec4(v_ground.x, 0.0, v_ground.y, 1.0);
}
`;
export const GROUND_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_ground;
uniform float u_extent;
out vec4 fragColor;
void main() {
    vec2 toLine = abs(fract(v_ground - 0.5) - 0.5) / fwidth(v_ground);
    float line = 1.0 - min(min(toLine.x, toLine.y), 1.0);
    float fade = 1.0 - smoothstep(u_extent * 0.2, u_extent * 0.9, length(v_ground));
    fragColor = vec4(vec3(line * fade * 0.07), 0.0);
}
`;
