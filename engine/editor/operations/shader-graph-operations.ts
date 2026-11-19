import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SHADER_MODEL_LABEL, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { GraphUniform } from '@/engine/shader-graph/compiler/glsl-writer';
import { createShaderGraph } from '@/engine/shader-graph/document/graph-document';
import { findGraphTemplate } from '@/engine/shader-graph/templates/template-catalog';
import { createScript, writeScriptSource } from './script-operations';
const LOG_SOURCE = 'Shader Graph';
const BLANK_NAME: Record<ShaderModel, string> = { surface: 'Superfície', post: 'Efeito de tela' };
function describeUniform(uniform: GraphUniform): string {
    return uniform.kind === 'texture' ? `${uniform.name} (textura)` : `${uniform.name} = ${uniform.value.join(', ')}`;
}
export function createBlankShaderGraph(session: EditorSession, model: ShaderModel): void {
    const record = session.shaderGraph.create(BLANK_NAME[model], createShaderGraph(model));
    session.log.info(LOG_SOURCE, `${record.name} criado: grafo vazio de ${SHADER_MODEL_LABEL[model]}.`);
}
export function createShaderGraphFromTemplate(session: EditorSession, templateId: string): void {
    const template = findGraphTemplate(templateId);
    if (!template) {
        session.log.warn(LOG_SOURCE, `Modelo de grafo desconhecido: ${templateId}.`);
        return;
    }
    const record = session.shaderGraph.create(template.label, template.build());
    session.log.info(LOG_SOURCE, `${record.name} criado a partir do modelo ${template.label}.`);
}
export function deleteActiveShaderGraph(session: EditorSession): void {
    const { active } = session.shaderGraph;
    if (!active)
        return;
    session.shaderGraph.remove(active.id);
    session.log.info(LOG_SOURCE, `${active.name} excluído.`);
}
export function toggleShaderGraphLink(session: EditorSession): void {
    const { active, compiled, link } = session.shaderGraph;
    if (!active || !compiled)
        return;
    const target = link.linkedTarget(active.id);
    if (target !== null) {
        link.detach(active.id);
        session.log.info(LOG_SOURCE, `${active.name} removido ${target === 'viewport' ? 'do viewport' : `de ${target}`}.`);
        return;
    }
    const failure = link.attach(active, compiled);
    if (failure) {
        session.log.warn(LOG_SOURCE, failure);
        return;
    }
    const applied = link.linkedTarget(active.id);
    const where = applied === 'viewport' ? 'na cadeia de pós-processamento do viewport' : `no material de ${applied}`;
    const blendHint = compiled.translucent ? ' Para a opacidade aparecer, use o modo de mistura no material.' : '';
    session.log.info(LOG_SOURCE, `${active.name} aplicado ${where}; as edições do grafo aparecem ao vivo.${blendHint}`);
}
export async function exportShaderGraphScript(session: EditorSession): Promise<void> {
    const { shaderGraph, library } = session;
    const { active, compiled } = shaderGraph;
    if (!active || !compiled)
        return;
    if (compiled.source === '') {
        session.log.warn(LOG_SOURCE, 'Corrija os erros do grafo antes de exportar.');
        return;
    }
    const uniforms = compiled.uniforms.length > 0 ? ` Uniformes para os scripts preencherem: ${compiled.uniforms.map(describeUniform).join('; ')}.` : '';
    const existing = active.exportedAssetId ? library.get(active.exportedAssetId) : null;
    if (existing) {
        await writeScriptSource(session, existing, compiled.source);
        session.log.info(LOG_SOURCE, `${existing.name} atualizado a partir do grafo ${active.name}.${uniforms}`);
        return;
    }
    const asset = await createScript(session, { language: 'glsl', name: active.name, source: compiled.source, attachTo: null, open: false });
    if (!asset)
        return;
    shaderGraph.markExported(active.id, asset.id);
    session.log.info(LOG_SOURCE, `${asset.name} exportado do grafo ${active.name}: use-o nos scripts como qualquer shader GLSL.${uniforms}`);
}
