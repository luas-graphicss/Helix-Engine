import { compileEffectGraph, type CompiledEffect } from '@/engine/vfx-graph/compiler/effect-compiler';
import { expectedPopulation, planSpawn } from '@/engine/vfx-graph/compiler/spawn-plan';
import { addBlock, setBlockEnabled, setBlockValue } from '@/engine/vfx-graph/document/effect-blocks';
import { addContext, createEffectGraph, removeContexts, setContextValue, type VfxGraphDocument } from '@/engine/vfx-graph/document/effect-document';
import { buildEffect } from '@/engine/vfx-graph/templates/effect-builder';
import { STARTER_SYSTEM } from '@/engine/vfx-graph/templates/starter-system';
import { EFFECT_TEMPLATES } from '@/engine/vfx-graph/templates/template-catalog';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Compilador do Visual Effect Graph');
const SPAWN = 'c1';
const INITIALIZE = 'c2';
const UPDATE = 'c3';
const OUTPUT = 'c4';
function messagesOf(compiled: CompiledEffect, severity: 'error' | 'warning'): string {
    return compiled.diagnostics.filter((diagnostic) => diagnostic.severity === severity).map((diagnostic) => diagnostic.message).join(' | ');
}
function isBalanced(source: string): boolean {
    let depth = 0;
    for (const character of source) {
        if (character === '(' || character === '{')
            depth++;
        if (character === ')' || character === '}')
            depth--;
        if (depth < 0)
            return false;
    }
    return depth === 0;
}
function isWellFormed(source: string): boolean {
    return source.startsWith('#version 300 es') && source.includes('void main() {') && isBalanced(source) && !/undefined|NaN|\[object/.test(source);
}
function withBlock(document: VfxGraphDocument, contextId: string, type: string): VfxGraphDocument {
    return addBlock(document, contextId, type)?.document ?? document;
}
function templates(): void {
    for (const template of EFFECT_TEMPLATES) {
        const compiled = compileEffectGraph(template.build());
        const sources = compiled.systems.flatMap((system) => [system.simulation, ...system.outputs.flatMap((output) => [output.vertex, output.fragment])]);
        const problems = [messagesOf(compiled, 'error'), messagesOf(compiled, 'warning')].filter((message) => message !== '').join(' | ');
        checks.check(`o modelo ${template.label} compila limpo`, problems === '' && compiled.systems.length > 0 && sources.every(isWellFormed), problems);
    }
}
function uniforms(): void {
    const starter = buildEffect([STARTER_SYSTEM]);
    const compiled = compileEffectGraph(starter);
    const [system] = compiled.systems;
    const drag = system.uniforms.find((uniform) => uniform.name === 'u_b6_amount');
    checks.check('cada parâmetro numérico vira um uniforme com o valor do bloco', drag?.value[0] === 0.6 && system.simulation.includes('uniform float u_b6_amount;'));
    const retuned = compileEffectGraph(setBlockValue(starter, UPDATE, 'b6', 'amount', 2.5));
    checks.check('mudar um valor troca o uniforme e mantém o GLSL', retuned.systems[0].simulation === system.simulation && retuned.systems[0].uniforms.find((uniform) => uniform.name === 'u_b6_amount')?.value[0] === 2.5);
    const disabled = compileEffectGraph(setBlockEnabled(starter, UPDATE, 'b6', false));
    checks.check('um bloco desligado some do shader', !disabled.systems[0].simulation.includes('u_b6_amount'));
    const clamped = compileEffectGraph(setContextValue(starter, INITIALIZE, 'capacity', 9e9));
    checks.check('a capacidade respeita o teto', clamped.systems[0].capacity === 1048576);
    const graded = compileEffectGraph(withBlock(starter, OUTPUT, 'color-over-life'));
    const stops = graded.systems[0].outputs[0].uniforms.filter((uniform) => uniform.name.startsWith('u_b9_gradient'));
    checks.check('um degradê vira quatro cores e um vetor de posições', stops.length === 5 && stops.every((uniform) => uniform.value.length === 4));
}
function structure(): void {
    const starter = buildEffect([STARTER_SYSTEM]);
    const collided = compileEffectGraph(withBlock(starter, UPDATE, 'ground-collision'));
    const { simulation } = collided.systems[0];
    checks.check('a colisão roda depois do movimento', simulation.indexOf('position.y <') > simulation.indexOf('age += dt;'));
    checks.check('as forças rodam antes do movimento', simulation.indexOf('u_b6_amount * dt') < simulation.indexOf('age += dt;'));
    const camera = compileEffectGraph(starter).systems[0].outputs[0];
    const stretched = compileEffectGraph(withBlock(starter, OUTPUT, 'stretch-by-velocity')).systems[0].outputs[0];
    checks.check('esticar pela velocidade alinha o quadrado ao movimento', !camera.vertex.includes('viewSpeed') && stretched.vertex.includes('viewSpeed'));
    const matter = compileEffectGraph(setContextValue(setContextValue(starter, OUTPUT, 'blend', 'alpha'), OUTPUT, 'shape', 'ring')).systems[0].outputs[0];
    checks.check('mistura e forma da saída mudam o fragmento', matter.blend === 'alpha' && matter.fragment.includes('vec4(light * alpha, alpha)') && matter.fragment.includes('reach - 0.78'));
    const unknownShape = compileEffectGraph(setContextValue(starter, OUTPUT, 'shape', 'inexistente')).systems[0].outputs[0];
    checks.check('uma forma desconhecida cai na forma padrão', unknownShape.fragment === camera.fragment);
}
function diagnostics(): void {
    const starter = buildEffect([STARTER_SYSTEM]);
    checks.check('o sistema inicial compila sem avisos', compileEffectGraph(starter).diagnostics.length === 0, messagesOf(compileEffectGraph(starter), 'warning'));
    checks.check('bloco desconhecido vira erro', messagesOf(compileEffectGraph(withBlock(starter, UPDATE, 'inexistente')), 'error').includes('desconhecido'));
    checks.check('bloco no contexto errado vira erro', messagesOf(compileEffectGraph(withBlock(starter, UPDATE, 'fade')), 'error').includes('Saída'));
    checks.check('sistema sem emissão avisa', messagesOf(compileEffectGraph(removeContexts(starter, new Set([SPAWN]))), 'warning').includes('Emissão'));
    checks.check('sistema sem saída avisa', messagesOf(compileEffectGraph(removeContexts(starter, new Set([OUTPUT]))), 'warning').includes('Saída'));
    checks.check('capacidade menor que a população esperada avisa', messagesOf(compileEffectGraph(setContextValue(starter, INITIALIZE, 'capacity', 16)), 'warning').includes('Capacidade'));
    const loose = addContext(starter, 'output', 400, 0).document;
    checks.check('contexto solto avisa', messagesOf(compileEffectGraph(loose), 'warning').includes('solta'));
    checks.check('um efeito vazio compila sem sistemas', compileEffectGraph(createEffectGraph()).systems.length === 0);
}
function spawning(): void {
    const spawn = addContext(createEffectGraph(), 'spawn', 0, 0);
    let document = addBlock(spawn.document, spawn.contextId, 'spawn-rate', { rate: 100 })?.document ?? spawn.document;
    document = addBlock(document, spawn.contextId, 'spawn-rate', { rate: 50 })?.document ?? document;
    document = addBlock(document, spawn.contextId, 'spawn-burst', { count: 30, time: 0.5, interval: 0 })?.document ?? document;
    const plan = planSpawn(document.contexts[0]);
    checks.check('as taxas da emissão se somam', plan.rate === 150);
    checks.check('a rajada entra no plano', plan.bursts.length === 1 && plan.bursts[0].count === 30 && plan.bursts[0].time === 0.5);
    checks.check('a emissão repete por padrão', plan.looping && plan.duration === 5);
    checks.check('ciclo único desliga a repetição', !planSpawn(setContextValue(document, spawn.contextId, 'loop', 'once').contexts[0]).looping);
    checks.check('a população esperada soma taxa e rajadas', expectedPopulation(plan, 2) === 330);
    checks.check('sem contexto de emissão nada nasce', expectedPopulation(planSpawn(null), 2) === 0);
}
templates();
uniforms();
structure();
diagnostics();
spawning();
checks.finish();
