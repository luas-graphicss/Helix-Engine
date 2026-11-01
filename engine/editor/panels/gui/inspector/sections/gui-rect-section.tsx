'use client';
import type { GuiAutoSize, GuiNode, GuiPoint, UDim } from '@/engine/gui/document/gui-document';
import { currentAnchorPresetId, entryBox } from '@/engine/editor/gui/gui-geometry';
import { convertSelectedUnits, setSelectedAnchorPreset, setSelectedRotation } from '@/engine/editor/operations/gui-element-operations';
import { setGuiRect, setGuiUDimPart, type GuiAxisKey, type GuiRectDimension } from '@/engine/editor/operations/gui-property-operations';
import { ActionButton } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiAnchorField } from '../fields/gui-anchor-field';
import { GuiNumberField } from '../fields/gui-number-field';
import { GuiUDimField } from '../fields/gui-udim-field';
import { useGuiEdit } from '../use-gui-edit';
const AUTO_SIZE_OPTIONS: ReadonlyArray<{
    value: GuiAutoSize;
    label: string;
}> = [
    { value: 'none', label: 'Fixo' },
    { value: 'x', label: 'Largura' },
    { value: 'y', label: 'Altura' },
    { value: 'xy', label: 'Ambos' },
];
function useReferenceBox(node: GuiNode): GuiPoint | null {
    const { session } = useGuiEdit();
    const layout = session.gui.layout();
    const entry = layout?.entries.get(node.id);
    if (!layout || !entry)
        return null;
    const box = entryBox(entry);
    const scale = layout.offsetScale || 1;
    return { x: Math.round(box.width / scale), y: Math.round(box.height / scale) };
}
export function GuiRectSection({ node }: {
    node: GuiNode;
}) {
    const { session, end } = useGuiEdit();
    const rect = node.rect;
    const referenceBox = useReferenceBox(node);
    const udimField = (label: string, dimension: GuiRectDimension, axis: GuiAxisKey, value: UDim) => (<GuiUDimField label={label} axis={axis} value={value} onChange={(part, next) => setGuiUDimPart(session, dimension, axis, part, next, { merge: `rect-${dimension}-${axis}-${part}` })} onEnd={end}/>);
    const toggleAspect = () => {
        const ratio = referenceBox && referenceBox.y > 0 ? Number((referenceBox.x / referenceBox.y).toFixed(3)) : 1;
        setGuiRect(session, { aspectRatio: rect.aspectRatio === null ? ratio : null }, rect.aspectRatio === null ? 'Fixar proporção' : 'Liberar proporção');
    };
    const toggleMax = () => {
        const next = rect.maxSize === null ? (referenceBox ?? { x: 1920, y: 1080 }) : null;
        setGuiRect(session, { maxSize: next }, next ? 'Limitar tamanho máximo' : 'Remover tamanho máximo');
    };
    return (<CollapsibleSection title="Posição e tamanho">
      <div className="px-2 pb-1">
        <GuiAnchorField anchor={rect.anchor} presetId={currentAnchorPresetId(rect)} onChange={(preset) => setSelectedAnchorPreset(session, preset.id)}/>
      </div>
      {udimField('X', 'position', 'x', rect.position.x)}
      {udimField('Y', 'position', 'y', rect.position.y)}
      {udimField('Largura', 'size', 'x', rect.size.x)}
      {udimField('Altura', 'size', 'y', rect.size.y)}
      <PropertyRow label="Unidades">
        <ActionButton title="Converte posição e tamanho para frações do pai, mantendo o elemento onde está" onClick={() => convertSelectedUnits(session, 'proportional', 'both')}>
          Tudo em %
        </ActionButton>
        <ActionButton title="Converte posição e tamanho para pixels de referência, mantendo o elemento onde está" onClick={() => convertSelectedUnits(session, 'pixels', 'both')}>
          Tudo em px
        </ActionButton>
      </PropertyRow>
      <PropertyRow label="Rotação">
        <GuiNumberField label="Rotação" unit="°" value={rect.rotation} step={1} precision={1} min={-360} max={360} onChange={(rotation) => setSelectedRotation(session, rotation, 'rect-rotation')} onEnd={end}/>
        <GuiNumberField label="Ordem de empilhamento" unit="Z" value={rect.zIndex} step={1} precision={0} onChange={(zIndex) => setGuiRect(session, { zIndex }, 'Alterar ordem Z', { merge: 'rect-z' })} onEnd={end}/>
      </PropertyRow>
      <PropertyRow label="Ajustar ao conteúdo">
        <SegmentedControl label="Ajuste automático ao conteúdo" options={AUTO_SIZE_OPTIONS} value={rect.autoSize} onChange={(autoSize) => setGuiRect(session, { autoSize }, 'Alterar ajuste automático')}/>
      </PropertyRow>
      <ToggleField label="Proporção fixa" on={rect.aspectRatio !== null} onToggle={toggleAspect}/>
      {rect.aspectRatio !== null && (<PropertyRow label="Largura ÷ altura">
          <GuiNumberField label="Proporção" unit="÷" value={rect.aspectRatio} step={0.01} precision={3} min={0.01} max={100} onChange={(aspectRatio) => setGuiRect(session, { aspectRatio }, 'Alterar proporção', { merge: 'rect-aspect' })} onEnd={end}/>
        </PropertyRow>)}
      <PropertyRow label="Tamanho mínimo">
        <GuiNumberField label="Largura mínima" axis="x" value={rect.minSize.x} step={1} precision={0} min={0} onChange={(x) => setGuiRect(session, { minSize: { ...rect.minSize, x } }, 'Alterar tamanho mínimo', { merge: 'rect-min-x' })} onEnd={end}/>
        <GuiNumberField label="Altura mínima" axis="y" value={rect.minSize.y} step={1} precision={0} min={0} onChange={(y) => setGuiRect(session, { minSize: { ...rect.minSize, y } }, 'Alterar tamanho mínimo', { merge: 'rect-min-y' })} onEnd={end}/>
      </PropertyRow>
      <ToggleField label="Limitar máximo" on={rect.maxSize !== null} onToggle={toggleMax}/>
      {rect.maxSize && (<PropertyRow label="Tamanho máximo">
          <GuiNumberField label="Largura máxima" axis="x" value={rect.maxSize.x} step={1} precision={0} min={0} onChange={(x) => setGuiRect(session, { maxSize: { ...rect.maxSize!, x } }, 'Alterar tamanho máximo', { merge: 'rect-max-x' })} onEnd={end}/>
          <GuiNumberField label="Altura máxima" axis="y" value={rect.maxSize.y} step={1} precision={0} min={0} onChange={(y) => setGuiRect(session, { maxSize: { ...rect.maxSize!, y } }, 'Alterar tamanho máximo', { merge: 'rect-max-y' })} onEnd={end}/>
        </PropertyRow>)}
      <ToggleField label="Ignorar layout do pai" on={rect.ignoreLayout} onToggle={() => setGuiRect(session, { ignoreLayout: !rect.ignoreLayout }, rect.ignoreLayout ? 'Seguir layout do pai' : 'Ignorar layout do pai')}/>
      <ToggleField label="Respeitar área segura" hint="Posição e tamanho resolvidos dentro da área segura do aparelho emulado (fora de recortes, cantos e barras do sistema)" on={rect.safeArea} onToggle={() => setGuiRect(session, { safeArea: !rect.safeArea }, rect.safeArea ? 'Ignorar área segura' : 'Respeitar área segura')}/>
    </CollapsibleSection>);
}
