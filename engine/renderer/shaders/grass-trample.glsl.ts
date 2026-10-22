const BEND_CHUNK = `
vec2 decodeBend(vec4 texel) {
  return texel.xy * 2.0 - 1.0;
}

vec4 encodeBend(vec2 bend) {
  return vec4(bend * 0.5 + 0.5, 0.0, 1.0);
}


vec2 recoverBend(vec2 bend, float step) {
  float len = length(bend);
  if (len <= step) return vec2(0.0);
  return bend * ((len - step) / len);
}
`;
export const GRASS_TRAMPLE_RECOVER_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
export const GRASS_TRAMPLE_RECOVER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_previous;

uniform float u_recovery;

out vec4 fragColor;

${BEND_CHUNK}

void main() {
  vec2 bend = decodeBend(texelFetch(u_previous, ivec2(gl_FragCoord.xy), 0));
  fragColor = encodeBend(recoverBend(bend, u_recovery));
}
`;
export const GRASS_TRAMPLE_STAMP_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_corner;

layout(location = 1) in vec4 a_placement;

layout(location = 2) in vec4 a_footprint;

layout(location = 3) in vec3 a_push;


uniform float u_halfSize;

out vec2 v_local;
flat out vec4 v_placement;
flat out vec4 v_footprint;
flat out vec3 v_push;

void main() {
  vec2 reach = a_footprint.xy + a_footprint.w;
  vec2 p = a_corner * reach;
  vec2 fx = a_placement.zw;
  vec2 fz = vec2(-fx.y, fx.x);
  vec2 local = a_placement.xy + fx * p.x + fz * p.y;

  v_local = p;
  v_placement = a_placement;
  v_footprint = a_footprint;
  v_push = a_push;
  gl_Position = vec4(local / u_halfSize, 0.0, 1.0);
}
`;
export const GRASS_TRAMPLE_STAMP_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_local;
flat in vec4 v_placement;
flat in vec4 v_footprint;
flat in vec3 v_push;

uniform sampler2D u_previous;
uniform float u_recovery;

out vec4 fragColor;

${BEND_CHUNK}

void main() {
  vec2 extents = v_footprint.xy;
  float rounding = v_footprint.z;
  float feather = v_footprint.w;


  vec2 q = abs(v_local) - (extents - rounding);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rounding;
  float weight = 1.0 - smoothstep(0.0, feather, d);
  if (weight <= 0.0) discard;


  vec2 away = d > 0.0 ? sign(v_local) * max(q, 0.0) : v_local;
  float awayLength = length(away);
  away = awayLength > 1e-4 ? away / awayLength : vec2(0.0, 1.0);
  vec2 fx = v_placement.zw;
  vec2 fz = vec2(-fx.y, fx.x);
  vec2 outward = fx * away.x + fz * away.y;


  vec2 push = v_push.xy;
  float pushing = min(length(push), 1.0);
  vec2 direction = normalize(outward * (1.0 - 0.5 * pushing) + push + vec2(1e-5, 0.0));
  vec2 stamp = direction * (weight * v_push.z);

  vec2 previous = recoverBend(decodeBend(texelFetch(u_previous, ivec2(gl_FragCoord.xy), 0)), u_recovery);
  float keepStamp = smoothstep(-0.1, 0.1, length(stamp) - length(previous));
  fragColor = encodeBend(mix(previous, stamp, keepStamp));
}
`;
