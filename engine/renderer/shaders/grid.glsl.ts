export const GRID_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

uniform mat4 u_inverseViewProjection;

out vec3 v_nearPoint;
out vec3 v_farPoint;

vec3 unproject(vec2 ndc, float depth) {
  vec4 point = u_inverseViewProjection * vec4(ndc, depth, 1.0);
  return point.xyz / point.w;
}

void main() {
  v_nearPoint = unproject(a_position, -1.0);
  v_farPoint = unproject(a_position, 1.0);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
export const GRID_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_nearPoint;
in vec3 v_farPoint;

uniform mat4 u_viewProjection;
uniform vec3 u_cameraPosition;
uniform float u_near;
uniform float u_far;

out vec4 fragColor;

float gridLine(vec2 coord, float cellSize) {
  vec2 scaled = coord / cellSize;
  vec2 derivative = fwidth(scaled);
  vec2 grid = abs(fract(scaled - 0.5) - 0.5) / derivative;
  return 1.0 - min(min(grid.x, grid.y), 1.0);
}

float axisLine(float coord, float width) {
  float derivative = fwidth(coord);
  return 1.0 - min(abs(coord) / (derivative * width), 1.0);
}

void main() {
  float t = -v_nearPoint.y / (v_farPoint.y - v_nearPoint.y);
  if (t < 0.0) discard;

  vec3 worldPos = v_nearPoint + t * (v_farPoint - v_nearPoint);

  vec4 clip = u_viewProjection * vec4(worldPos, 1.0);
  float ndcDepth = clip.z / clip.w;
  gl_FragDepth = ndcDepth * 0.5 + 0.5;

  float minorCell = 1.0;
  float majorCell = 10.0;
  float minor = gridLine(worldPos.xz, minorCell);
  float major = gridLine(worldPos.xz, majorCell);

  vec3 minorColor = vec3(0.30, 0.31, 0.34);
  vec3 majorColor = vec3(0.44, 0.45, 0.49);
  vec3 axisXColor = vec3(0.82, 0.26, 0.24);
  vec3 axisZColor = vec3(0.26, 0.48, 0.88);

  vec3 color = minorColor;
  float alpha = minor * 0.35;

  color = mix(color, majorColor, major);
  alpha = max(alpha, major * 0.7);

  float xAxis = axisLine(worldPos.z, 1.5);
  float zAxis = axisLine(worldPos.x, 1.5);
  color = mix(color, axisXColor, xAxis);
  color = mix(color, axisZColor, zAxis);
  alpha = max(alpha, max(xAxis, zAxis) * 0.95);

  float distanceToCamera = length(worldPos - u_cameraPosition);
  float fade = 1.0 - smoothstep(u_far * 0.08, u_far * 0.35, distanceToCamera);

   
  float grazing = clamp(abs(normalize(v_farPoint - v_nearPoint).y) * 3.0, 0.0, 1.0);

  fragColor = vec4(color, alpha * fade * grazing);
}
`;
