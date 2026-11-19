import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { ShaderGraphDocument } from '../document/graph-document';
import { noirGraph, outlineGraph, pixelArtGraph, vignetteAberrationGraph } from './post-templates';
import { dissolveGraph, hologramGraph, lavaGraph, rustedMetalGraph, texturedPbrGraph, toonGraph, waterGraph } from './surface-templates';
export interface GraphTemplate {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly model: ShaderModel;
    build(): ShaderGraphDocument;
}
export const GRAPH_TEMPLATES: readonly GraphTemplate[] = [
    { id: 'textured-pbr', label: 'PBR texturizado', description: 'Textura, mapa de normal e mapa ORM ligados à saída PBR.', model: 'surface', build: texturedPbrGraph },
    { id: 'rusted-metal', label: 'Metal enferrujado', description: 'Material procedural: ruído separa metal polido de ferrugem áspera.', model: 'surface', build: rustedMetalGraph },
    { id: 'dissolve', label: 'Dissolver', description: 'A superfície some por um ruído, com a borda em brasa.', model: 'surface', build: dissolveGraph },
    { id: 'hologram', label: 'Holograma', description: 'Linhas de varredura, contorno brilhante e transparência.', model: 'surface', build: hologramGraph },
    { id: 'water', label: 'Água', description: 'Ondas animadas, cor por profundidade e espuma nas cristas.', model: 'surface', build: waterGraph },
    { id: 'lava', label: 'Lava', description: 'Crosta escura com rachaduras incandescentes que escorrem.', model: 'surface', build: lavaGraph },
    { id: 'toon', label: 'Toon', description: 'Sombreamento estilizado em faixas chapadas com contorno de luz.', model: 'surface', build: toonGraph },
    { id: 'vignette-aberration', label: 'Vinheta e aberração', description: 'Cantos escurecidos e canais de cor separados nas bordas.', model: 'post', build: vignetteAberrationGraph },
    { id: 'pixel-art', label: 'Pixel art', description: 'Cena em blocos com poucos tons.', model: 'post', build: pixelArtGraph },
    { id: 'noir', label: 'Noir', description: 'Preto e branco contrastado com granulação de filme.', model: 'post', build: noirGraph },
    { id: 'outline', label: 'Contorno a tinta', description: 'Traço escuro onde a imagem muda de repente.', model: 'post', build: outlineGraph },
];
export function findGraphTemplate(id: string): GraphTemplate | null {
    return GRAPH_TEMPLATES.find((template) => template.id === id) ?? null;
}
