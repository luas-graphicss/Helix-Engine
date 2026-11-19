'use client';
import { Layers } from 'lucide-react';
import { ExtensionInspectorSections } from '@/engine/editor/extensions/ui/inspectors/extension-inspector-sections';
import { editableTransformRoots, selectionEditBlock, setSelectionTransformAxis, sharedTransformAxes } from '@/engine/editor/operations/selection-transform-operations';
import { FIELD_LABEL } from '@/engine/editor/operations/transform-operations';
import { useLiveEdits } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { PropertyRow } from '@/engine/ui/property-row';
import { Vector3Input } from './number-fields';

const FIELDS = ['position', 'rotation', 'scale'] as const;
const BLOCK_NOTICE = {
    playtest: 'Pare a simulação para editar a seleção.',
    animation: 'Feche o editor de animação para editar vários atores ao mesmo tempo.',
} as const;

export function SelectionInspector() {
    const session = useLiveEdits();
    const total = session.selectedIds.size;
    const targets = editableTransformRoots(session);
    const blocked = selectionEditBlock(session);
    return (
        <section className="flex h-full min-h-0 flex-col" aria-label="Inspetor da seleção">
            <PanelToolbar className="gap-1.5 pl-2">
                <Layers className="size-3.5 shrink-0 text-primary" aria-hidden/>
                <h2 className="truncate text-2xs font-semibold">{total} atores selecionados</h2>
            </PanelToolbar>
            <div className="min-h-0 flex-1 overflow-auto">
                <CollapsibleSection title="Transformação local">
                    {targets.length > 0 ? (
                        <fieldset disabled={blocked !== null} className="min-w-0">
                            <legend className="sr-only">Coordenadas locais dos atores editáveis</legend>
                            {FIELDS.map((field) => (
                                <PropertyRow key={field} label={FIELD_LABEL[field]}>
                                    <Vector3Input label={FIELD_LABEL[field]} values={sharedTransformAxes(targets, field)}
                                        suffix={field === 'rotation' ? '°' : ''} decimals={field === 'rotation' ? 2 : 3}
                                        onCommit={(axis, value) => setSelectionTransformAxis(session, targets, field, axis, value)}/>
                                </PropertyRow>
                            ))}
                        </fieldset>
                    ) : null}
                    <p className="px-2 py-1.5 text-2xs leading-relaxed text-muted-foreground">
                        {blocked ? BLOCK_NOTICE[blocked] : targets.length === 0 ? 'Nenhum ator editável nesta seleção.' : 'O traço (—) indica valores diferentes. Edite um eixo para aplicar o mesmo valor aos atores editáveis.'}
                    </p>
                    {targets.length !== total && (
                        <p className="px-2 pb-2 text-2xs leading-relaxed text-muted-foreground">
                            {targets.length} de {total} editáveis. Atores bloqueados, scripts e filhos de outro ator selecionado não são editados diretamente.
                        </p>
                    )}
                </CollapsibleSection>
                <ExtensionInspectorSections selection={session.selectedEntities()}/>
            </div>
        </section>
    );
}
