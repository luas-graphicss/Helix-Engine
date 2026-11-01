export const GRID_FADE_START_FRACTION = 0.08;
export const GRID_FADE_END_FRACTION = 0.35;
export const GRID_VERTEX_SHADER = `#version 300 es
precision highp float;

const float GRID_DEPTH_BIAS_METERS = 0.004;

layout(location = 0) in vec2 a_position;

uniform mat4 u_viewProjection;
uniform vec3 u_cameraPosition;
uniform float u_extent;

out vec3 v_worldPos;

void main() {
  vec3 worldPos = vec3(u_cameraPosition.x + a_position.x * u_extent, GRID_DEPTH_BIAS_METERS, u_cameraPosition.z + a_position.y * u_extent);
  v_worldPos = worldPos;
  gl_Position = u_viewProjection * vec4(worldPos, 1.0);
}
`;
export const GRID_FRAGMENT_SHADER = `#version 300 es
precision highp float;

const float FADE_START = ${GRID_FADE_START_FRACTION.toFixed(3)};
const float FADE_END = ${GRID_FADE_END_FRACTION.toFixed(3)};

in vec3 v_worldPos;

uniform vec3 u_cameraPosition;
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
  vec3 worldPos = v_worldPos;

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

  vec3 toPixel = worldPos - u_cameraPosition;
  float distanceToCamera = length(toPixel);
  float fade = 1.0 - smoothstep(u_far * FADE_START, u_far * FADE_END, distanceToCamera);

                                                     
  float grazing = clamp(abs(toPixel.y / max(distanceToCamera, 1e-4)) * 3.0, 0.0, 1.0);

  fragColor = vec4(color, alpha * fade * grazing);
}
`;
