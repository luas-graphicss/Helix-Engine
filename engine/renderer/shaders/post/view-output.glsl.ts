export const VIEW_OUTPUT_BACKDROP = 0;
export const VIEW_OUTPUT_COVERAGE = 1;
export const VIEW_OUTPUT_DEPTH = 2;
export const VIEW_OUTPUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D u_depth;
uniform vec2 u_inverseResolution;
uniform vec4 u_color;
uniform vec3 u_clip;
uniform int u_mode;

out vec4 fragColor;

float linearDepth(float sampled) {
  if (u_clip.z > 0.5) return mix(u_clip.x, u_clip.y, sampled);
  float ndc = sampled * 2.0 - 1.0;
  return (2.0 * u_clip.x * u_clip.y) / (u_clip.y + u_clip.x - ndc * (u_clip.y - u_clip.x));
}

void main() {
  float sampled = texture(u_depth, gl_FragCoord.xy * u_inverseResolution).r;
  if (u_mode == ${VIEW_OUTPUT_DEPTH}) {
    float normalized = clamp((linearDepth(sampled) - u_clip.x) / (u_clip.y - u_clip.x), 0.0, 1.0);
    fragColor = vec4(vec3(normalized), 1.0);
    return;
  }
  if (u_mode == ${VIEW_OUTPUT_COVERAGE}) {
    fragColor = vec4(0.0, 0.0, 0.0, sampled < 1.0 ? 1.0 : 0.0);
    return;
  }
  if (sampled < 1.0) discard;
  fragColor = u_color;
}
`;
