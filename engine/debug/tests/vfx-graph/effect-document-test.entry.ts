import { CONTEXT_WIDTH, shiftContextsBelow } from '@/engine/vfx-graph/document/context-layout';
import { addBlock, findBlock, moveBlock, removeBlock, setBlockEnabled, setBlockValue } from '@/engine/vfx-graph/document/effect-blocks';
import { addContext, connectFlow, createEffectGraph, disconnectFlow, flowInto, moveContexts, removeContexts, setContextValue, type VfxGraphDocument } from '@/engine/vfx-graph/document/effect-document';
import { parseEffectGraph } from '@/engine/vfx-graph/document/effect-serialization';
import { resolveSystems, systemOf } from '@/engine/vfx-graph/document/effect-systems';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Documento do Visual Effect Graph');
interface Chain {
    readonly document: VfxGraphDocument;
    readonly spawn: string;
    readonly initialize: string;
    readonly update: string;
    readonly output: string;
}
function buildChain(): Chain {
    const spawn = addContext(createEffectGraph(), 'spawn', 0, 0);
    const initialize = addContext(spawn.document, 'initialize', 0, 100);
    const update = addContext(initialize.document, 'update', 0, 200);
    const output = addContext(update.document, 'output', 0, 300);
    let document = connectFlow(output.document, spawn.contextId, initialize.contextId);
    document = connectFlow(document, initialize.contextId, update.contextId);
    document = connectFlow(document, update.contextId, output.contextId);
    return { document, spawn: spawn.contextId, initialize: initialize.contextId, update: update.contextId, output: output.contextId };
}
function flow(): void {
    const empty = createEffectGraph();
    checks.check('um efeito novo nasce sem contextos', empty.contexts.length === 0 && empty.links.length === 0);
    const chain = buildChain();
    const { document } = chain;
    checks.check('addContext dá ids distintos e não altera o grafo recebido', new Set(document.contexts.map((context) => context.id)).size === 4 && empty.contexts.length === 0);
    checks.check('connectFlow encadeia emissão, inicialização, atualização e saída', document.links.length === 3);
    checks.check('repetir a mesma ligação devolve o mesmo grafo', connectFlow(document, chain.spawn, chain.initialize) === document);
    checks.check('o fluxo não anda para trás', connectFlow(document, chain.output, chain.spawn) === document);
    checks.check('a emissão não pula a inicialização', connectFlow(document, chain.spawn, chain.update) === document);
    const secondSpawn = addContext(document, 'spawn', 300, 0);
    const refed = connectFlow(secondSpawn.document, secondSpawn.contextId, chain.initialize);
    checks.check('um contexto aceita só uma entrada: a nova substitui a antiga', refed.links.length === 3 && flowInto(refed, chain.initialize)?.from === secondSpawn.contextId);
    const secondUpdate = addContext(document, 'update', 300, 200);
    const swapped = connectFlow(secondUpdate.document, chain.initialize, secondUpdate.contextId);
    checks.check('uma inicialização mantém uma única atualização', swapped.links.filter((link) => link.from === chain.initialize).length === 1 && flowInto(swapped, chain.update) === null);
    const moved = moveContexts(document, new Set([chain.spawn]), 10, -5);
    checks.check('moveContexts desloca só os contextos pedidos', moved.contexts[0].x === 10 && moved.contexts[0].y === -5 && moved.contexts[1].y === 100);
    const configured = setContextValue(document, chain.initialize, 'capacity', 2048);
    checks.check('setContextValue guarda o valor sem tocar no grafo anterior', configured.contexts[1].values.capacity === 2048 && document.contexts[1].values.capacity === undefined);
    const removed = removeContexts(document, new Set([chain.update]));
    checks.check('removeContexts leva as ligações do contexto', removed.contexts.length === 3 && removed.links.length === 1);
    checks.check('disconnectFlow de uma ligação inexistente devolve o mesmo grafo', disconnectFlow(document, 'nenhuma') === document);
    checks.check('disconnectFlow tira a ligação pedida', disconnectFlow(document, document.links[0].id).links.length === 2);
}
function blocks(): void {
    const chain = buildChain();
    const gravity = addBlock(chain.document, chain.update, 'gravity');
    const drag = gravity ? addBlock(gravity.document, chain.update, 'drag') : null;
    const fade = drag ? addBlock(drag.document, chain.output, 'fade') : null;
    if (!gravity || !drag || !fade) {
        checks.check('addBlock acrescenta blocos a contextos existentes', false);
        return;
    }
    const { document } = fade;
    checks.check('addBlock dá ids únicos entre contextos', new Set([gravity.blockId, drag.blockId, fade.blockId]).size === 3);
    checks.check('addBlock em contexto ausente não devolve nada', addBlock(document, 'ausente', 'gravity') === null);
    checks.check('um bloco novo nasce ligado', findBlock(document, chain.update, gravity.blockId)?.enabled === true);
    const reordered = moveBlock(document, chain.update, drag.blockId, -1);
    checks.check('moveBlock troca a ordem dentro do contexto', reordered.contexts[2].blocks[0].id === drag.blockId);
    checks.check('moveBlock para além da ponta devolve o mesmo grafo', moveBlock(document, chain.update, gravity.blockId, -1) === document);
    checks.check('setBlockEnabled com o mesmo estado devolve o mesmo grafo', setBlockEnabled(document, chain.update, gravity.blockId, true) === document);
    checks.check('setBlockEnabled desliga o bloco', findBlock(setBlockEnabled(document, chain.update, gravity.blockId, false), chain.update, gravity.blockId)?.enabled === false);
    const valued = setBlockValue(document, chain.update, gravity.blockId, 'strength', 3);
    checks.check('setBlockValue guarda o valor sem tocar no grafo anterior', findBlock(valued, chain.update, gravity.blockId)?.values.strength === 3 && findBlock(document, chain.update, gravity.blockId)?.values.strength === undefined);
    checks.check('removeBlock tira só o bloco pedido', removeBlock(document, chain.update, gravity.blockId).contexts[2].blocks.length === 1);
    checks.check('removeBlock de um bloco ausente devolve o mesmo grafo', removeBlock(document, chain.update, 'ausente') === document);
}
function systems(): void {
    const chain = buildChain();
    const [system] = resolveSystems(chain.document);
    checks.check('uma cadeia completa vira um sistema', system?.spawn?.id === chain.spawn && system.update?.id === chain.update && system.outputs[0]?.id === chain.output);
    checks.check('systemOf acha o sistema de qualquer contexto dele', systemOf(chain.document, chain.output)?.id === chain.initialize);
    const direct = addContext(chain.document, 'output', 300, 300);
    const twoOutputs = connectFlow(direct.document, chain.initialize, direct.contextId);
    checks.check('uma saída pode vir direto da inicialização', resolveSystems(twoOutputs)[0].outputs.length === 2);
    const lone = addContext(createEffectGraph(), 'initialize', 0, 0);
    const [orphan] = resolveSystems(lone.document);
    checks.check('uma inicialização sozinha é um sistema sem emissão nem saída', orphan.spawn === null && orphan.update === null && orphan.outputs.length === 0);
}
function layout(): void {
    const chain = buildChain();
    const neighbour = addContext(chain.document, 'output', CONTEXT_WIDTH + 40, 300);
    const shifted = shiftContextsBelow(neighbour.document, chain.initialize, 24);
    const topOf = (id: string) => shifted.contexts.find((context) => context.id === id)?.y;
    checks.check('contextos abaixo na mesma coluna descem juntos', topOf(chain.update) === 224 && topOf(chain.output) === 324);
    checks.check('o contexto que cresceu e os de cima ficam no lugar', topOf(chain.initialize) === 100 && topOf(chain.spawn) === 0);
    checks.check('contextos de outra coluna ficam no lugar', topOf(neighbour.contextId) === 300);
    checks.check('deslocamento nulo devolve o mesmo documento', shiftContextsBelow(chain.document, chain.initialize, 0) === chain.document);
}
function parsing(): void {
    const chain = buildChain();
    const withBlock = addBlock(chain.document, chain.update, 'gravity', { strength: 4 });
    const document = withBlock?.document ?? chain.document;
    const saved: unknown = JSON.parse(JSON.stringify(document));
    checks.check('um efeito salvo volta igual', JSON.stringify(parseEffectGraph(saved)) === JSON.stringify(document));
    checks.check('formato desconhecido é recusado', parseEffectGraph({ ...document, format: 'outro' }) === null);
    checks.check('versão desconhecida é recusada', parseEffectGraph({ ...document, version: 99 }) === null);
    const dangling = parseEffectGraph({ ...document, links: [...document.links, { id: 'l9', from: 'ausente', to: chain.output }] });
    checks.check('ligações para contextos ausentes são descartadas', dangling?.links.length === 3);
    const backwards = parseEffectGraph({ ...document, links: [{ id: 'l1', from: chain.output, to: chain.spawn }] });
    checks.check('ligações contra o fluxo são descartadas', backwards?.links.length === 0);
    const duplicated = parseEffectGraph({ ...document, contexts: [...document.contexts, document.contexts[0]] });
    checks.check('contextos com id repetido são descartados', duplicated?.contexts.length === 4);
    const malformed = parseEffectGraph({ ...document, contexts: [{ ...document.contexts[0], values: { valido: 1, invalido: { x: 1 }, infinito: [1, null] } }] });
    checks.check('valores malformados de um contexto são ignorados', malformed?.contexts[0].values.valido === 1 && malformed.contexts[0].values.invalido === undefined && malformed.contexts[0].values.infinito === undefined);
}
flow();
blocks();
systems();
layout();
parsing();
checks.finish();
