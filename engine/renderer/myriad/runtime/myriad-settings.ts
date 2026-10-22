export const MYRIAD_DEBUG_VIEWS = ['none', 'clusters', 'groups', 'levels', 'triangles', 'normals', 'occlusion', 'hzb'] as const;
export type MyriadDebugView = (typeof MYRIAD_DEBUG_VIEWS)[number];
export const MYRIAD_DEBUG_VIEW_LABELS: Record<MyriadDebugView, string> = {
    none: 'Iluminado',
    clusters: 'Clusters',
    groups: 'Grupos',
    levels: 'Níveis do DAG',
    triangles: 'Triângulos',
    normals: 'Normais',
    occlusion: 'Oclusão',
    hzb: 'Pirâmide de profundidade',
};
export const MYRIAD_DEBUG_VIEW_HINTS: Record<MyriadDebugView, string> = {
    none: 'Material e iluminação finais; a geometria virtual é indistinguível da clássica.',
    clusters: 'Uma cor por cluster de até 128 triângulos: o grão em que a GPU seleciona e descarta geometria.',
    groups: 'Uma cor por grupo do DAG: clusters simplificados juntos trocam de nível ao mesmo tempo.',
    levels: 'Nível de detalhe de cada cluster: azul = malha original, quente = mais simplificado, roxo = nível 7 ou além.',
    triangles: 'Cada triângulo rasterizado, com arestas: perto deve haver cerca de um por pixel.',
    normals: 'Normais interpoladas em mundo: descontinuidades revelam costuras na simplificação.',
    occlusion: 'Verde = visível no passe principal; laranja = resgatado pelo pós-passe após o culling.',
    hzb: 'Nível da pirâmide de profundidade usado pelo culling de oclusão (escuro = longe).',
};
export function debugViewIndex(view: MyriadDebugView): number {
    return MYRIAD_DEBUG_VIEWS.indexOf(view);
}
export interface MyriadSettings {
    enabled: boolean;
    pixelError: number;
    occlusionCulling: boolean;
    shadowClusters: boolean;
    freeze: boolean;
    debugView: MyriadDebugView;
    hzbLevel: number;
    wireframe: boolean;
}
export const MIN_PIXEL_ERROR = 0.25;
export const MAX_PIXEL_ERROR = 16;
export function createMyriadSettings(): MyriadSettings {
    return {
        enabled: true,
        pixelError: 1,
        occlusionCulling: true,
        shadowClusters: true,
        freeze: false,
        debugView: 'none',
        hzbLevel: 0,
        wireframe: false,
    };
}
