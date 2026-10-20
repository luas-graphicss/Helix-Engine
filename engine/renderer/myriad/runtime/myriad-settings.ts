export const MYRIAD_DEBUG_VIEWS = ['none', 'clusters', 'groups', 'levels', 'triangles', 'normals', 'occlusion', 'hzb'] as const;
export type MyriadDebugView = (typeof MYRIAD_DEBUG_VIEWS)[number];
export const MYRIAD_DEBUG_VIEW_LABELS: Record<MyriadDebugView, string> = {
    none: 'Material',
    clusters: 'Clusters',
    groups: 'Grupos',
    levels: 'Níveis do DAG',
    triangles: 'Triângulos',
    normals: 'Normais',
    occlusion: 'Oclusão',
    hzb: 'Pirâmide de profundidade',
};
export function debugViewIndex(view: MyriadDebugView): number {
    return MYRIAD_DEBUG_VIEWS.indexOf(view);
}
export interface MyriadSettings {
    enabled: boolean;
    pixelError: number;
    occlusionCulling: boolean;
    freeze: boolean;
    debugView: MyriadDebugView;
    wireframe: boolean;
}
export const MIN_PIXEL_ERROR = 0.25;
export const MAX_PIXEL_ERROR = 16;
export function createMyriadSettings(): MyriadSettings {
    return { enabled: true, pixelError: 1, occlusionCulling: true, freeze: false, debugView: 'none', wireframe: false };
}
