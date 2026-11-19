import { blockDefinition } from '../blocks/block-catalog';
import { STRETCH_BLOCK } from '../blocks/catalog/appearance-blocks';
import { DEFAULT_LIFETIME_SECONDS, LIFETIME_BLOCK } from '../blocks/catalog/attribute-blocks';
import { numberParam, rangeParam } from '../blocks/param-values';
import { CONTEXT_DEFINITIONS } from '../contexts/context-catalog';
import type { EffectContext, VfxGraphDocument } from '../document/effect-document';
import { resolveSystems, systemContexts, type EffectSystem } from '../document/effect-systems';
import { SPRITE_SHAPES } from '../glsl/sprite-chunks.glsl';
import { createBlockScope } from './block-scope';
import { EFFECT_BLENDS, SPRITE_ORIENTATIONS, writeRenderShaders, type EffectBlend } from './render-shader';
import { writeSimulationShader } from './simulation-shader';
import { expectedPopulation, planSpawn, type SpawnPlan } from './spawn-plan';
import { UniformRegistry, type EffectUniform } from './uniform-registry';
export interface EffectDiagnostic {
    readonly severity: 'error' | 'warning';
    readonly message: string;
    readonly contextId: string | null;
    readonly blockId: string | null;
}
export interface CompiledOutput {
    readonly contextId: string;
    readonly vertex: string;
    readonly fragment: string;
    readonly blend: EffectBlend;
    readonly uniforms: readonly EffectUniform[];
}
export interface CompiledSystem {
    readonly id: string;
    readonly capacity: number;
    readonly maxLifetime: number;
    readonly spawn: SpawnPlan;
    readonly simulation: string;
    readonly uniforms: readonly EffectUniform[];
    readonly outputs: readonly CompiledOutput[];
}
export interface CompiledEffect {
    readonly systems: readonly CompiledSystem[];
    readonly diagnostics: readonly EffectDiagnostic[];
    readonly blockCount: number;
    readonly capacity: number;
}
interface EmittedBlocks {
    readonly beforeMotion: string[];
    readonly afterMotion: string[];
}
function oneOf<TChoice extends string>(choices: readonly TChoice[], value: string, fallback: TChoice): TChoice {
    return choices.find((choice) => choice === value) ?? fallback;
}
function emitBlocks(context: EffectContext | null, registry: UniformRegistry, diagnostics: EffectDiagnostic[]): EmittedBlocks {
    const emitted: EmittedBlocks = { beforeMotion: [], afterMotion: [] };
    if (!context)
        return emitted;
    for (const block of context.blocks) {
        if (!block.enabled)
            continue;
        const definition = blockDefinition(block.type);
        if (!definition) {
            diagnostics.push({ severity: 'error', message: `Bloco desconhecido "${block.type}": exclua-o para o efeito voltar a compilar.`, contextId: context.id, blockId: block.id });
            continue;
        }
        if (definition.stage !== context.kind) {
            const home = CONTEXT_DEFINITIONS[definition.stage].label;
            diagnostics.push({ severity: 'error', message: `${definition.label} só funciona em um contexto de ${home}.`, contextId: context.id, blockId: block.id });
            continue;
        }
        if (!definition.emit)
            continue;
        const code = definition.emit(createBlockScope(registry, block.id, definition.params, block.values));
        (definition.afterMotion ? emitted.afterMotion : emitted.beforeMotion).push(code);
    }
    return emitted;
}
function maxLifetimeOf(initialize: EffectContext): number {
    const block = initialize.blocks.findLast((candidate) => candidate.enabled && candidate.type === LIFETIME_BLOCK);
    const definition = block ? blockDefinition(block.type) : null;
    if (!block || !definition)
        return DEFAULT_LIFETIME_SECONDS;
    return Math.max(...rangeParam(definition.params, 'seconds', block.values));
}
function compileOutput(context: EffectContext, diagnostics: EffectDiagnostic[]): CompiledOutput {
    const registry = new UniformRegistry();
    const settings = createBlockScope(registry, context.id, CONTEXT_DEFINITIONS.output.settings, context.values);
    const blocks = emitBlocks(context, registry, diagnostics);
    const stretched = context.blocks.some((block) => block.enabled && block.type === STRETCH_BLOCK);
    const blend = oneOf(EFFECT_BLENDS, settings.choice('blend'), 'additive');
    const { vertex, fragment } = writeRenderShaders({
        body: [...blocks.beforeMotion, ...blocks.afterMotion],
        orientation: stretched ? 'velocity' : oneOf(SPRITE_ORIENTATIONS, settings.choice('orientation'), 'camera'),
        shape: oneOf(SPRITE_SHAPES, settings.choice('shape'), 'soft'),
        blend,
        intensity: settings.uniform('intensity'),
        declarations: registry.declarations,
    });
    return { contextId: context.id, vertex, fragment, blend, uniforms: registry.list };
}
function compileSystem(system: EffectSystem, diagnostics: EffectDiagnostic[]): CompiledSystem {
    const registry = new UniformRegistry();
    const initialize = emitBlocks(system.initialize, registry, diagnostics);
    const update = emitBlocks(system.update, registry, diagnostics);
    const capacity = Math.round(numberParam(CONTEXT_DEFINITIONS.initialize.settings, 'capacity', system.initialize.values));
    const maxLifetime = maxLifetimeOf(system.initialize);
    const spawn = planSpawn(system.spawn);
    const expected = expectedPopulation(spawn, maxLifetime);
    if (!system.spawn)
        diagnostics.push({ severity: 'warning', message: 'Sistema sem Emissão ligada: nenhuma partícula nasce.', contextId: system.id, blockId: null });
    else if (expected === 0)
        diagnostics.push({ severity: 'warning', message: 'A Emissão não tem taxa nem rajada: nenhuma partícula nasce.', contextId: system.spawn.id, blockId: null });
    if (system.outputs.length === 0)
        diagnostics.push({ severity: 'warning', message: 'Sistema sem Saída ligada: as partículas são simuladas, mas não aparecem.', contextId: system.id, blockId: null });
    if (expected > capacity) {
        const message = `Capacidade de ${capacity} partículas para cerca de ${expected} vivas: as mais antigas somem antes da hora.`;
        diagnostics.push({ severity: 'warning', message, contextId: system.id, blockId: null });
    }
    return {
        id: system.id,
        capacity,
        maxLifetime,
        spawn,
        simulation: writeSimulationShader({
            initialize: [...initialize.beforeMotion, ...initialize.afterMotion],
            beforeMotion: update.beforeMotion,
            afterMotion: update.afterMotion,
            declarations: registry.declarations,
        }),
        uniforms: registry.list,
        outputs: system.outputs.map((output) => compileOutput(output, diagnostics)),
    };
}
export function compileEffectGraph(document: VfxGraphDocument): CompiledEffect {
    const diagnostics: EffectDiagnostic[] = [];
    const resolved = resolveSystems(document);
    const systems = resolved.map((system) => compileSystem(system, diagnostics));
    const owned = new Set(resolved.flatMap((system) => systemContexts(system).map((context) => context.id)));
    for (const context of document.contexts) {
        if (!owned.has(context.id))
            diagnostics.push({ severity: 'warning', message: `${CONTEXT_DEFINITIONS[context.kind].label} solta: ligue-a a uma Inicialização para ela valer.`, contextId: context.id, blockId: null });
    }
    return {
        systems,
        diagnostics,
        blockCount: document.contexts.reduce((total, context) => total + context.blocks.length, 0),
        capacity: systems.reduce((total, system) => total + system.capacity, 0),
    };
}
