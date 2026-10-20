import { CLOUD_DENSITY_CHUNK } from '../chunks/cloud-density.glsl';
export const CLOUD_SHADOW_MAP_SIZE = 512;
export const CLOUD_SHADOW_FRAGMENT_SHADER = `#version 300 es
precision highp float;

 
uniform vec4 u_cloudShadowRegion;
uniform vec3 u_lightDirection;

${CLOUD_DENSITY_CHUNK}

const int SAMPLES = 6;
const float MAP_SIZE = ${CLOUD_SHADOW_MAP_SIZE}.0;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / MAP_SIZE;
  vec2 xz = u_cloudShadowRegion.xy + (uv - 0.5) / u_cloudShadowRegion.z;
  float slant = 1.0 / max(u_lightDirection.y, 0.2);
  float segment = u_cloudLayer.y / float(SAMPLES) * slant;

  float opticalDepth = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float heightFraction = (float(i) + 0.5) / float(SAMPLES);
    float altitude = u_cloudLayer.x + heightFraction * u_cloudLayer.y;
    vec2 p = xz + u_lightDirection.xz * ((altitude - u_cloudShadowRegion.w) * slant);
    opticalDepth += cloudBaseDensity(p, heightFraction) * u_cloudLayer.w * segment;
  }

  fragColor = vec4(vec3(exp(-opticalDepth)), 1.0);
}
`;
