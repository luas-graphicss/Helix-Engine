'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { Clapperboard } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { SelectField } from '@/engine/ui/select-field';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { animationDocumentsVersion, getAnimationDocument, subscribeAnimationDocuments } from '@/engine/animation/clip-registry';
import type { LocomotionBinding, LocomotionStateKey } from '@/engine/character/assets/character-model-asset';
import { CHARACTER_CLIP_STATES, type CharacterClipState, type CharacterSettings } from '@/engine/character/character-settings';
import type { Entity } from '@/engine/core/scene/entity';
import { riggedEntities, rigOwnerOf } from '@/engine/editor/animation/animation-editor';
import { ensureAnimationDocument } from '@/engine/editor/operations/animation-operations';
import { setCharacterClip } from '@/engine/editor/operations/character-operations';
import { setPlayerClip } from '@/engine/editor/operations/player-operations';
import { useDockLayoutStore } from '@/engine/editor/layout/dock-layout-context';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { useCharacterModels } from './character-model-select';
import { Hint } from './panel-text';
const STATE_LABEL: Record<LocomotionStateKey, string> = {
    idle: 'Parado',
    walk: 'Andar',
    run: 'Correr',
    crouch: 'Agachado',
    jump: 'Pulo',
    fall: 'Queda',
    land: 'Aterrissagem',
};
const MODEL_CLIP = '';
function describeBinding(binding: LocomotionBinding | undefined): string {
    if (!binding)
        return 'Clipe do modelo';
    switch (binding.source) {
        case 'file':
            return `Do modelo: ${binding.clipName ?? ''}`;
        case 'fallback':
            return `Do modelo: ${binding.clipName} (substituto)`;
        case 'procedural':
            return 'Procedural';
        case 'none':
            return 'Sem clipe no modelo';
    }
}
type AnimationSectionProps = {
    entity?: Entity;
};
export function AnimationSection({ entity }: AnimationSectionProps) {
    const session = useEditorState();
    const dock = useDockLayoutStore();
    const models = useCharacterModels();
    useSyncExternalStore(subscribeAnimationDocuments, animationDocumentsVersion, animationDocumentsVersion);
    const settings: CharacterSettings = entity?.character ?? session.scene.player.character;
    const asset = models.find((model) => model.id === settings.model) ?? null;
    const animations = session.library.byKind('animation');
    const options = [{ value: MODEL_CLIP, label: asset ? 'Clipe do modelo' : 'Clipe do modelo (ao carregar)' }, ...animations.map((animation) => ({ value: animation.id, label: animation.name }))];
    const missing = CHARACTER_CLIP_STATES.map((state) => settings.clips[state]).filter((id): id is string => id !== undefined && getAnimationDocument(id) === null);
    const missingKey = missing.join('|');
    useEffect(() => {
        for (const id of missingKey ? missingKey.split('|') : [])
            void ensureAnimationDocument(session, id);
    }, [missingKey, session]);
    const assign = (state: CharacterClipState, value: string) => {
        const assetId = value === MODEL_CLIP ? null : value;
        if (entity)
            setCharacterClip(session, entity, state, assetId);
        else
            setPlayerClip(session, state, assetId);
    };
    const animateTarget = entity ?? session.selectedEntity ?? null;
    const rigged = (animateTarget ? rigOwnerOf(animateTarget) : null) ?? riggedEntities(session)[0] ?? null;
    return (<CollapsibleSection title="Animações" defaultOpen={false}>
      {CHARACTER_CLIP_STATES.map((state) => {
            const chosen = settings.clips[state];
            const known = chosen === undefined || animations.some((animation) => animation.id === chosen);
            return (<PropertyRow key={state} label={STATE_LABEL[state]}>
            <SelectField label={`Clipe do estado ${STATE_LABEL[state]}`} options={known ? options : [...options, { value: chosen, label: 'Animação removida da biblioteca' }]} value={chosen ?? MODEL_CLIP} onChange={(value) => assign(state, value)}/>
          </PropertyRow>);
        })}
      {asset &&
            CHARACTER_CLIP_STATES.map((state) => {
                if (settings.clips[state])
                    return null;
                return (<PropertyRow key={`${state}-model`} label="">
              <FieldInput readOnly value={describeBinding(asset.bindings.find((binding) => binding.state === state))} aria-label={`Origem do clipe do estado ${STATE_LABEL[state]}`} className="opacity-70"/>
            </PropertyRow>);
            })}
      <ActionRow>
        <ActionButton icon={Clapperboard} variant="primary" disabled={!rigged} onClick={() => {
            if (!rigged)
                return;
            if (session.animation.active)
                session.animation.addPerformer(rigged);
            else
                session.animation.newClip(rigged);
            dock.open('animation');
        }}>
          {session.animation.active ? 'Levar ao editor de animação' : 'Criar animação'}
        </ActionButton>
      </ActionRow>
      <Hint>
        {animations.length === 0
            ? 'Animações criadas no editor ou importadas (.hxanim, BVH, glTF/FBX só com esqueleto) aparecem aqui para cada estado. Pulo, queda e aterrissagem são sobreposições procedurais.'
            : 'Clipes da biblioteca são adaptados ao esqueleto do modelo pelos nomes dos ossos; a velocidade de referência do clipe sincroniza o passo com o chão.'}
      </Hint>
    </CollapsibleSection>);
}
