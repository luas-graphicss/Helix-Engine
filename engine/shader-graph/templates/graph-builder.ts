import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { OUTPUT_NODE_TYPE, SHADER_GRAPH_FORMAT, SHADER_GRAPH_VERSION, type GraphLink, type GraphNode, type GraphValue, type ShaderGraphDocument, } from '../document/graph-document';
const OUTPUT_X = 760;
const OUTPUT_Y = 140;
export class GraphBuilder {
    readonly output: string;
    private readonly nodes: GraphNode[] = [];
    private readonly links: GraphLink[] = [];
    constructor(private readonly model: ShaderModel) {
        this.output = this.node(OUTPUT_NODE_TYPE[model], OUTPUT_X, OUTPUT_Y);
    }
    node(type: string, x: number, y: number, values: Readonly<Record<string, GraphValue>> = {}): string {
        const id = `n${this.nodes.length + 1}`;
        this.nodes.push({ id, type, x, y, values });
        return id;
    }
    link(fromNode: string, fromSocket: string, toNode: string, toSocket: string): this {
        this.links.push({ id: `l${this.links.length + 1}`, from: { node: fromNode, socket: fromSocket }, to: { node: toNode, socket: toSocket } });
        return this;
    }
    build(): ShaderGraphDocument {
        return { format: SHADER_GRAPH_FORMAT, version: SHADER_GRAPH_VERSION, model: this.model, nodes: [...this.nodes], links: [...this.links] };
    }
}
