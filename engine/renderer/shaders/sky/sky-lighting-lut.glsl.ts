import { ATMOSPHERE_CHUNK, SKY_LIGHTING_TEXEL } from './atmosphere.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_LIGHTING, HDR_RANGE_SKY } from '../chunks/hdr-encoding.glsl';
export const SKY_LIGHTING_LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_skyViewLut;
uniform sampler2D u_transmittanceLut;
uniform vec3 u_sunDirection;
uniform vec3 u_moonDirection;
uniform vec3 u_sunIrradiance;
uniform vec3 u_moonIrradiance;

${ATMOSPHERE_CHUNK}
${HDR_ENCODING_CHUNK}

const int AZIMUTH_SAMPLES = 24;
const int ELEVATION_SAMPLES = 8;

out vec4 fragColor;

 
vec3 skyIrradianceOverPi() {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ELEVATION_SAMPLES; i++) {
    float u1 = (float(i) + 0.5) / float(ELEVATION_SAMPLES);
    float sinTheta = sqrt(u1);
    float cosTheta = sqrt(1.0 - u1);
    for (int j = 0; j < AZIMUTH_SAMPLES; j++) {
      float phi = 2.0 * PI * (float(j) + 0.5) / float(AZIMUTH_SAMPLES);
      vec3 dir = vec3(sinTheta * cos(phi), cosTheta, sinTheta * sin(phi));
      sum += decodeHdr(texture(u_skyViewLut, skyViewUv(dir)), ${HDR_RANGE_SKY}.0).rgb;
    }
  }
  return sum / float(ELEVATION_SAMPLES * AZIMUTH_SAMPLES);
}

void main() {
  int texel = int(gl_FragCoord.x);
  vec3 observer = vec3(0.0, PLANET_RADIUS_KM + OBSERVER_ALTITUDE_KM, 0.0);
  vec3 sunTransmittance = transmittanceToLight(u_transmittanceLut, observer, u_sunDirection);
  vec3 moonTransmittance = transmittanceToLight(u_transmittanceLut, observer, u_moonDirection);

  vec3 value;
  if (texel == ${SKY_LIGHTING_TEXEL.sunTransmittance}) {
    value = sunTransmittance;
  } else if (texel == ${SKY_LIGHTING_TEXEL.moonTransmittance}) {
    value = moonTransmittance;
  } else {
    vec3 sky = skyIrradianceOverPi();
    if (texel == ${SKY_LIGHTING_TEXEL.skyIrradiance}) {
      value = sky;
    } else {
      vec3 horizontalIrradiance = sky * PI
        + u_sunIrradiance * sunTransmittance * max(u_sunDirection.y, 0.0)
        + u_moonIrradiance * moonTransmittance * max(u_moonDirection.y, 0.0);
      value = GROUND_ALBEDO * horizontalIrradiance / PI;
    }
  }

  fragColor = encodeHdr(value, 1.0, ${HDR_RANGE_LIGHTING}.0);
}
`;
