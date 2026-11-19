import { SHADER_MODEL_LABEL, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { OUTPUT_NODE_TYPE, type GraphNode, type ShaderGraphDocument, type SocketRef } from '../document/graph-document';
import { numberOf, numbersOf, textOf } from '../document/graph-values';
import { outputPins } from '../nodes/catalog/output-nodes';
import { nodeDefinition, supportsModel } from '../nodes/node-catalog';
import type { NodeDefinition, NodeEmitContext, NodeParam } from '../nodes/node-definition';
import { convert, literal, widestType, type SocketType } from '../nodes/socket-types';
import { evaluationOrder, indexIncomingLinks, socketKey } from './graph-analysis';
import { GlslWriter, type GraphUniform } from './glsl-writer';
export interface GraphDiagnostic {
    readonly severity: 'error' | 'warning';
    readonly message: string;
    readonly nodeId: string | null;
}
export interface CompiledGraph {
    readonly model: ShaderModel;
    readonly source: string;
    readonly uniforms: readonly GraphUniform[];
    readonly diagnostics: readonly GraphDiagnostic[];
    readonly animated: boolean;
    readonly translucent: boolean;
}
interface OutputValue {
    readonly name: string;
    readonly type: SocketType;
}
interface NodeEmission {
    readonly node: GraphNode;
    readonly index: number;
    readonly definition: NodeDefinition;
    readonly model: ShaderModel;
    readonly writer: GlslWriter;
    readonly values: Map<string, OutputValue>;
    sourceOf(target: SocketRef): OutputValue | null;
}
function failure(model: ShaderModel, message: string): CompiledGraph {
    return { model, source: '', uniforms: [], diagnostics: [{ severity: 'error', message, nodeId: null }], animated: false, translucent: false };
}
function findParam(definition: NodeDefinition, id: string): NodeParam {
    const param = definition.params?.find((candidate) => candidate.id === id);
    if (!param)
        throw new Error(`O nó "${definition.type}" não tem o parâmetro "${id}".`);
    return param;
}
function emitNode({ node, index, definition, model, writer, values, sourceOf }: NodeEmission): void {
    const linkedAutoTypes: SocketType[] = [];
    for (const input of definition.inputs) {
        const source = input.type === 'auto' ? sourceOf({ node: node.id, socket: input.id }) : null;
        if (source)
            linkedAutoTypes.push(source.type);
    }
    const resolvedType = widestType(linkedAutoTypes);
    let localCount = 0;
    const context: NodeEmitContext = {
        model,
        resolvedType,
        input: (id) => {
            const socket = definition.inputs.find((candidate) => candidate.id === id);
            if (!socket)
                throw new Error(`O nó "${definition.type}" não tem a entrada "${id}".`);
            const target = socket.type === 'auto' ? resolvedType : socket.type;
            const source = sourceOf({ node: node.id, socket: id });
            if (source)
                return convert(source.name, source.type, target);
            if (socket.builtin) {
                const builtin = writer.builtin(socket.builtin);
                return convert(builtin.expression, builtin.type, target);
            }
            const inlineType = socket.type === 'auto' ? 'float' : socket.type;
            return convert(literal(inlineType, numbersOf(node.values[id], socket.fallback ?? [0])), inlineType, target);
        },
        number: (id) => {
            const param = findParam(definition, id);
            return numberOf(node.values[id], param.kind === 'number' ? param.fallback : 0);
        },
        text: (id) => {
            const param = findParam(definition, id);
            return textOf(node.values[id], param.kind === 'select' || param.kind === 'text' ? param.fallback : '');
        },
        components: (id) => {
            const param = findParam(definition, id);
            return numbersOf(node.values[id], param.kind === 'color' || param.kind === 'vector' ? param.fallback : [0]);
        },
        builtin: (name) => writer.builtin(name).expression,
        local: (type, expression) => {
            const name = `n${index}_t${localCount++}`;
            writer.declare(type, name, expression);
            return name;
        },
        numericUniform: (key, type, value) => writer.numericUniform(key, type, value),
        textureUniform: (assetId, colorSpace) => writer.textureUniform(assetId, colorSpace),
        include: (chunk) => writer.include(chunk),
    };
    const expressions = definition.emit(context);
    for (const output of definition.outputs) {
        const expression = expressions[output.id];
        if (expression === undefined)
            continue;
        const type = output.type === 'auto' ? resolvedType : output.type;
        const name = `n${index}_${output.id}`;
        writer.declare(type, name, expression);
        values.set(socketKey({ node: node.id, socket: output.id }), { name, type });
    }
}
export function compileShaderGraph(document: ShaderGraphDocument): CompiledGraph {
    const { model } = document;
    const outputNode = document.nodes.find((node) => node.type === OUTPUT_NODE_TYPE[model]);
    if (!outputNode)
        return failure(model, 'O grafo não tem nó de saída.');
    const order = evaluationOrder(document, outputNode.id);
    if (!order)
        return failure(model, 'Há um ciclo no grafo: um nó não pode alimentar a própria entrada.');
    const writer = new GlslWriter(model);
    const incoming = indexIncomingLinks(document.links);
    const values = new Map<string, OutputValue>();
    const diagnostics: GraphDiagnostic[] = [];
    const sourceOf = (target: SocketRef): OutputValue | null => {
        const link = incoming.get(socketKey(target));
        return link ? (values.get(socketKey(link.from)) ?? null) : null;
    };
    order.forEach((node, index) => {
        if (node === outputNode)
            return;
        const definition = nodeDefinition(node.type);
        if (!definition) {
            diagnostics.push({ severity: 'error', message: `Nó desconhecido "${node.type}".`, nodeId: node.id });
            return;
        }
        if (!supportsModel(definition, model)) {
            diagnostics.push({ severity: 'error', message: `"${definition.label}" não existe em grafos de ${SHADER_MODEL_LABEL[model]}.`, nodeId: node.id });
            return;
        }
        emitNode({ node, index, definition, model, writer, values, sourceOf });
    });
    let connectedPins = 0;
    let translucent = false;
    for (const pin of outputPins(model)) {
        const source = sourceOf({ node: outputNode.id, socket: pin.id });
        if (!source) {
            if (pin.fallback)
                writer.statement(pin.fallback);
            continue;
        }
        connectedPins++;
        translucent ||= pin.translucent === true;
        writer.statement(pin.write(convert(source.name, source.type, pin.type)));
    }
    if (connectedPins === 0)
        diagnostics.push({ severity: 'warning', message: 'Nada está ligado à saída: o grafo ainda não muda a imagem.', nodeId: outputNode.id });
    const failed = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
    return { model, source: failed ? '' : writer.assemble(), uniforms: failed ? [] : writer.uniforms, diagnostics, animated: writer.animated, translucent };
}
