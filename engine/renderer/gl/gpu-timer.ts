import type { GL } from './context';
import { FRAME_STAGES, StageAverages, stageIndex, type FrameStage } from '@/engine/renderer/stats/frame-stages';
const RING = 4;
const NS_PER_MS = 1e6;
interface TimerExtension {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
}
export class GpuTimer {
    readonly available: boolean;
    readonly averages = new StageAverages();
    private readonly ext: TimerExtension | null;
    private readonly queries: WebGLQuery[][] = [];
    private readonly issued: Int32Array[] = [];
    private frame = 0;
    private active = -1;
    constructor(private readonly gl: GL) {
        this.ext = (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null) ?? null;
        this.available = this.ext !== null;
        if (!this.ext)
            return;
        for (let stage = 0; stage < FRAME_STAGES.length; stage++) {
            const ring: WebGLQuery[] = [];
            for (let slot = 0; slot < RING; slot++) {
                const query = gl.createQuery();
                if (!query) {
                    this.ext = null;
                    this.available = false;
                    this.dispose();
                    return;
                }
                ring.push(query);
            }
            this.queries.push(ring);
            this.issued.push(new Int32Array(RING).fill(-1));
        }
    }
    begin(stage: FrameStage): void {
        if (!this.ext)
            return;
        if (this.active >= 0)
            this.end();
        const index = stageIndex(stage);
        const slot = this.frame % RING;
        this.collect(index, slot);
        this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.queries[index][slot]);
        this.issued[index][slot] = this.frame;
        this.active = index;
    }
    end(): void {
        if (!this.ext || this.active < 0)
            return;
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.active = -1;
    }
    endFrame(): void {
        if (!this.ext)
            return;
        this.end();
        if (this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
            for (const slots of this.issued)
                slots.fill(-1);
        }
        this.frame++;
    }
    private collect(index: number, slot: number): void {
        const { gl } = this;
        if (this.issued[index][slot] < 0)
            return;
        this.issued[index][slot] = -1;
        const query = this.queries[index][slot];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
            return;
        const nanoseconds = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
        this.averages.push(index, nanoseconds / NS_PER_MS);
    }
    dispose(): void {
        for (const ring of this.queries) {
            for (const query of ring)
                this.gl.deleteQuery(query);
        }
        this.queries.length = 0;
        this.issued.length = 0;
    }
}
