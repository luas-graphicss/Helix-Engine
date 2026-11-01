'use client';
import type { GuiAutoLayoutKind, GuiAxis, GuiCrossAlign, GuiMainAlign, GuiNode, UDim } from '@/engine/gui/document/gui-document';
import { setGuiLayout } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiInsetsField } from '../fields/gui-insets-field';
import { GuiNumberField } from '../fields/gui-number-field';
import { GuiUDimField } from '../fields/gui-udim-field';
import { useGuiEdit } from '../use-gui-edit';
const KIND_OPTIONS: ReadonlyArray<{
    value: GuiAutoLayoutKind;
    label: string;
}> = [
    { value: 'none', label: 'Livre' },
    { value: 'list', label: 'Lista' },
    { value: 'grid', label: 'Grade' },
];
const DIRECTION_OPTIONS: ReadonlyArray<{
    value: GuiAxis;
    label: string;
}> = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
];
const MAIN_ALIGN_OPTIONS: ReadonlyArray<{
    value: GuiMainAlign;
    label: string;
}> = [
    { value: 'start', label: 'Início' },
    { value: 'center', label: 'Centro' },
    { value: 'end', label: 'Fim' },
    { value: 'space-between', label: 'Espaçar entre' },
    { value: 'space-around', label: 'Espaçar ao redor' },
];
const CROSS_ALIGN_OPTIONS: ReadonlyArray<{
    value: GuiCrossAlign;
    label: string;
}> = [
    { value: 'start', label: 'Início' },
    { value: 'center', label: 'Centro' },
    { value: 'end', label: 'Fim' },
    { value: 'stretch', label: 'Esticar' },
];
export function GuiLayoutSection({ node }: {
    node: GuiNode;
}) {
    const { session, end } = useGuiEdit();
    const layout = node.layout;
    const active = layout.kind !== 'none';
    const cellField = (label: string, axis: 'x' | 'y', value: UDim) => (<GuiUDimField label={label} axis={axis} value={value} onChange={(part, next) => setGuiLayout(session, { cellSize: { ...layout.cellSize, [axis]: { ...layout.cellSize[axis], [part]: next } } }, 'Alterar célula da grade', { merge: `layout-cell-${axis}-${part}` })} onEnd={end}/>);
    return (<CollapsibleSection title="Layout automático" defaultOpen={active}>
      <PropertyRow label="Tipo">
        <SegmentedControl label="Tipo de layout" options={KIND_OPTIONS} value={layout.kind} onChange={(kind) => setGuiLayout(session, { kind }, 'Alterar tipo de layout')}/>
      </PropertyRow>
      {active && (<>
          <PropertyRow label="Direção">
            <SegmentedControl label="Direção do layout" options={DIRECTION_OPTIONS} value={layout.direction} onChange={(direction) => setGuiLayout(session, { direction }, 'Alterar direção do layout')}/>
          </PropertyRow>
          <PropertyRow label="Espaçamento">
            <GuiNumberField label="Espaçamento entre filhos" unit="px" value={layout.gap} min={0} step={1} precision={1} onChange={(gap) => setGuiLayout(session, { gap }, 'Alterar espaçamento', { merge: 'layout-gap' })} onEnd={end}/>
          </PropertyRow>
          <GuiInsetsField label="Preench. interno" value={layout.padding} onChange={(padding) => setGuiLayout(session, { padding }, 'Alterar preenchimento interno', { merge: 'layout-padding' })} onEnd={end}/>
          <PropertyRow label="Eixo principal">
            <SelectField label="Alinhamento no eixo principal" options={MAIN_ALIGN_OPTIONS} value={layout.mainAlign} onChange={(mainAlign) => setGuiLayout(session, { mainAlign }, 'Alterar alinhamento principal')}/>
          </PropertyRow>
          <PropertyRow label="Eixo cruzado">
            <SelectField label="Alinhamento no eixo cruzado" options={CROSS_ALIGN_OPTIONS} value={layout.crossAlign} onChange={(crossAlign) => setGuiLayout(session, { crossAlign }, 'Alterar alinhamento cruzado')}/>
          </PropertyRow>
          {layout.kind === 'list' && <ToggleField label="Quebrar linha" on={layout.wrap} onToggle={() => setGuiLayout(session, { wrap: !layout.wrap }, 'Alterar quebra de linha')}/>}
          {layout.kind === 'grid' && (<>
              {cellField('Célula (larg.)', 'x', layout.cellSize.x)}
              {cellField('Célula (alt.)', 'y', layout.cellSize.y)}
              <ToggleField label="Colunas fixas" on={layout.columns !== null} onToggle={() => setGuiLayout(session, { columns: layout.columns === null ? 3 : null }, 'Alterar colunas da grade')}/>
              {layout.columns !== null && (<PropertyRow label="Colunas">
                  <GuiNumberField label="Número de colunas" unit="#" value={layout.columns} min={1} max={64} step={1} precision={0} onChange={(columns) => setGuiLayout(session, { columns }, 'Alterar colunas da grade', { merge: 'layout-columns' })} onEnd={end}/>
                </PropertyRow>)}
            </>)}
        </>)}
    </CollapsibleSection>);
}
