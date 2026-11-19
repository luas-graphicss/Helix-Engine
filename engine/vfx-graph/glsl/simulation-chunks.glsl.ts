export const SIMULATION_HELPERS = `uint g_seed;
uint vfxHash(uint x) {
    x ^= x >> 16;
    x *= 0x7feb352du;
    x ^= x >> 15;
    x *= 0x846ca68bu;
    x ^= x >> 16;
    return x;
}
float vfxRand(uint salt) {
    return float(vfxHash(g_seed + salt * 0x9e3779b9u)) / 4294967296.0;
}
vec3 vfxRandomVec3(uint salt) {
    return vec3(vfxRand(salt), vfxRand(salt + 1u), vfxRand(salt + 2u));
}
vec3 vfxRandomDirection(uint salt) {
    float height = vfxRand(salt) * 2.0 - 1.0;
    float turn = vfxRand(salt + 1u) * 6.2831853;
    float ring = sqrt(max(1.0 - height * height, 0.0));
    return vec3(ring * cos(turn), height, ring * sin(turn));
}
vec3 vfxRandomInSphere(uint salt) {
    return vfxRandomDirection(salt) * pow(vfxRand(salt + 2u), 1.0 / 3.0);
}
float vfxHashFloat(float x) {
    return float(vfxHash(floatBitsToUint(x))) / 4294967296.0;
}
float vfxZigzag(float x) {
    float cell = floor(x);
    return mix(vfxHashFloat(cell), vfxHashFloat(cell + 1.0), x - cell);
}
vec3 vfxFlow(vec3 p) {
    return vec3(
        sin(p.y * 1.31 + sin(p.z * 0.73)) + cos(p.z * 1.87 + p.x * 0.41),
        sin(p.z * 1.17 + sin(p.x * 0.91)) + cos(p.x * 1.53 + p.y * 0.37),
        sin(p.x * 1.43 + sin(p.y * 0.61)) + cos(p.y * 1.69 + p.z * 0.47)) * 0.5;
}
vec3 vfxTurbulence(vec3 p) {
    return vfxFlow(p) + vfxFlow(p * 2.03 + 7.1) * 0.5;
}`;
