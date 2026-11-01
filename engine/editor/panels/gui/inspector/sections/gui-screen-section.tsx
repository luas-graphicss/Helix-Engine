'use client';
import { LayoutTemplate } from 'lucide-react';
import { GUI_ROOT_ID, type GuiDocument, type GuiScaleMode } from '@/engine/gui/document/gui-document';
import { countGuiNodes } from '@/engine/gui/document/gui-tree';
import { updateGuiDocumentSettings } from '@/engine/editor/operations/gui-element-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiColorField } from '../fields/gui-color-field';
import { GuiNumberField } from '../fields/gui-number-field';
import { useGuiEdit } from '../use-gui-edit';
const SCALE_MODE_OPTIONS: ReadonlyArray<{
    value: GuiScaleMode;
    label: string;
}> = [
    { value: 'shorter', label: 'Pelo lado menor (recomendado)' },
    { value: 'longer', label: 'Pelo lado maior' },
    { value: 'width', label: 'Pela largura' },
    { value: 'height', label: 'Pela altura' },
    { value: 'none', label: 'Fixa (pixels reais)' },
];
export function GuiScreenInspector({ document }: {
    document: GuiDocument;
}) {
    const { session, end } = useGuiEdit();
    const designer = session.gui;
    const root = document.root;
    const elements = countGuiNodes(root) - 1;
    const rename = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === document.name)
            return;
        const asset = designer.assetId ? session.library.get(designer.assetId) : null;
        if (asset)
            session.library.rename(asset, trimmed);
        else
            updateGuiDocumentSettings(session, { name: trimmed }, 'Renomear tela');
    };
    const setReference = (axis: 'x' | 'y', value: number) => updateGuiDocumentSettings(session, { referenceSize: { ...document.referenceSize, [axis]: value } }, 'Alterar resolução de referência', `screen-reference-${axis}`);
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <LayoutTemplate className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <input key={document.name} defaultValue={document.name} aria-label="Nome da tela" onBlur={(event) => rename(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = document.name;
                event.currentTarget.blur();
            }
        }} className="h-5 w-full min-w-0 bg-transparent text-xs font-semibold text-foreground outline-none"/>
          <span className="truncate font-mono text-3xs text-muted-foreground">
            Tela · {elements} {elements === 1 ? 'elemento' : 'elementos'} · {designer.assetId ? (designer.dirty ? 'alterações não salvas' : 'salva na biblioteca') : 'não guardada'}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CollapsibleSection title="Tela">
          <PropertyRow label="Referência">
            <GuiNumberField label="Largura de referência" axis="x" unit="px" value={document.referenceSize.x} min={320} max={7680} step={1} precision={0} onChange={(x) => setReference('x', x)} onEnd={end}/>
            <GuiNumberField label="Altura de referência" axis="y" unit="px" value={document.referenceSize.y} min={240} max={4320} step={1} precision={0} onChange={(y) => setReference('y', y)} onEnd={end}/>
          </PropertyRow>
          <PropertyRow label="Escala">
            <SelectField label="Como os pixels acompanham outras resoluções" options={SCALE_MODE_OPTIONS} value={document.scaleMode} onChange={(scaleMode) => updateGuiDocumentSettings(session, { scaleMode }, 'Alterar modo de escala')}/>
          </PropertyRow>
          <ToggleField label="Exibida ao iniciar" on={document.enabled} onToggle={() => updateGuiDocumentSettings(session, { enabled: !document.enabled }, document.enabled ? 'Ocultar tela no jogo' : 'Exibir tela no jogo')}/>
          <PropertyRow label="Ordem de exibição">
            <GuiNumberField label="Ordem de exibição entre telas" unit="#" value={document.displayOrder} step={1} precision={0} onChange={(displayOrder) => updateGuiDocumentSettings(session, { displayOrder }, 'Alterar ordem de exibição', 'screen-order')} onEnd={end}/>
          </PropertyRow>
        </CollapsibleSection>
        <CollapsibleSection title="Fundo">
          <GuiColorField label="Cor de fundo" color={root.appearance.fill.color} alpha={root.appearance.fill.alpha} onChange={(patch) => designer.updateNodes('Alterar fundo da tela', [GUI_ROOT_ID], (node) => ({ ...node, appearance: { ...node.appearance, fill: { ...node.appearance.fill, ...patch } } }), 'screen-background')} onEnd={end}/>
          <p className="px-2 text-3xs leading-relaxed text-muted-foreground text-pretty">Transparente por padrão para o jogo aparecer por trás; use uma cor opaca em telas de menu ou carregamento.</p>
        </CollapsibleSection>
      </div>
    </div>);
}
