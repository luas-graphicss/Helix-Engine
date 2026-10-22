export const FRAME_STAGES = ['cull', 'sky', 'shadows', 'prepass', 'virtual', 'mask', 'meshes', 'terrain', 'overlay', 'post'] as const;
export type FrameStage = (typeof FRAME_STAGES)[number];
export const FRAME_STAGE_LABELS: Record<FrameStage, string> = {
    cull: 'Culling, LOD e seleção de clusters',
    sky: 'Céu e nuvens',
    shadows: 'Sombras',
    prepass: 'Depth pre-pass (malhas e terreno)',
    virtual: 'Geometria virtual e pirâmide de profundidade',
    mask: 'Máscara de sombra',
    meshes: 'Malhas opacas',
    terrain: 'Terreno, cache de material e grama',
    overlay: 'Transparentes e fundo',
    post: 'Antialiasing e composição',
};
export const CPU_ONLY_STAGES: ReadonlySet<FrameStage> = new Set<FrameStage>(['cull']);
export function stageIndex(stage: FrameStage): number {
    return FRAME_STAGES.indexOf(stage);
}
const SMOOTHING = 0.15;
export class StageAverages {
    readonly ms = new Float32Array(FRAME_STAGES.length);
    private readonly seeded = new Uint8Array(FRAME_STAGES.length);
    push(index: number, sample: number): void {
        if (!this.seeded[index]) {
            this.ms[index] = sample;
            this.seeded[index] = 1;
        }
        else {
            this.ms[index] += (sample - this.ms[index]) * SMOOTHING;
        }
    }
    total(): number {
        let sum = 0;
        for (let i = 0; i < this.ms.length; i++)
            sum += this.ms[i];
        return sum;
    }
}
