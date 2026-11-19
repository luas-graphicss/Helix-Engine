import type { EditorSession } from '@/engine/editor/session/editor-session';
import { buildEffect } from '@/engine/vfx-graph/templates/effect-builder';
import { STARTER_SYSTEM } from '@/engine/vfx-graph/templates/starter-system';
import { findEffectTemplate } from '@/engine/vfx-graph/templates/template-catalog';
const LOG_SOURCE = 'Visual Effect Graph';
const BLANK_NAME = 'Efeito';
export function createBlankEffectGraph(session: EditorSession): void {
    const record = session.vfxGraph.create(BLANK_NAME, buildEffect([STARTER_SYSTEM]));
    session.log.info(LOG_SOURCE, `${record.name} criado com um sistema de partículas inicial.`);
}
export function createEffectGraphFromTemplate(session: EditorSession, templateId: string): void {
    const template = findEffectTemplate(templateId);
    if (!template) {
        session.log.warn(LOG_SOURCE, `Modelo de efeito desconhecido: ${templateId}.`);
        return;
    }
    const record = session.vfxGraph.create(template.label, template.build());
    session.log.info(LOG_SOURCE, `${record.name} criado a partir do modelo ${template.label}.`);
}
export function deleteActiveEffectGraph(session: EditorSession): void {
    const { active } = session.vfxGraph;
    if (!active)
        return;
    session.vfxGraph.remove(active.id);
    session.log.info(LOG_SOURCE, `${active.name} excluído.`);
}
