import { compileShaderGraph, type CompiledGraph } from '@/engine/shader-graph/compiler/graph-compiler';
import { setNodeValue } from '@/engine/shader-graph/document/graph-document';
import { GraphBuilder } from '@/engine/shader-graph/templates/graph-builder';
import { GRAPH_TEMPLATES } from '@/engine/shader-graph/templates/template-catalog';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Compilador do Shader Graph');
const ENTRY_POINT = { surface: 'void surface(inout HelixSurface s) {', post: 'void main() {' } as const;
function errorsOf(compiled: CompiledGraph): string {
    return compiled.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message).join(' | ');
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
function templates(): void {
    for (const template of GRAPH_TEMPLATES) {
        const compiled = compileShaderGraph(template.build());
        const wellFormed = compiled.source.includes(ENTRY_POINT[template.model]) && isBalanced(compiled.source) && !/undefined|NaN/.test(compiled.source);
        checks.check(`o modelo ${template.label} compila sem erros`, errorsOf(compiled) === '' && wellFormed, errorsOf(compiled) || compiled.source);
    }
}
function typing(): void {
    const graph = new GraphBuilder('surface');
    const color = graph.node('input-color', 0, 0, { color: [1, 0.5, 0.25] });
    const scale = graph.node('input-float', 0, 100, { value: 2 });
    const product = graph.node('math-multiply', 200, 0);
    graph.link(color, 'color', product, 'a').link(scale, 'value', product, 'b').link(product, 'value', graph.output, 'roughness');
    const { source } = compileShaderGraph(graph.build());
    checks.check('cor fixa vira literal GLSL', source.includes('vec3(1.0, 0.5, 0.25)'), source);
    checks.check('uma operação dinâmica assume o tipo mais largo ligado', /vec3 n\d+_value = n\d+_color \* vec3\(n\d+_value\);/.test(source), source);
    checks.check('a saída converte o vetor para o tipo do pino', /s\.roughness = clamp\(\(n\d+_value\)\.x, 0\.0, 1\.0\);/.test(source), source);
}
function defaults(): void {
    const graph = new GraphBuilder('surface');
    const noise = graph.node('noise-value', 0, 0);
    graph.link(noise, 'value', graph.output, 'roughness');
    const untouched = compileShaderGraph(graph.build());
    checks.check('entrada solta usa o valor padrão e a UV da malha', untouched.source.includes('sgValueNoise(s.uv * 8.0)'), untouched.source);
    checks.check('um trecho traz a dependência uma única vez', untouched.source.split('float sgHash(vec2 p)').length === 2, untouched.source);
    checks.check('grafo sem tempo não é animado', !untouched.animated);
    const edited = compileShaderGraph(setNodeValue(graph.build(), noise, 'scale', 3));
    checks.check('o valor editado no nó entra no GLSL', edited.source.includes('sgValueNoise(s.uv * 3.0)'), edited.source);
}
function uniforms(): void {
    const graph = new GraphBuilder('surface');
    const first = graph.node('input-property-float', 0, 0, { name: 'Brilho', value: 0.25 });
    const second = graph.node('input-property-float', 0, 100, { name: 'Brilho', value: 0.9 });
    const sum = graph.node('math-add', 200, 0);
    const texture = graph.node('texture-sample', 0, 200, { texture: 'asset-1' });
    const repeated = graph.node('texture-sample', 0, 300, { texture: 'asset-1' });
    graph.link(first, 'value', sum, 'a').link(second, 'value', sum, 'b').link(sum, 'value', graph.output, 'metallic');
    graph.link(texture, 'rgb', graph.output, 'baseColor').link(repeated, 'rgb', graph.output, 'emissive');
    const compiled = compileShaderGraph(graph.build());
    const numeric = compiled.uniforms.filter((uniform) => uniform.kind === 'numeric');
    const samplers = compiled.uniforms.filter((uniform) => uniform.kind === 'texture');
    checks.check('propriedades com o mesmo nome dividem um uniforme', numeric.length === 1 && numeric[0].name === 'sg_float_Brilho', numeric.map((uniform) => uniform.name).join(','));
    checks.check('a mesma textura ocupa um só sampler', samplers.length === 1 && compiled.source.includes('uniform sampler2D sg_texture0;'), compiled.source);
    const accented = compileShaderGraph(setNodeValue(graph.build(), first, 'name', 'Dissolução'));
    checks.check('acentos saem do nome do uniforme', accented.uniforms.some((uniform) => uniform.name === 'sg_float_Dissolucao'), accented.uniforms.map((uniform) => uniform.name).join(','));
}
function outputs(): void {
    const emptyPost = compileShaderGraph(new GraphBuilder('post').build());
    checks.check('efeito de tela sem ligações repassa a cena e avisa', emptyPost.source.includes('fragColor = texture(uSceneColor, vUv);') && emptyPost.diagnostics.some((diagnostic) => diagnostic.severity === 'warning'), emptyPost.source);
    const translucent = new GraphBuilder('surface');
    const opacity = translucent.node('input-time', 0, 0);
    translucent.link(opacity, 'wave', translucent.output, 'alpha');
    const compiled = compileShaderGraph(translucent.build());
    checks.check('ligar a opacidade marca o grafo como translúcido', compiled.translucent);
    checks.check('usar o tempo marca o grafo como animado', compiled.animated && compiled.source.includes('uTime'));
    const clipped = new GraphBuilder('surface');
    const mask = clipped.node('input-float', 0, 0, { value: 0 });
    clipped.link(mask, 'value', clipped.output, 'clip');
    checks.check('o pino de recorte descarta o pixel', compileShaderGraph(clipped.build()).source.includes('< 0.5) discard;'));
}
function failures(): void {
    const cyclic = new GraphBuilder('surface');
    const first = cyclic.node('math-add', 0, 0);
    const second = cyclic.node('math-add', 100, 0);
    cyclic.link(first, 'value', second, 'a').link(second, 'value', first, 'a').link(second, 'value', cyclic.output, 'roughness');
    const looped = compileShaderGraph(cyclic.build());
    checks.check('um ciclo é erro e não gera GLSL', looped.source === '' && errorsOf(looped).includes('ciclo'), errorsOf(looped));
    const unknown = new GraphBuilder('surface');
    unknown.link(unknown.node('nao-existe', 0, 0), 'value', unknown.output, 'roughness');
    checks.check('nó desconhecido é erro apontado no nó', compileShaderGraph(unknown.build()).diagnostics.some((diagnostic) => diagnostic.severity === 'error' && diagnostic.nodeId !== null));
    const misplaced = new GraphBuilder('surface');
    misplaced.link(misplaced.node('post-scene-color', 0, 0), 'color', misplaced.output, 'baseColor');
    const wrongModel = compileShaderGraph(misplaced.build());
    checks.check('nó de pós-processo num grafo de superfície é erro', wrongModel.source === '' && errorsOf(wrongModel).includes('Cor da cena'), errorsOf(wrongModel));
    const stale = new GraphBuilder('surface');
    stale.link(stale.node('input-color', 0, 0), 'saida-antiga', stale.output, 'baseColor');
    checks.check('ligação para uma saída que não existe é ignorada', errorsOf(compileShaderGraph(stale.build())) === '' && !compileShaderGraph(stale.build()).source.includes('s.baseColor'));
}
templates();
typing();
defaults();
uniforms();
outputs();
failures();
checks.finish();
