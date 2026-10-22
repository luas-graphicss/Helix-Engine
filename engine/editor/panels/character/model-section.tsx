'use client';
import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { IMPORT_ACCEPT } from '@/engine/assets/import/import-registry';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { importCharacterModelFiles, setPlayerModel } from '@/engine/editor/operations/player-operations';
import { CharacterModelSelect, useCharacterModels } from './character-model-select';
import { Hint } from './panel-text';
export function ModelSection({ disabled }: {
    disabled: boolean;
}) {
    const session = useEditorState();
    const models = useCharacterModels();
    const inputRef = useRef<HTMLInputElement>(null);
    const { character } = session.scene.player;
    const asset = models.find((model) => model.id === character.model) ?? null;
    const mannequinLoading = models.length === 0;
    return (<CollapsibleSection title="Modelo">
      <PropertyRow label="Modelo">
        <CharacterModelSelect value={character.model} disabled={disabled} onChange={(id) => setPlayerModel(session, id)}/>
      </PropertyRow>
      <ActionRow>
        <ActionButton icon={FileUp} variant="primary" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Importar modelo…
        </ActionButton>
      </ActionRow>
      <input ref={inputRef} type="file" multiple accept={IMPORT_ACCEPT} className="hidden" tabIndex={-1} aria-label="Arquivo do modelo do personagem" onChange={(event) => {
            const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
            event.currentTarget.value = '';
            if (files.length > 0)
                void importCharacterModelFiles(session, files);
        }}/>

      {asset ? (<>
          <PropertyRow label="Arquivo">
            <FieldInput readOnly value={asset.source} aria-label="Arquivo de origem do modelo"/>
          </PropertyRow>
          <PropertyRow label="Esqueleto">
            <FieldInput readOnly value={asset.template ? `${asset.jointCount} juntas` : 'Sem esqueleto'} aria-label="Esqueleto do modelo"/>
          </PropertyRow>
          <PropertyRow label="Clipes">
            <FieldInput readOnly value={String(asset.animationNames.length)} aria-label="Clipes de animação do modelo"/>
          </PropertyRow>
          <PropertyRow label="Triângulos">
            <FieldInput readOnly value={asset.triangles.toLocaleString('pt-BR')} aria-label="Triângulos do modelo"/>
          </PropertyRow>
          {!asset.template && <Hint>Modelo estático: acompanha a cápsula e gira com ela, mas não anima. Para animar, importe um glTF/GLB com esqueleto.</Hint>}
          {asset.template && !asset.clips && <Hint>Sem clipes no arquivo: o modelo fica na pose de repouso enquanto se move. O retarget dos ciclos do manequim chega com o sistema de animação.</Hint>}
        </>) : (<Hint>{mannequinLoading ? 'Carregando o manequim…' : 'Este modelo não está carregado nesta sessão; o jogador veste o manequim até você reimportá-lo.'}</Hint>)}
      <Hint>Um glTF/GLB com esqueleto e ciclos nomeados (idle, walk, run, crouch) entra animado; a escala é ajustada à altura da cápsula automaticamente.</Hint>
    </CollapsibleSection>);
}
