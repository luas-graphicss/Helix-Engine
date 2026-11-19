import type { ShaderGraphDocument } from '../document/graph-document';
import { GraphBuilder } from './graph-builder';
export function vignetteAberrationGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('post');
    const aberration = graph.node('post-chromatic-aberration', 120, 60);
    const vignette = graph.node('post-vignette', 120, 220);
    const combined = graph.node('math-multiply', 460, 120);
    graph.link(aberration, 'color', combined, 'a').link(vignette, 'mask', combined, 'b').link(combined, 'value', graph.output, 'color');
    return graph.build();
}
export function pixelArtGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('post');
    const blocks = graph.node('post-pixelate', 20, 100, { size: 6 });
    const scene = graph.node('post-scene-color', 270, 100);
    const palette = graph.node('effect-posterize', 510, 100, { steps: 6 });
    graph.link(blocks, 'uv', scene, 'uv').link(scene, 'color', palette, 'x').link(palette, 'value', graph.output, 'color');
    return graph.build();
}
export function noirGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('post');
    const scene = graph.node('post-scene-color', 20, 60);
    const luminance = graph.node('effect-luminance', 260, 60);
    const contrast = graph.node('math-smoothstep', 500, 60, { edge0: 0.08, edge1: 0.85 });
    const grain = graph.node('post-grain', 260, 260, { amount: 0.1 });
    const combined = graph.node('math-add', 500, 260);
    graph.link(scene, 'color', luminance, 'color').link(luminance, 'value', contrast, 'x');
    graph.link(contrast, 'value', combined, 'a').link(grain, 'grain', combined, 'b').link(combined, 'value', graph.output, 'color');
    return graph.build();
}
export function outlineGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('post');
    const scene = graph.node('post-scene-color', 60, 40);
    const edge = graph.node('post-edge', 60, 200);
    const paper = graph.node('math-one-minus', 300, 200);
    const inked = graph.node('math-multiply', 520, 100);
    graph.link(edge, 'edge', paper, 'x').link(scene, 'color', inked, 'a').link(paper, 'value', inked, 'b').link(inked, 'value', graph.output, 'color');
    return graph.build();
}
