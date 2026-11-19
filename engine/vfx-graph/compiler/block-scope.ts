import { GRADIENT_STOP_FLOATS, GRADIENT_STOPS, type BlockParam, type BlockScope } from '../blocks/block-definition';
import { clampNumberParam, resolveSelectParam } from '../blocks/param-values';
import { numbersOf, type BlockValues } from '../document/block-values';
import type { UniformRegistry } from './uniform-registry';
const UNSAFE_IDENTIFIER_CHARACTER = /[^A-Za-z0-9]/g;
function gradientStop(stops: readonly number[], index: number): readonly number[] {
    return stops.slice(index * GRADIENT_STOP_FLOATS, (index + 1) * GRADIENT_STOP_FLOATS);
}
export function createBlockScope(registry: UniformRegistry, ownerId: string, params: readonly BlockParam[], values: BlockValues): BlockScope {
    const prefix = `u_${ownerId.replace(UNSAFE_IDENTIFIER_CHARACTER, '_')}`;
    const paramOf = (paramId: string): BlockParam => {
        const param = params.find((candidate) => candidate.id === paramId);
        if (!param)
            throw new Error(`Parameter "${paramId}" is not declared on ${ownerId}`);
        return param;
    };
    return {
        uniform(paramId) {
            const param = paramOf(paramId);
            const name = `${prefix}_${paramId}`;
            switch (param.kind) {
                case 'number':
                    return registry.declare(name, [clampNumberParam(param, values[paramId])]);
                case 'range':
                case 'vector':
                case 'color':
                    return registry.declare(name, numbersOf(values[paramId], param.fallback));
                case 'select':
                case 'gradient':
                    throw new Error(`Parameter "${paramId}" on ${ownerId} does not map to a single uniform`);
            }
        },
        choice(paramId) {
            const param = paramOf(paramId);
            if (param.kind !== 'select')
                throw new Error(`Parameter "${paramId}" on ${ownerId} is not a choice`);
            return resolveSelectParam(param, values[paramId]);
        },
        gradient(paramId, position) {
            const param = paramOf(paramId);
            if (param.kind !== 'gradient')
                throw new Error(`Parameter "${paramId}" on ${ownerId} is not a gradient`);
            const stops = numbersOf(values[paramId], param.fallback);
            const name = `${prefix}_${paramId}`;
            const positions: number[] = [];
            const colors: string[] = [];
            for (let index = 0; index < GRADIENT_STOPS; index++) {
                const [at = 0, ...rgba] = gradientStop(stops, index);
                positions.push(at);
                colors.push(registry.declare(`${name}_c${index}`, rgba));
            }
            return `vfxGradient(${registry.declare(`${name}_t`, positions)}, ${colors.join(', ')}, ${position})`;
        },
        salt: () => registry.nextSalt(),
    };
}
