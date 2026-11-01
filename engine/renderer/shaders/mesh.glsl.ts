import { DEBUG_VIEW_CHUNK } from './chunks/debug-view.glsl';
import { HDR_ENCODING_CHUNK, HDR_RANGE_SCENE } from './chunks/hdr-encoding.glsl';
import { MESH_VARYINGS_IN, MESH_VARYINGS_OUT } from './chunks/mesh-varyings.glsl';
import { NORMAL_MAPPING_CHUNK } from './chunks/normal-mapping.glsl';
import { SCENE_LIGHTING_CHUNK } from './chunks/scene-lighting.glsl';
import { SKINNING_CHUNK } from './chunks/skinning.glsl';
import { SHADER_SOURCE_ENGINE, SHADER_SOURCE_USER, standardUniformLines, SURFACE_SHADER_ALIASES, SURFACE_SHADER_STRUCT, SURFACE_STRUCT_NAME } from './custom/custom-shader.glsl';
export const MESH_VERTEX_SHADER = `#version 300 es
precision highp float;
                                                                                                        
invariant gl_Position;
                                                                                                                         
const float WIREFRAME_DEPTH_BIAS = 3e-5;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in mat4 a_model;
layout(location = 7) in vec3 a_normalMatrix0;
layout(location = 8) in vec3 a_normalMatrix1;
layout(location = 9) in vec3 a_normalMatrix2;
                                            
layout(location = 10) in vec4 a_baseColorOpacity;
                                                                                   
layout(location = 11) in vec4 a_surface;
                                                
layout(location = 12) in vec4 a_emissiveCutoff;
                                                                                            
layout(location = 13) in vec4 a_mapParams;
                                                               
layout(location = 15) in vec4 a_tangent;

uniform mat4 u_viewProjection;

#ifdef SKINNED
${SKINNING_CHUNK}
#endif

${MESH_VARYINGS_OUT}

void main() {
#ifdef SKINNED
                                                                                                            
  mat4 skin = skinMatrix();
  vec4 worldPosition = skin * vec4(a_position, 1.0);
  v_worldNormal = vec4(normalize(mat3(skin) * a_normal), a_tangent.w);
  v_worldTangent = mat3(skin) * a_tangent.xyz;
#else
  vec4 worldPosition = a_model * vec4(a_position, 1.0);
  v_worldNormal = vec4(mat3(a_normalMatrix0, a_normalMatrix1, a_normalMatrix2) * a_normal, a_tangent.w);
  v_worldTangent = mat3(a_model) * a_tangent.xyz;
#endif
  v_worldPosition = worldPosition.xyz;
                                                                                       
  v_uv = a_uv * a_mapParams.w;
  packMeshMaterial(a_baseColorOpacity, a_surface, a_emissiveCutoff, a_mapParams, uint(gl_VertexID));
  gl_Position = u_viewProjection * worldPosition;
#ifdef WIREFRAME
  gl_Position.z -= WIREFRAME_DEPTH_BIAS * gl_Position.w;
#endif
}
`;
export const MESH_WIREFRAME_FRAGMENT_SHADER = `#version 300 es
precision highp float;

${HDR_ENCODING_CHUNK}

out vec4 fragColor;

void main() {
  fragColor = encodeHdr(vec3(0.002), 1.0, ${HDR_RANGE_SCENE}.0);
}
`;
export function meshFragmentShader(surface: string | null = null): string {
    const hook = surface === null ? null : surfaceHook(surface);
    return `#version 300 es
precision highp float;

${MESH_VARYINGS_IN}

                                                                    
uniform float u_alphaMode;
uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_occlusionMap;
uniform sampler2D u_emissiveMap;
                                                                                                        
uniform int u_textureMask;
                                                                                          
uniform int u_debugView;

${SCENE_LIGHTING_CHUNK}
${NORMAL_MAPPING_CHUNK}
${DEBUG_VIEW_CHUNK}
${hook ? hook.declarations : ''}
const int MAP_BASE_COLOR = 1;
const int MAP_METALLIC_ROUGHNESS = 2;
const int MAP_NORMAL = 4;
const int MAP_OCCLUSION = 8;
const int MAP_EMISSIVE = 16;

bool hasMap(int bit) {
  return (u_textureMask & bit) != 0;
}

   
                                                                                
                                                                           
                                                                             
   
vec3 debugViewColor(vec3 N) {
  vec3 color;
  if (u_debugView == DEBUG_VIEW_NORMALS) {
    color = displayColorToSceneHdr(normalDebugColor(N));
  } else {
    color = u_debugView == DEBUG_VIEW_TRIANGLES ? hashColor(meshTriangleSeed() * 131u + 7u) : CLASSIC_MESH_DEBUG_COLOR;
    color = shadeDebugColor(color, N, u_sunDirection);
                                                                                                             
    color = displayColorToSceneHdr(color);
    color = mix(color, SELECTION_TINT_HDR, meshSelected() * 0.35);
  }
  return sceneColorOutput(color, 1.0).rgb;
}

out vec4 fragColor;

void main() {
                                                                                             
  vec3 positionDx = dFdx(v_worldPosition);
  vec3 positionDy = dFdy(v_worldPosition);
  vec3 geometricN = normalize(v_worldNormal.xyz);
  vec3 normalDx = dFdx(geometricN);
  vec3 normalDy = dFdy(geometricN);

  vec3 baseColor = meshBaseColor();
  float alpha = meshOpacity();
  if (hasMap(MAP_BASE_COLOR)) {
    vec4 baseSample = texture(u_baseColorMap, v_uv);
    baseColor *= baseSample.rgb;
    alpha *= baseSample.a;
  }
${hook ? '' : '  if (u_alphaMode > 0.5 && u_alphaMode < 1.5 && alpha < meshAlphaCutoff()) discard;\n'}
  vec2 roughnessMetallic = meshRoughnessMetallic();
  float roughness = roughnessMetallic.x;
  float metallic = roughnessMetallic.y;
  if (hasMap(MAP_METALLIC_ROUGHNESS)) {
    vec4 metallicRoughness = texture(u_metallicRoughnessMap, v_uv);
    roughness *= metallicRoughness.g;
    metallic *= metallicRoughness.b;
  }

  TangentFrame frame = tangentFrame(geometricN, meshWorldTangent(), gl_FrontFacing);
  vec3 N = frame.N;
  if (u_debugView != DEBUG_VIEW_NONE) {
    fragColor = vec4(debugViewColor(N), 1.0);
    return;
  }
  float roughnessVariance = geometricRoughnessVariance(normalDx, normalDy);
  if (hasMap(MAP_NORMAL)) N = perturbNormal(frame, texture(u_normalMap, v_uv).xyz, meshNormalScale(), roughnessVariance);

  float occlusion = 1.0;
  if (hasMap(MAP_OCCLUSION)) occlusion = 1.0 + meshOcclusionStrength() * (texture(u_occlusionMap, v_uv).r - 1.0);

  vec3 emissive = meshEmissive() * meshEmissiveIntensity();
  if (hasMap(MAP_EMISSIVE)) emissive *= texture(u_emissiveMap, v_uv).rgb;
${hook ? hook.call : ''}
  Surface s = makeSurface(N, v_worldPosition, baseColor, filteredRoughness(roughness, roughnessVariance), metallic);
  s.geometricN = frame.N;
  vec3 hdr = shadeSurface(s, v_worldPosition, positionDx, positionDy, occlusion, emissive, meshReceiveShadows());
  fragColor = vec4(finishSurfaceColor(hdr, s, meshSelected()), u_alphaMode > 1.5 ? alpha : 1.0);
}
`;
}
export const MESH_FRAGMENT_SHADER = meshFragmentShader(null);
function surfaceHook(surface: string): {
    declarations: string;
    call: string;
} {
    const declared = declaredNames(surface);
    const declarations = [
        declared.has(SURFACE_STRUCT_NAME) ? '' : SURFACE_SHADER_STRUCT,
        standardUniformLines('surface', declared),
        SURFACE_SHADER_ALIASES,
        `#line 1 ${SHADER_SOURCE_USER}`,
        surface,
        `#line 1 ${SHADER_SOURCE_ENGINE}`,
    ].join('\n');
    const call = `
  HelixSurface hs;
  hs.baseColor = baseColor;
  hs.alpha = alpha;
  hs.roughness = roughness;
  hs.metallic = metallic;
  hs.normal = N;
  hs.occlusion = occlusion;
  hs.emissive = emissive;
  hs.worldPosition = v_worldPosition;
  hs.uv = v_uv;
  hs.viewDirection = normalize(u_cameraPosition - v_worldPosition);
  hs.frontFacing = gl_FrontFacing;
  surface(hs);
  baseColor = hs.baseColor;
  alpha = hs.alpha;
  roughness = hs.roughness;
  metallic = hs.metallic;
  N = normalize(hs.normal);
  occlusion = hs.occlusion;
  emissive = hs.emissive;
  if (u_alphaMode > 0.5 && u_alphaMode < 1.5 && alpha < meshAlphaCutoff()) discard;
`;
    return { declarations, call };
}
export function declaredNames(source: string): Set<string> {
    const names = new Set<string>();
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
    const pattern = /\b(?:uniform|in|out)\b\s+(?:(?:lowp|mediump|highp|flat|smooth|centroid)\s+)*\w+\s+([^;{]+);/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) {
        for (const part of match[1].split(',')) {
            const name = part.trim().replace(/\[.*$/, '').replace(/\s*=.*$/, '').trim();
            if (name)
                names.add(name);
        }
    }
    const structs = /\bstruct\s+(\w+)\s*\{/g;
    while ((match = structs.exec(stripped)) !== null)
        names.add(match[1]);
    return names;
}
