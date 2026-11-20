import { createMathApi } from '@/engine/scripting/api/math';
export interface JobToolkit {
    readonly math: ReturnType<typeof createMathApi>;
}
export function createJobToolkit(): JobToolkit {
    return { math: createMathApi() };
}
