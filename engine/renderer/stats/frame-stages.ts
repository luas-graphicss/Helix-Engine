export const FRAME_STAGES = ['cull', 'sky', 'shadows', 'probe', 'prepass', 'virtual', 'clouds', 'mask', 'reflections', 'meshes', 'terrain', 'overlay', 'post', 'editor', 'final'] as const;
export type FrameStage = (typeof FRAME_STAGES)[number];
export const FRAME_STAGE_LABELS: Record<FrameStage, string> = {
    cull: 'Culling, LOD e seleção de clusters',
    sky: 'Céu (LUTs e sombra das nuvens)',
    shadows: 'Sombras',
    probe: 'Sonda de reflexo (uma face do cubemap)',
    prepass: 'Depth pre-pass (malhas, terreno e surface buffer)',
    virtual: 'Geometria virtual e pirâmide de profundidade',
    clouds: 'Nuvens (marcha volumétrica e acumulação temporal)',
    mask: 'Máscara de sombra',
    reflections: 'Reflexos em espaço de tela',
    meshes: 'Malhas opacas',
    terrain: 'Terreno, cache de material e grama',
    overlay: 'Transparentes e fundo',
    post: 'Pós-processo (bloom, foco, tone mapping)',
    editor: 'Overlays do editor',
    final: 'Antialiasing e composição',
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
