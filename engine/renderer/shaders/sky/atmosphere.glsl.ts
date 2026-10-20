export const TRANSMITTANCE_LUT_SIZE = [256, 64] as const;
export const MULTI_SCATTERING_LUT_SIZE = [32, 32] as const;
export const SKY_VIEW_LUT_SIZE = [256, 128] as const;
export const SKY_LIGHTING_LUT_SIZE = [4, 1] as const;
export const SKY_LIGHTING_TEXEL = {
    skyIrradiance: 0,
    groundIrradiance: 1,
    sunTransmittance: 2,
    moonTransmittance: 3,
} as const;
export const ATMOSPHERE_CHUNK = `
const float PI = 3.14159265359;
const float PLANET_RADIUS_KM = 6360.0;
const float ATMOSPHERE_RADIUS_KM = 6420.0;
const float OBSERVER_ALTITUDE_KM = 0.002;
const vec3 RAYLEIGH_SCATTERING = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float RAYLEIGH_SCALE_HEIGHT = 8.0;
const float MIE_SCATTERING = 3.996e-3;
const float MIE_ABSORPTION = 4.4e-3;
const float MIE_SCALE_HEIGHT = 1.2;
const float MIE_ANISOTROPY = 0.8;
const vec3 OZONE_ABSORPTION = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const float OZONE_LAYER_CENTER = 25.0;
const float OZONE_LAYER_WIDTH = 15.0;
const vec3 GROUND_ALBEDO = vec3(0.3, 0.28, 0.25);

const vec2 TRANSMITTANCE_LUT_SIZE = vec2(${TRANSMITTANCE_LUT_SIZE[0]}.0, ${TRANSMITTANCE_LUT_SIZE[1]}.0);
const vec2 MULTI_SCATTERING_LUT_SIZE = vec2(${MULTI_SCATTERING_LUT_SIZE[0]}.0, ${MULTI_SCATTERING_LUT_SIZE[1]}.0);
const vec2 SKY_VIEW_LUT_SIZE = vec2(${SKY_VIEW_LUT_SIZE[0]}.0, ${SKY_VIEW_LUT_SIZE[1]}.0);

uniform float u_mieScale;

struct Medium {
  vec3 rayleigh;
  float mie;
  vec3 extinction;
};

Medium sampleMedium(float altitudeKm) {
  float h = max(altitudeKm, 0.0);
  float rayleighDensity = exp(-h / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-h / MIE_SCALE_HEIGHT) * u_mieScale;
  float ozoneDensity = max(0.0, 1.0 - abs(h - OZONE_LAYER_CENTER) / OZONE_LAYER_WIDTH);
  Medium m;
  m.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  m.mie = MIE_SCATTERING * mieDensity;
  m.extinction = m.rayleigh + vec3((MIE_SCATTERING + MIE_ABSORPTION) * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return m;
}

 
float raySphere(vec3 origin, vec3 dir, float radius) {
  float b = dot(origin, dir);
  float c = dot(origin, origin) - radius * radius;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float s = sqrt(discriminant);
  float tNear = -b - s;
  if (tNear > 0.0) return tNear;
  float tFar = -b + s;
  return tFar > 0.0 ? tFar : -1.0;
}

float phaseRayleigh(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

 
float phaseMie(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float base = 1.0 + g2 - 2.0 * g * cosTheta;
  float denominator = 8.0 * PI * (2.0 + g2) * base * sqrt(base);
  return numerator / denominator;
}

 
float unitToTexel(float x, float size) {
  return 0.5 / size + x * (1.0 - 1.0 / size);
}

 
vec2 transmittanceLutUv(float r, float mu) {
  float H = sqrt(ATMOSPHERE_RADIUS_KM * ATMOSPHERE_RADIUS_KM - PLANET_RADIUS_KM * PLANET_RADIUS_KM);
  float rho = sqrt(max(r * r - PLANET_RADIUS_KM * PLANET_RADIUS_KM, 0.0));
  float discriminant = r * r * (mu * mu - 1.0) + ATMOSPHERE_RADIUS_KM * ATMOSPHERE_RADIUS_KM;
  float d = max(-r * mu + sqrt(max(discriminant, 0.0)), 0.0);
  float dMin = ATMOSPHERE_RADIUS_KM - r;
  float dMax = rho + H;
  float xMu = (d - dMin) / (dMax - dMin);
  float xR = rho / H;
  return vec2(unitToTexel(xMu, TRANSMITTANCE_LUT_SIZE.x), unitToTexel(xR, TRANSMITTANCE_LUT_SIZE.y));
}

 
void transmittanceLutParams(vec2 unit, out float r, out float mu) {
  float H = sqrt(ATMOSPHERE_RADIUS_KM * ATMOSPHERE_RADIUS_KM - PLANET_RADIUS_KM * PLANET_RADIUS_KM);
  float rho = H * unit.y;
  r = sqrt(rho * rho + PLANET_RADIUS_KM * PLANET_RADIUS_KM);
  float dMin = ATMOSPHERE_RADIUS_KM - r;
  float dMax = rho + H;
  float d = dMin + unit.x * (dMax - dMin);
  mu = d == 0.0 ? 1.0 : (H * H - rho * rho - d * d) / (2.0 * r * d);
  mu = clamp(mu, -1.0, 1.0);
}

 
vec3 transmittanceToLight(sampler2D lut, vec3 p, vec3 lightDir) {
  float r = length(p);
  float mu = dot(p, lightDir) / r;
  if (mu < 0.0 && r * r * (1.0 - mu * mu) < PLANET_RADIUS_KM * PLANET_RADIUS_KM) return vec3(0.0);
  return texture(lut, transmittanceLutUv(r, mu)).rgb;
}

vec2 multiScatteringLutUv(float r, float muLight) {
  float altitude = (r - PLANET_RADIUS_KM) / (ATMOSPHERE_RADIUS_KM - PLANET_RADIUS_KM);
  return vec2(
    unitToTexel(clamp(muLight * 0.5 + 0.5, 0.0, 1.0), MULTI_SCATTERING_LUT_SIZE.x),
    unitToTexel(clamp(altitude, 0.0, 1.0), MULTI_SCATTERING_LUT_SIZE.y)
  );
}





vec2 skyViewUv(vec3 dir) {
  float elevation = asin(clamp(dir.y, -1.0, 1.0));
  float u = atan(dir.x, dir.z) / (2.0 * PI) + 0.5;
  float v = 0.5 + 0.5 * sign(elevation) * sqrt(abs(elevation) / (0.5 * PI));
  return vec2(u, unitToTexel(v, SKY_VIEW_LUT_SIZE.y));
}

 
vec3 skyViewDirection(float u, float vUnit) {
  float l = (vUnit - 0.5) * 2.0;
  float elevation = sign(l) * l * l * 0.5 * PI;
  float azimuth = (u - 0.5) * 2.0 * PI;
  float cosElevation = cos(elevation);
  return vec3(sin(azimuth) * cosElevation, sin(elevation), cos(azimuth) * cosElevation);
}
`;
