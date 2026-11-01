'use client';
import { Locate, MapPinPlus } from 'lucide-react';
import { VFX_MAX_DURATION, vfxParticleBudget, type VfxDocument } from '@/engine/vfx/document/vfx-document';
import { renameLibraryAsset } from '@/engine/editor/operations/asset-library-operations';
import { endVfxDocumentEdit, ensureVfxStage, patchVfxDocument, vfxMergeKey } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useVfxEditor, useVfxStage } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField } from '@/engine/ui/toggle-field';
import { NumberRow } from '../fields/number-row';
export function EffectSection({ document }: {
    document: VfxDocument;
}) {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const stage = useVfxStage();
    const asset = editor.assetId ? session.library.get(editor.assetId) : null;
    const end = () => endVfxDocumentEdit(session);
    const budget = vfxParticleBudget(document);
    return (<>
      <CollapsibleSection title="Efeito">
        <PropertyRow label="Nome">
          <FieldInput key={`${editor.assetId}-${document.name}`} defaultValue={document.name} aria-label="Nome do efeito" onBlur={(event) => {
            const name = event.currentTarget.value.trim();
            if (!name || name === document.name)
                return;
            if (asset)
                renameLibraryAsset(session, asset, name);
            else
                patchVfxDocument(session, { name }, 'Renomear efeito');
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = document.name;
                event.currentTarget.blur();
            }
        }}/>
        </PropertyRow>
        <NumberRow label="Ciclo" value={document.duration} min={0.05} max={VFX_MAX_DURATION} step={0.1} unit="s" onChange={(duration) => patchVfxDocument(session, { duration }, 'Duração do ciclo', vfxMergeKey('duration'))} onEnd={end}/>
        <ToggleField label="Repetir" on={document.loop} onToggle={() => patchVfxDocument(session, { loop: !document.loop }, document.loop ? 'Efeito toca uma vez' : 'Efeito em laço')}/>
        <NumberRow label="Pré-aquecer" value={document.prewarm} min={0} max={VFX_MAX_DURATION} step={0.1} unit="s" onChange={(prewarm) => patchVfxDocument(session, { prewarm }, 'Pré-aquecimento', vfxMergeKey('prewarm'))} onEnd={end}/>
        <NumberRow label="Escala" value={document.scale} min={0.01} max={100} step={0.05} unit="×" onChange={(scale) => patchVfxDocument(session, { scale }, 'Escala do efeito', vfxMergeKey('scale'))} onEnd={end}/>
        <NumberRow label="Raio de corte" value={document.cullRadius} min={0} step={0.5} unit="m" onChange={(cullRadius) => patchVfxDocument(session, { cullRadius }, 'Raio de culling', vfxMergeKey('cullRadius'))} onEnd={end}/>
      </CollapsibleSection>
      <CollapsibleSection title="Palco">
        <PropertyRow label="Ator">
          <FieldInput readOnly value={stage.entity ? stage.entity.name : 'Nenhum ator toca este efeito'} aria-label="Ator-palco"/>
        </PropertyRow>
        <ActionRow>
          {stage.entity ? (<ActionButton icon={Locate} title="Seleciona e enquadra o ator-palco no viewport" onClick={() => stage.entity && (session.select(stage.entity), session.focusEntity(stage.entity))}>
              Enquadrar palco
            </ActionButton>) : (<ActionButton icon={MapPinPlus} variant="primary" title="Coloca um ator de efeito sobre o alvo da câmera para ver o efeito ao vivo" onClick={() => ensureVfxStage(session)}>
              Colocar na cena
            </ActionButton>)}
        </ActionRow>
        <PropertyRow label="Orçamento">
          <FieldInput readOnly value={`${document.emitters.filter((emitter) => emitter.enabled).length} de ${document.emitters.length} emissores · até ${budget.toLocaleString('pt-BR')} partículas`} aria-label="Orçamento do efeito"/>
        </PropertyRow>
      </CollapsibleSection>
    </>);
}
