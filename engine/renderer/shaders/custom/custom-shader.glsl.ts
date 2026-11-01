export type ShaderModel = 'post' | 'surface';
export const SHADER_MODELS: readonly ShaderModel[] = ['post', 'surface'];
export const SHADER_MODEL_LABEL: Record<ShaderModel, string> = {
    post: 'pós-processamento',
    surface: 'superfície',
};
export type StandardShaderInput = 'time' | 'delta' | 'resolution' | 'near' | 'far' | 'view' | 'projection' | 'viewProjection' | 'inverseViewProjection' | 'cameraPosition' | 'sunDirection' | 'sunColor' | 'sceneColor' | 'sceneDepth';
export interface StandardShaderInputSpec {
    readonly input: StandardShaderInput;
    readonly glslName: string;
    readonly glslType: string;
    readonly wgslName: string;
    readonly wgslType: string;
    readonly description: string;
    readonly models: readonly ShaderModel[];
}
const BOTH: readonly ShaderModel[] = ['post', 'surface'];
const POST_ONLY: readonly ShaderModel[] = ['post'];
export const STANDARD_SHADER_INPUTS: readonly StandardShaderInputSpec[] = [
    { input: 'view', glslName: 'uView', glslType: 'mat4', wgslName: 'view', wgslType: 'mat4x4<f32>', description: 'Matriz de visão da câmera.', models: BOTH },
    { input: 'projection', glslName: 'uProjection', glslType: 'mat4', wgslName: 'projection', wgslType: 'mat4x4<f32>', description: 'Matriz de projeção da câmera.', models: BOTH },
    { input: 'viewProjection', glslName: 'uViewProjection', glslType: 'mat4', wgslName: 'viewProjection', wgslType: 'mat4x4<f32>', description: 'Projeção × visão.', models: BOTH },
    { input: 'inverseViewProjection', glslName: 'uInverseViewProjection', glslType: 'mat4', wgslName: 'inverseViewProjection', wgslType: 'mat4x4<f32>', description: 'Inversa de projeção × visão (tela → mundo).', models: BOTH },
    { input: 'cameraPosition', glslName: 'uCameraPosition', glslType: 'vec3', wgslName: 'cameraPosition', wgslType: 'vec3<f32>', description: 'Posição da câmera no mundo.', models: BOTH },
    { input: 'time', glslName: 'uTime', glslType: 'float', wgslName: 'time', wgslType: 'f32', description: 'Segundos desde o início da execução.', models: BOTH },
    { input: 'sunDirection', glslName: 'uSunDirection', glslType: 'vec3', wgslName: 'sunDirection', wgslType: 'vec3<f32>', description: 'Direção para o sol, normalizada.', models: BOTH },
    { input: 'delta', glslName: 'uDelta', glslType: 'float', wgslName: 'delta', wgslType: 'f32', description: 'Segundos do último frame.', models: BOTH },
    { input: 'sunColor', glslName: 'uSunColor', glslType: 'vec3', wgslName: 'sunColor', wgslType: 'vec3<f32>', description: 'Radiância do sol (linear).', models: BOTH },
    { input: 'near', glslName: 'uNear', glslType: 'float', wgslName: 'near', wgslType: 'f32', description: 'Plano próximo da câmera, em metros.', models: BOTH },
    { input: 'resolution', glslName: 'uResolution', glslType: 'vec2', wgslName: 'resolution', wgslType: 'vec2<f32>', description: 'Tamanho da imagem em pixels.', models: BOTH },
    { input: 'far', glslName: 'uFar', glslType: 'float', wgslName: 'far', wgslType: 'f32', description: 'Plano distante da câmera, em metros.', models: BOTH },
    { input: 'sceneColor', glslName: 'uSceneColor', glslType: 'sampler2D', wgslName: 'sceneColor', wgslType: 'texture_2d<f32>', description: 'Imagem de entrada do efeito (LDR, sRGB).', models: POST_ONLY },
    { input: 'sceneDepth', glslName: 'uSceneDepth', glslType: 'sampler2D', wgslName: 'sceneDepth', wgslType: 'texture_2d<f32>', description: 'Profundidade da cena (0..1, não linear); use helixLinearDepth.', models: POST_ONLY },
];
export function standardInputsFor(model: ShaderModel): StandardShaderInputSpec[] {
    return STANDARD_SHADER_INPUTS.filter((spec) => spec.models.includes(model));
}
export function standardInputByGlslName(name: string): StandardShaderInputSpec | null {
    return STANDARD_SHADER_INPUTS.find((spec) => spec.glslName === name) ?? null;
}
export const SHADER_SOURCE_USER = 0;
export const SHADER_SOURCE_ENGINE = 1;
export const SHADER_SOURCE_FIRST_INCLUDE = 2;
export const POST_SHADER_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

