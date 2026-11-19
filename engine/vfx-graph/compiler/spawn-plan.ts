import { blockDefinition } from '../blocks/block-catalog';
import { SPAWN_BURST_BLOCK, SPAWN_RATE_BLOCK } from '../blocks/catalog/spawn-blocks';
import { numberParam, selectParam } from '../blocks/param-values';
import { CONTEXT_DEFINITIONS } from '../contexts/context-catalog';
import type { EffectContext } from '../document/effect-document';
export interface SpawnBurst {
    readonly time: number;
    readonly count: number;
    readonly interval: number;
}
export interface SpawnPlan {
    readonly rate: number;
    readonly bursts: readonly SpawnBurst[];
    readonly duration: number;
    readonly looping: boolean;
}
const SPAWN_SETTINGS = CONTEXT_DEFINITIONS.spawn.settings;
export function planSpawn(context: EffectContext | null): SpawnPlan {
    const values = context?.values ?? {};
    let rate = 0;
    const bursts: SpawnBurst[] = [];
    for (const block of context?.blocks ?? []) {
        const definition = block.enabled ? blockDefinition(block.type) : null;
        if (!definition)
            continue;
        if (block.type === SPAWN_RATE_BLOCK)
            rate += numberParam(definition.params, 'rate', block.values);
        if (block.type === SPAWN_BURST_BLOCK) {
            bursts.push({
                time: numberParam(definition.params, 'time', block.values),
                count: Math.round(numberParam(definition.params, 'count', block.values)),
                interval: numberParam(definition.params, 'interval', block.values),
            });
        }
    }
    return { rate, bursts, duration: numberParam(SPAWN_SETTINGS, 'duration', values), looping: selectParam(SPAWN_SETTINGS, 'loop', values) === 'loop' };
}
export function expectedPopulation(plan: SpawnPlan, lifetime: number): number {
    const burstParticles = plan.bursts.reduce((total, burst) => {
        const repeats = burst.interval > 0 ? Math.ceil(Math.min(lifetime, plan.duration) / burst.interval) : 1;
        return total + burst.count * Math.max(1, repeats);
    }, 0);
    return Math.ceil(plan.rate * lifetime + burstParticles);
}
