export const MESH_VARYINGS_OUT = `
out vec3 v_worldPosition;
                                                                                         
out vec4 v_worldNormal;
                                                     
out vec3 v_worldTangent;
out vec2 v_uv;
flat out highp uvec4 v_materialA;
flat out highp uvec4 v_materialB;

void packMeshMaterial(vec4 baseColorOpacity, vec4 surface, vec4 emissiveCutoff, vec4 mapParams, uint triangleSeed) {
  v_materialA = uvec4(
    packHalf2x16(baseColorOpacity.rg),
    packHalf2x16(baseColorOpacity.ba),
    packHalf2x16(surface.xy),
    packHalf2x16(vec2(surface.z, emissiveCutoff.a)));
  v_materialB = uvec4(
    packHalf2x16(emissiveCutoff.rg),
    packHalf2x16(vec2(emissiveCutoff.b, mapParams.x)),
    packHalf2x16(mapParams.yz),
    (triangleSeed << 1u) | uint(surface.w > 0.5));
}
`;
export const MESH_VARYINGS_IN = `
in vec3 v_worldPosition;
in vec4 v_worldNormal;
in vec3 v_worldTangent;
in vec2 v_uv;
                                                                                  
flat in highp uvec4 v_materialA;
flat in highp uvec4 v_materialB;

vec3 meshBaseColor() { return vec3(unpackHalf2x16(v_materialA.x), unpackHalf2x16(v_materialA.y).x); }
float meshOpacity() { return unpackHalf2x16(v_materialA.y).y; }
                                     
vec2 meshRoughnessMetallic() { return unpackHalf2x16(v_materialA.z); }
float meshEmissiveIntensity() { return unpackHalf2x16(v_materialA.w).x; }
float meshAlphaCutoff() { return unpackHalf2x16(v_materialA.w).y; }
vec3 meshEmissive() { return vec3(unpackHalf2x16(v_materialB.x), unpackHalf2x16(v_materialB.y).x); }
float meshNormalScale() { return unpackHalf2x16(v_materialB.y).y; }
float meshOcclusionStrength() { return unpackHalf2x16(v_materialB.z).x; }
float meshSelected() { return unpackHalf2x16(v_materialB.z).y; }
float meshReceiveShadows() { return float(v_materialB.w & 1u); }
                                                                                                               
uint meshTriangleSeed() { return v_materialB.w >> 1u; }
                                                                   
vec4 meshWorldTangent() { return vec4(v_worldTangent, v_worldNormal.w); }
`;