out vec2 vUv;

void main() {
  vUv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.999999, 1.0);
}
`;
export const POST_SHADER_VARYINGS = `in vec2 vUv;
out vec4 fragColor;`;
export const POST_SHADER_HELPER_FUNCTIONS: ReadonlyArray<{
    readonly name: string;
    readonly source: string;
}> = [
    {
        name: 'helixLinearDepth',
        source: `                                                                   
float helixLinearDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}`,
    },
    {
        name: 'helixWorldPosition',
        source: `                                                                                 
vec3 helixWorldPosition(vec2 uv, float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 world = uInverseViewProjection * clip;
  return world.xyz / world.w;
}`,
    },
];
export const POST_SHADER_HELPERS = POST_SHADER_HELPER_FUNCTIONS.map((helper) => helper.source).join('\n\n');
export const SURFACE_FIELDS: ReadonlyArray<{
    name: string;
    glslType: string;
    wgslType: string;
    description: string;
}> = [
    { name: 'baseColor', glslType: 'vec3', wgslType: 'vec3<f32>', description: 'Cor base linear já multiplicada pelo mapa, se houver.' },
    { name: 'alpha', glslType: 'float', wgslType: 'f32', description: 'Opacidade (só tem efeito nos modos recorte e mistura).' },
    { name: 'roughness', glslType: 'float', wgslType: 'f32', description: 'Rugosidade perceptual (0 espelho, 1 fosco).' },
    { name: 'metallic', glslType: 'float', wgslType: 'f32', description: '0 dielétrico, 1 metal.' },
    { name: 'normal', glslType: 'vec3', wgslType: 'vec3<f32>', description: 'Normal no mundo, já perturbada pelo mapa de normais e virada para a câmera.' },
    { name: 'occlusion', glslType: 'float', wgslType: 'f32', description: 'Oclusão ambiente (1 = nenhuma).' },
    { name: 'emissive', glslType: 'vec3', wgslType: 'vec3<f32>', description: 'Emissivo linear, já com a intensidade.' },
    { name: 'worldPosition', glslType: 'vec3', wgslType: 'vec3<f32>', description: 'Posição do fragmento no mundo.' },
    { name: 'uv', glslType: 'vec2', wgslType: 'vec2<f32>', description: 'UV já com a repetição do material.' },
    { name: 'viewDirection', glslType: 'vec3', wgslType: 'vec3<f32>', description: 'Direção do ponto para a câmera, normalizada.' },
    { name: 'frontFacing', glslType: 'bool', wgslType: 'bool', description: 'Verdadeiro na face da frente.' },
];
export const SURFACE_STRUCT_NAME = 'HelixSurface';
export const SURFACE_SHADER_STRUCT = `struct ${SURFACE_STRUCT_NAME} {\n${SURFACE_FIELDS.map((field) => `  ${field.glslType} ${field.name};`).join('\n')}\n};\n`;
export const SURFACE_ALIASED_INPUTS: ReadonlySet<StandardShaderInput> = new Set<StandardShaderInput>(['cameraPosition', 'sunDirection', 'sunColor']);
export const SURFACE_SHADER_ALIASES = `#define uCameraPosition u_cameraPosition
#define uSunDirection u_sunDirection
#define uSunColor u_sunRadiance`;
export function standardUniformLines(model: ShaderModel, skip: ReadonlySet<string> = new Set()): string {
    return standardInputsFor(model)
        .filter((spec) => !(model === 'surface' && SURFACE_ALIASED_INPUTS.has(spec.input)))
        .filter((spec) => !skip.has(spec.glslName))
        .map((spec) => `uniform ${spec.glslType} ${spec.glslName};`)
        .join('\n');
}
export const STANDARD_SHADER_UNIFORM_NAMES: ReadonlySet<string> = new Set(STANDARD_SHADER_INPUTS.map((spec) => spec.glslName));
export const WGSL_FRAME_STRUCT = 'HelixFrame';
export const WGSL_FRAME_VARIABLE = 'helix';
export const WGSL_FRAME_GROUP = 0;
export const WGSL_FRAME_BINDING = 0;
export const WGSL_SCENE_COLOR_BINDING = 1;
export const WGSL_SCENE_SAMPLER_BINDING = 2;
export const WGSL_SCENE_DEPTH_BINDING = 3;
export const WGSL_SCENE_SAMPLER_NAME = 'sceneSampler';
export const WGSL_SURFACE_ENTRY = 'helixSurfaceEntry';
export function wgslPrelude(model: ShaderModel): string {
    const fields = standardInputsFor(model).filter((spec) => !spec.glslType.startsWith('sampler'));
    const lines = [`struct ${WGSL_FRAME_STRUCT} {`, ...fields.map((spec) => `  ${spec.wgslName}: ${spec.wgslType},`), '};', `@group(${WGSL_FRAME_GROUP}) @binding(${WGSL_FRAME_BINDING}) var<uniform> ${WGSL_FRAME_VARIABLE}: ${WGSL_FRAME_STRUCT};`];
    if (model === 'post') {
        lines.push(`@group(${WGSL_FRAME_GROUP}) @binding(${WGSL_SCENE_COLOR_BINDING}) var sceneColor: texture_2d<f32>;`, `@group(${WGSL_FRAME_GROUP}) @binding(${WGSL_SCENE_SAMPLER_BINDING}) var ${WGSL_SCENE_SAMPLER_NAME}: sampler;`, `@group(${WGSL_FRAME_GROUP}) @binding(${WGSL_SCENE_DEPTH_BINDING}) var sceneDepth: texture_2d<f32>;`, 'fn helixLinearDepth(depth: f32) -> f32 {', '  let z = depth * 2.0 - 1.0;', `  return (2.0 * ${WGSL_FRAME_VARIABLE}.near * ${WGSL_FRAME_VARIABLE}.far) / (${WGSL_FRAME_VARIABLE}.far + ${WGSL_FRAME_VARIABLE}.near - z * (${WGSL_FRAME_VARIABLE}.far - ${WGSL_FRAME_VARIABLE}.near));`, '}', 'fn helixWorldPosition(uv: vec2<f32>, depth: f32) -> vec3<f32> {', '  let clip = vec4<f32>(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);', `  let world = ${WGSL_FRAME_VARIABLE}.inverseViewProjection * clip;`, '  return world.xyz / world.w;', '}');
    }
    else {
        lines.push(`struct ${SURFACE_STRUCT_NAME} {`, ...SURFACE_FIELDS.map((field) => `  ${field.name}: ${field.wgslType},`), '};');
    }
    return lines.join('\n') + '\n';
}
export const WGSL_SURFACE_ENTRY_SOURCE = `@fragment fn ${WGSL_SURFACE_ENTRY}() -> @location(0) vec4<f32> {
  var s: ${SURFACE_STRUCT_NAME};
  surface(&s);
  return vec4<f32>(s.baseColor, s.alpha);
}
`;
export function nagaResourceName(group: number, binding: number): string {
    return `_group_${group}_binding_${binding}_fs`;
}
export function nagaVaryingName(location: number): string {
    return `_vs2fs_location${location}`;
}
