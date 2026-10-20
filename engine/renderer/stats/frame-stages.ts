export const FRAME_STAGES = ['cull', 'sky', 'shadows', 'meshes', 'terrain', 'overlay'] as const;
export type FrameStage = (typeof FRAME_STAGES)[number];
export const FRAME_STAGE_LABELS: Record<FrameStage, string> = {
    cull: 'Culling e LOD',
    sky: 'Céu e nuvens',
    shadows: 'Sombras',
    meshes: 'Malhas opacas',
    terrain: 'Terreno',
    overlay: 'Transparentes e fundo',
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
