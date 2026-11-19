import { addNode, connect, createShaderGraph, disconnect, linkInto, moveNodes, removeNodes, setNodeValue } from '@/engine/shader-graph/document/graph-document';
import { parseShaderGraph } from '@/engine/shader-graph/document/graph-serialization';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Documento do Shader Graph');
function editing(): void {
    const empty = createShaderGraph('surface');
    const output = empty.nodes[0];
    checks.check('um grafo novo nasce só com o nó de saída', empty.nodes.length === 1 && empty.links.length === 0);
    const color = addNode(empty, 'input-color', 0, 0);
    const product = addNode(color.document, 'math-multiply', 100, 0);
    checks.check('addNode dá ids distintos e não altera o grafo recebido', color.nodeId !== product.nodeId && empty.nodes.length === 1);
    const linked = connect(product.document, { node: color.nodeId, socket: 'color' }, { node: product.nodeId, socket: 'a' });
    checks.check('connect cria a ligação', linked.links.length === 1);
    checks.check('repetir a mesma ligação devolve o mesmo grafo', connect(linked, { node: color.nodeId, socket: 'color' }, { node: product.nodeId, socket: 'a' }) === linked);
    const number = addNode(linked, 'input-float', 0, 100);
    const replaced = connect(number.document, { node: number.nodeId, socket: 'value' }, { node: product.nodeId, socket: 'a' });
    checks.check('uma entrada aceita só uma ligação: a nova substitui a antiga', replaced.links.length === 1 && linkInto(replaced, { node: product.nodeId, socket: 'a' })?.from.node === number.nodeId);
    checks.check('um nó não liga em si mesmo', connect(linked, { node: product.nodeId, socket: 'value' }, { node: product.nodeId, socket: 'b' }) === linked);
    checks.check('connect recusa fechar um ciclo', connect(linked, { node: product.nodeId, socket: 'value' }, { node: color.nodeId, socket: 'x' }) === linked);
    const moved = moveNodes(linked, new Set([color.nodeId]), 10, -5);
    checks.check('moveNodes desloca só os nós pedidos', moved.nodes[1].x === 10 && moved.nodes[1].y === -5 && moved.nodes[2].x === 100);
    const valued = setNodeValue(linked, color.nodeId, 'color', [1, 0, 0]);
    checks.check('setNodeValue guarda o valor sem tocar no grafo anterior', valued.nodes[1].values.color !== undefined && linked.nodes[1].values.color === undefined);
    const removed = removeNodes(linked, new Set([color.nodeId, output.id]));
    checks.check('removeNodes leva as ligações do nó e preserva a saída', removed.nodes.length === 2 && removed.links.length === 0 && removed.nodes.some((node) => node.id === output.id));
    checks.check('disconnect de uma ligação inexistente devolve o mesmo grafo', disconnect(linked, 'nenhuma') === linked);
    checks.check('disconnect tira a ligação pedida', disconnect(linked, linked.links[0].id).links.length === 0);
}
function parsing(): void {
    const scene = addNode(createShaderGraph('post'), 'post-scene-color', 0, 0);
    const graph = connect(scene.document, { node: scene.nodeId, socket: 'color' }, { node: 'n1', socket: 'color' });
    checks.check('um grafo salvo volta igual', JSON.stringify(parseShaderGraph(JSON.parse(JSON.stringify(graph)))) === JSON.stringify(graph));
    checks.check('formato desconhecido é recusado', parseShaderGraph({ ...graph, format: 'outro' }) === null);
    checks.check('modelo desconhecido é recusado', parseShaderGraph({ ...graph, model: 'vertex' }) === null);
    checks.check('grafo sem nó de saída é recusado', parseShaderGraph({ ...graph, nodes: graph.nodes.slice(1) }) === null);
    const dangling = parseShaderGraph({ ...graph, links: [...graph.links, { id: 'l9', from: { node: 'ausente', socket: 'x' }, to: { node: 'n1', socket: 'color' } }] });
    checks.check('ligações para nós ausentes são descartadas', dangling?.links.length === 1);
    const malformed = parseShaderGraph({ ...graph, nodes: [{ ...graph.nodes[0], values: { valido: 1, invalido: { x: 1 } } }, graph.nodes[1]] });
    checks.check('valores malformados de um nó são ignorados', malformed?.nodes[0].values.valido === 1 && malformed.nodes[0].values.invalido === undefined);
}
editing();
parsing();
checks.finish();
