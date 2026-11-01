'use client';
import { Sparkles } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { VFX_TEMPLATES } from '@/engine/vfx/document/vfx-templates';
import { createVfxEffect } from '@/engine/editor/operations/vfx-operations';
import { attachVfx, canCarryVfx } from '@/engine/editor/operations/vfx-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { AudioPresetsMenu } from './audio/audio-presets-menu';
const TEMPLATE_PRESETS = VFX_TEMPLATES.map(({ id, label, description }) => ({ id, label, description }));
export function VfxAttachSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    if (entity.vfx || !canCarryVfx(entity))
        return null;
    const hasEffects = session.library.byKind('vfx').length > 0;
    return (<CollapsibleSection title="Efeito visual" defaultOpen={false}>
      <ActionRow>
        <ActionButton icon={Sparkles} variant="primary" title={hasEffects ? 'Toca um efeito da biblioteca a partir deste ator' : 'Cria uma fogueira neste ator e a abre no editor de efeitos'} onClick={() => {
            if (hasEffects)
                attachVfx(session, entity);
            else
                void createVfxEffect(session, 'campfire', { stage: null }).then((asset) => asset && attachVfx(session, entity, asset.id));
        }}>
          {hasEffects ? 'Anexar efeito' : 'Criar efeito'}
        </ActionButton>
        <AudioPresetsMenu title="Novo efeito a partir de um modelo" label="Modelos" presets={TEMPLATE_PRESETS} onPick={(templateId) => void createVfxEffect(session, templateId, { stage: null }).then((asset) => asset && attachVfx(session, entity, asset.id))}/>
      </ActionRow>
      <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">
        {entity.kind === 'character' ? 'Poeira nos passos, aura de cura, rastro de velocidade: o efeito nasce do personagem e vai junto com ele.' : 'Fumaça de uma chaminé, fagulhas de um motor, brilho de um item: o efeito nasce deste ator e o acompanha quando ele se move.'}
      </p>
    </CollapsibleSection>);
}
