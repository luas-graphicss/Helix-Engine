import { numberOf, numbersOf, textOf, type BlockValue, type BlockValues } from '../document/block-values';
import type { BlockParam, NumberParam, SelectParam } from './block-definition';
function paramOf<TKind extends BlockParam['kind']>(params: readonly BlockParam[], id: string, kind: TKind): Extract<BlockParam, {
    kind: TKind;
}> {
    const param = params.find((candidate): candidate is Extract<BlockParam, {
        kind: TKind;
    }> => candidate.id === id && candidate.kind === kind);
    if (!param)
        throw new Error(`Parameter "${id}" of kind ${kind} is not declared`);
    return param;
}
export function clampNumberParam(param: NumberParam, value: BlockValue | undefined): number {
    const number = numberOf(value, param.fallback);
    return Math.min(param.max ?? Infinity, Math.max(param.min ?? -Infinity, number));
}
export function resolveSelectParam(param: SelectParam, value: BlockValue | undefined): string {
    const choice = textOf(value, param.fallback);
    return param.options.some((option) => option.value === choice) ? choice : param.fallback;
}
export function numberParam(params: readonly BlockParam[], id: string, values: BlockValues): number {
    return clampNumberParam(paramOf(params, id, 'number'), values[id]);
}
export function rangeParam(params: readonly BlockParam[], id: string, values: BlockValues): readonly number[] {
    return numbersOf(values[id], paramOf(params, id, 'range').fallback);
}
export function selectParam(params: readonly BlockParam[], id: string, values: BlockValues): string {
    return resolveSelectParam(paramOf(params, id, 'select'), values[id]);
}
