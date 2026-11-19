import type { ShaderGraphDocument } from '../document/graph-document';
import { GraphBuilder } from './graph-builder';
export function texturedPbrGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const albedo = graph.node('texture-sample', 60, 20);
    const tint = graph.node('input-property-color', 60, 220, { name: 'Tonalidade', color: [1, 1, 1] });
    const tinted = graph.node('math-multiply', 400, 60);
    const normal = graph.node('texture-normal-map', 400, 200);
    const packed = graph.node('texture-sample', 60, 380, { space: 'linear' });
    graph.link(albedo, 'rgb', tinted, 'a').link(tint, 'color', tinted, 'b').link(tinted, 'value', graph.output, 'baseColor');
    graph.link(normal, 'normal', graph.output, 'normal');
    graph.link(packed, 'r', graph.output, 'occlusion').link(packed, 'g', graph.output, 'roughness');
    return graph.build();
}
export function dissolveGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const noise = graph.node('noise-fractal', 60, 60, { scale: 5 });
    const amount = graph.node('input-property-float', 60, 200, { name: 'Dissolucao', value: 0.45 });
    const dissolve = graph.node('effect-dissolve', 400, 100);
    const base = graph.node('input-color', 400, -40, { color: [0.55, 0.6, 0.68] });
    graph.link(noise, 'value', dissolve, 'noise').link(amount, 'value', dissolve, 'amount');
    graph.link(base, 'color', graph.output, 'baseColor').link(dissolve, 'glow', graph.output, 'emissive').link(dissolve, 'mask', graph.output, 'clip');
    return graph.build();
}
export function hologramGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const tint = graph.node('input-property-color', 60, 60, { name: 'Cor', color: [0.1, 0.8, 1] });
    const hologram = graph.node('effect-hologram', 400, 100);
    const base = graph.node('input-color', 400, -40, { color: [0, 0.02, 0.03] });
    graph.link(tint, 'color', hologram, 'color');
    graph.link(base, 'color', graph.output, 'baseColor').link(hologram, 'glow', graph.output, 'emissive').link(hologram, 'opacity', graph.output, 'alpha');
    return graph.build();
}
export function waterGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const water = graph.node('effect-water', 380, 60);
    const roughness = graph.node('input-float', 380, 320, { value: 0.06 });
    graph.link(water, 'color', graph.output, 'baseColor').link(water, 'normal', graph.output, 'normal').link(roughness, 'value', graph.output, 'roughness');
    return graph.build();
}
export function lavaGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const lava = graph.node('effect-lava', 60, 80);
    const relief = graph.node('shading-height-normal', 400, 280, { strength: 0.12 });
    graph.link(lava, 'height', relief, 'height');
    graph.link(lava, 'color', graph.output, 'baseColor').link(lava, 'glow', graph.output, 'emissive').link(lava, 'roughness', graph.output, 'roughness').link(relief, 'normal', graph.output, 'normal');
    return graph.build();
}
export function toonGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const light = graph.node('shading-light', 40, 40);
    const ramp = graph.node('shading-toon-ramp', 290, 40, { steps: 3 });
    const color = graph.node('input-property-color', 40, 240, { name: 'Cor', color: [0.95, 0.45, 0.25] });
    const shaded = graph.node('math-multiply', 520, 100);
    const rim = graph.node('shading-fresnel', 40, 420, { power: 4 });
    const outline = graph.node('math-step', 290, 420, { edge: 0.6 });
    const combined = graph.node('math-add', 520, 300);
    const base = graph.node('input-color', 520, -60, { color: [0, 0, 0] });
    const roughness = graph.node('input-float', 520, 470, { value: 1 });
    graph.link(light, 'wrapped', ramp, 'value').link(ramp, 'value', shaded, 'a').link(color, 'color', shaded, 'b');
    graph.link(rim, 'value', outline, 'x').link(shaded, 'value', combined, 'a').link(outline, 'value', combined, 'b');
    graph.link(base, 'color', graph.output, 'baseColor').link(combined, 'value', graph.output, 'emissive').link(roughness, 'value', graph.output, 'roughness');
    return graph.build();
}
export function rustedMetalGraph(): ShaderGraphDocument {
    const graph = new GraphBuilder('surface');
    const noise = graph.node('noise-fractal', 20, 120, { scale: 6 });
    const rust = graph.node('math-smoothstep', 250, 120, { edge0: 0.42, edge1: 0.62 });
    const metal = graph.node('input-color', 250, -80, { color: [0.56, 0.57, 0.6] });
    const oxide = graph.node('input-color', 250, 10, { color: [0.42, 0.16, 0.06] });
    const albedo = graph.node('math-lerp', 500, -40);
    const metallic = graph.node('math-one-minus', 500, 110);
    const roughness = graph.node('math-lerp', 500, 200, { a: 0.3, b: 0.9 });
    const relief = graph.node('shading-height-normal', 500, 350, { strength: 0.08 });
    graph.link(noise, 'value', rust, 'x').link(metal, 'color', albedo, 'a').link(oxide, 'color', albedo, 'b').link(rust, 'value', albedo, 't');
    graph.link(rust, 'value', metallic, 'x').link(rust, 'value', roughness, 't').link(noise, 'value', relief, 'height');
    graph.link(albedo, 'value', graph.output, 'baseColor').link(metallic, 'value', graph.output, 'metallic').link(roughness, 'value', graph.output, 'roughness').link(relief, 'normal', graph.output, 'normal');
    return graph.build();
}
