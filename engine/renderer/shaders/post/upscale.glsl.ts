export const UPSCALE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_color;
uniform vec2 u_outputTexel;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy * u_outputTexel;
  fragColor = vec4(texture(u_color, uv).rgb, 1.0);
}
`;
