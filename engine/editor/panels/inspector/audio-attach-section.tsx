'use client';
import { Radio, Volume2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { attachAudioSource, attachAudioZone, canCarryAudio } from '@/engine/editor/operations/audio-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
export function AudioAttachSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    if (entity.kind === 'sound' || !canCarryAudio(entity))
        return null;
    const needsSource = entity.audioSource === null;
    const needsZone = entity.audioZone === null;
    if (!needsSource && !needsZone)
        return null;
    return (<CollapsibleSection title="Áudio" defaultOpen={false}>
      <ActionRow>
        {needsSource && (<ActionButton icon={Volume2} variant="primary" title="Toca um áudio da biblioteca a partir da posição deste ator" onClick={() => attachAudioSource(session, entity)}>
            Anexar fonte de som
          </ActionButton>)}
        {needsZone && (<ActionButton icon={Radio} variant="primary" title="Reverberação, eco, filtro e cama ambiente onde o ouvinte estiver dentro deste ator" onClick={() => attachAudioZone(session, entity)}>
            Anexar zona acústica
          </ActionButton>)}
      </ActionRow>
      <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">
        A fonte segue o ator (motor de um carro, rádio numa mesa); a zona faz do volume dele um lugar com acústica própria.
      </p>
    </CollapsibleSection>);
}
