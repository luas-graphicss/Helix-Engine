import { BRDF_CHUNK } from '@/engine/renderer/shaders/chunks/brdf.glsl';
import { COLOR_CHUNK } from '@/engine/renderer/shaders/chunks/color.glsl';
import { HDR_ENCODING_CHUNK } from '@/engine/renderer/shaders/chunks/hdr-encoding.glsl';
import { NOISE_CHUNK } from '@/engine/renderer/shaders/chunks/noise.glsl';
import { OCTAHEDRAL_CHUNK } from '@/engine/renderer/shaders/chunks/octahedral.glsl';
import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
export interface GlslChunk {
    readonly name: string;
    readonly source: string;
    readonly description: string;
    readonly models: readonly ShaderModel[];
}
export const GLSL_CHUNKS: readonly GlslChunk[] = [
    { name: 'brdf', source: BRDF_CHUNK, description: 'Distribuição GGX, Fresnel e visibilidade do modelo PBR.', models: [] },
    { name: 'color', source: COLOR_CHUNK, description: 'Tone mapping (ACES e outros) e conversões sRGB/linear.', models: [] },
    { name: 'noise', source: NOISE_CHUNK, description: 'Hash, ruído de valor e FBM.', models: [] },
    { name: 'hdr-encoding', source: HDR_ENCODING_CHUNK, description: 'encodeHdr/decodeHdr dos alvos HDR da engine.', models: [] },
    { name: 'octahedral', source: OCTAHEDRAL_CHUNK, description: 'Codificação octaédrica de direções em 2D.', models: [] },
];
export const GLSL_CHUNK_NOTES: Readonly<Record<string, string>> = {
    'scene-lighting': 'o modelo "surface" já ilumina o resultado com ele; no modelo "post" a cena já vem iluminada.',
    'local-lights': 'faz parte do fragmento de malha e só funciona dentro dele; use o modelo "surface".',
    'shadow-sampling': 'depende das cascatas de sombra vinculadas pelo passe de malha; use o modelo "surface".',
    'terrain-material': 'é interno do passe de terreno.',
    fullscreen: 'é o vértice do triângulo de tela cheia; o modelo "post" já o usa.',
};
export function findGlslChunk(name: string): GlslChunk | null {
    return GLSL_CHUNKS.find((chunk) => chunk.name === name) ?? null;
}
