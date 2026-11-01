'use client';
import { GUI_ELEMENT_LABELS, type GuiAxis, type GuiButtonControl, type GuiControl, type GuiDividerControl, type GuiInputControl, type GuiProgressControl, type GuiScrollControl, type GuiSliderControl, type GuiToggleControl, } from '@/engine/gui/document/gui-document';
import { setGuiControl, type GuiEditOptions } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiColorField, type GuiColorPatch } from '../fields/gui-color-field';
import { GuiGradientField } from '../fields/gui-gradient-field';
import { GuiIconPicker } from '../fields/gui-icon-picker';
import { GuiNumberField } from '../fields/gui-number-field';
import { GuiUDimField } from '../fields/gui-udim-field';
import { useGuiEdit } from '../use-gui-edit';
import { GuiVideoFields, GuiViewportFields } from './gui-media-control-sections';
const AXIS_OPTIONS: ReadonlyArray<{
    value: GuiAxis;
    label: string;
}> = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
];
const ICON_POSITION_OPTIONS: ReadonlyArray<{
    value: GuiButtonControl['iconPosition'];
    label: string;
}> = [
    { value: 'left', label: 'Esq.' },
    { value: 'right', label: 'Dir.' },
    { value: 'top', label: 'Topo' },
    { value: 'only', label: 'Só ícone' },
];
const percent = (value: number) => `${Math.round(value)} %`;
const mergeOf = (merge?: string): GuiEditOptions | undefined => (merge ? { merge } : undefined);
function colorPatch<K extends string, A extends string>(patch: GuiColorPatch, colorKey: K, alphaKey: A): Partial<Record<K, string> & Record<A, number>> {
    const result: Partial<Record<K, string> & Record<A, number>> = {};
    if (patch.color !== undefined)
        (result as Record<K, string>)[colorKey] = patch.color;
    if (patch.alpha !== undefined)
        (result as Record<A, number>)[alphaKey] = patch.alpha;
    return result;
}
type TextRowProps = {
    label: string;
    value: string;
    placeholder?: string;
    onCommit: (value: string) => void;
};
function TextRow({ label, value, placeholder, onCommit }: TextRowProps) {
    return (<PropertyRow label={label}>
      <FieldInput key={`${label}-${value}`} defaultValue={value} placeholder={placeholder} aria-label={label} onBlur={(event) => {
            if (event.currentTarget.value !== value)
                onCommit(event.currentTarget.value);
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
    </PropertyRow>);
}
function ButtonFields({ control }: {
    control: GuiButtonControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiButtonControl>, label: string, merge?: string) => setGuiControl(session, 'button', patch, label, mergeOf(merge));
    return (<>
      <ToggleField label="Desabilitado" on={control.disabled} onToggle={() => edit({ disabled: !control.disabled }, 'Alternar botão desabilitado')}/>
      <GuiIconPicker allowNone value={control.iconName} onChange={(iconName) => edit({ iconName }, iconName ? `Ícone ${iconName}` : 'Remover ícone do botão')}/>
      {control.iconName && (<>
          <PropertyRow label="Posição do ícone">
            <SegmentedControl label="Posição do ícone" options={ICON_POSITION_OPTIONS} value={control.iconPosition} onChange={(iconPosition) => edit({ iconPosition }, 'Alterar posição do ícone')}/>
          </PropertyRow>
          <PropertyRow label="Tamanho do ícone">
            <GuiNumberField label="Tamanho do ícone" unit="px" value={control.iconSize} min={4} max={256} step={1} precision={0} onChange={(iconSize) => edit({ iconSize }, 'Alterar tamanho do ícone', 'button-icon-size')} onEnd={end}/>
          </PropertyRow>
          <PropertyRow label="Espaço até o texto">
            <GuiNumberField label="Espaço entre ícone e texto" unit="px" value={control.iconGap} min={0} max={128} step={1} precision={0} onChange={(iconGap) => edit({ iconGap }, 'Alterar espaço do ícone', 'button-icon-gap')} onEnd={end}/>
          </PropertyRow>
        </>)}
    </>);
}
function ToggleFields({ control }: {
    control: GuiToggleControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiToggleControl>, label: string, merge?: string) => setGuiControl(session, 'toggle', patch, label, mergeOf(merge));
    return (<>
      <ToggleField label="Ligado" on={control.value} onToggle={() => edit({ value: !control.value }, 'Alternar valor')}/>
      <PropertyRow label="Estilo">
        <SegmentedControl label="Estilo do alternador" options={[
            { value: 'switch', label: 'Interruptor' },
            { value: 'checkbox', label: 'Caixa de seleção' },
        ]} value={control.style} onChange={(style) => edit({ style }, 'Alterar estilo do alternador')}/>
      </PropertyRow>
      <GuiColorField label="Cor ligado" color={control.onColor} onChange={(patch) => patch.color && edit({ onColor: patch.color }, 'Alterar cor ligado', 'toggle-on')} onEnd={end}/>
      <GuiColorField label="Cor do botão" color={control.knobColor} onChange={(patch) => patch.color && edit({ knobColor: patch.color }, 'Alterar cor do botão', 'toggle-knob')} onEnd={end}/>
    </>);
}
function SliderFields({ control }: {
    control: GuiSliderControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiSliderControl>, label: string, merge?: string) => setGuiControl(session, 'slider', patch, label, mergeOf(merge));
    return (<>
      <PropertyRow label="Faixa">
        <GuiNumberField label="Valor mínimo" unit="mín" value={control.min} step={1} precision={2} onChange={(min) => edit({ min }, 'Alterar faixa', 'slider-min')} onEnd={end}/>
        <GuiNumberField label="Valor máximo" unit="máx" value={control.max} step={1} precision={2} onChange={(max) => edit({ max }, 'Alterar faixa', 'slider-max')} onEnd={end}/>
      </PropertyRow>
      <PropertyRow label="Valor inicial">
        <GuiNumberField label="Valor inicial" value={control.value} min={Math.min(control.min, control.max)} max={Math.max(control.min, control.max)} step={control.step || 1} precision={2} onChange={(value) => edit({ value }, 'Alterar valor', 'slider-value')} onEnd={end}/>
      </PropertyRow>
      <PropertyRow label="Passo">
        <GuiNumberField label="Passo" value={control.step} min={0} step={0.1} precision={3} onChange={(step) => edit({ step }, 'Alterar passo', 'slider-step')} onEnd={end}/>
      </PropertyRow>
      <PropertyRow label="Direção">
        <SegmentedControl label="Direção do controle" options={AXIS_OPTIONS} value={control.direction} onChange={(direction) => edit({ direction }, 'Alterar direção')}/>
      </PropertyRow>
      <GuiColorField label="Trilho" color={control.trackColor} alpha={control.trackAlpha} onChange={(patch) => edit(colorPatch(patch, 'trackColor', 'trackAlpha'), 'Alterar trilho', 'slider-track')} onEnd={end}/>
      <GuiColorField label="Parte preenchida" color={control.fillColor} onChange={(patch) => patch.color && edit({ fillColor: patch.color }, 'Alterar preenchimento', 'slider-fill')} onEnd={end}/>
      <GuiColorField label="Botão" color={control.knobColor} onChange={(patch) => patch.color && edit({ knobColor: patch.color }, 'Alterar botão', 'slider-knob')} onEnd={end}/>
      <PropertyRow label="Tamanho do botão">
        <GuiNumberField label="Tamanho do botão" unit="px" value={control.knobSize} min={4} max={128} step={1} precision={0} onChange={(knobSize) => edit({ knobSize }, 'Alterar botão', 'slider-knob-size')} onEnd={end}/>
      </PropertyRow>
      <PropertyRow label="Espessura do trilho">
        <GuiNumberField label="Espessura do trilho" unit="px" value={control.trackThickness} min={1} max={128} step={1} precision={0} onChange={(trackThickness) => edit({ trackThickness }, 'Alterar trilho', 'slider-track-size')} onEnd={end}/>
      </PropertyRow>
    </>);
}
function ProgressFields({ control }: {
    control: GuiProgressControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiProgressControl>, label: string, merge?: string) => setGuiControl(session, 'progress', patch, label, mergeOf(merge));
    return (<>
      <div onPointerUp={end} onKeyUp={end}>
        <SliderField label="Progresso" value={control.value * 100} min={0} max={100} step={1} format={percent} onChange={(value) => edit({ value: value / 100 }, 'Alterar progresso', 'progress-value')}/>
      </div>
      <PropertyRow label="Direção">
        <SegmentedControl label="Direção da barra" options={AXIS_OPTIONS} value={control.direction} onChange={(direction) => edit({ direction }, 'Alterar direção')}/>
      </PropertyRow>
      <ToggleField label="Inverter sentido" on={control.reverse} onToggle={() => edit({ reverse: !control.reverse }, 'Inverter sentido da barra')}/>
      <GuiColorField label="Preenchimento" color={control.fillColor} alpha={control.fillAlpha} onChange={(patch) => edit(colorPatch(patch, 'fillColor', 'fillAlpha'), 'Alterar preenchimento da barra', 'progress-fill')} onEnd={end}/>
      <GuiGradientField label="Gradiente da barra" value={control.fillGradient} baseColor={control.fillColor} onChange={(fillGradient) => edit({ fillGradient }, 'Alterar gradiente da barra', 'progress-gradient')} onEnd={end}/>
      <ToggleField label="Mostrar porcentagem" on={control.showLabel} onToggle={() => edit({ showLabel: !control.showLabel }, 'Alternar rótulo da barra')}/>
      <PropertyRow label="Segmentos">
        <GuiNumberField label="Segmentos (0 = contínua)" unit="#" value={control.segments} min={0} max={100} step={1} precision={0} onChange={(segments) => edit({ segments }, 'Alterar segmentos', 'progress-segments')} onEnd={end}/>
      </PropertyRow>
    </>);
}
function InputFields({ control }: {
    control: GuiInputControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiInputControl>, label: string, merge?: string) => setGuiControl(session, 'input', patch, label, mergeOf(merge));
    return (<>
      <TextRow label="Valor inicial" value={control.value} onCommit={(value) => edit({ value }, 'Alterar valor inicial')}/>
      <TextRow label="Dica" value={control.placeholder} placeholder="Texto exibido quando vazio" onCommit={(placeholder) => edit({ placeholder }, 'Alterar dica')}/>
      <GuiColorField label="Cor da dica" color={control.placeholderColor} onChange={(patch) => patch.color && edit({ placeholderColor: patch.color }, 'Alterar cor da dica', 'input-placeholder')} onEnd={end}/>
      <GuiColorField label="Cursor" color={control.caretColor} onChange={(patch) => patch.color && edit({ caretColor: patch.color }, 'Alterar cor do cursor', 'input-caret')} onEnd={end}/>
      <ToggleField label="Limitar tamanho" on={control.maxLength !== null} onToggle={() => edit({ maxLength: control.maxLength === null ? 32 : null }, 'Alterar limite de caracteres')}/>
      {control.maxLength !== null && (<PropertyRow label="Máx. caracteres">
          <GuiNumberField label="Máximo de caracteres" unit="#" value={control.maxLength} min={1} max={10000} step={1} precision={0} onChange={(maxLength) => edit({ maxLength }, 'Alterar limite de caracteres', 'input-max')} onEnd={end}/>
        </PropertyRow>)}
      <ToggleField label="Senha (ocultar)" on={control.password} onToggle={() => edit({ password: !control.password }, 'Alternar modo senha')}/>
      <ToggleField label="Várias linhas" on={control.multiline} onToggle={() => edit({ multiline: !control.multiline }, 'Alternar várias linhas')}/>
    </>);
}
function ScrollFields({ control }: {
    control: GuiScrollControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiScrollControl>, label: string, merge?: string) => setGuiControl(session, 'scroll', patch, label, mergeOf(merge));
    const canvasField = (label: string, axis: 'x' | 'y') => (<GuiUDimField label={label} axis={axis} value={control.canvasSize[axis]} onChange={(part, next) => edit({ canvasSize: { ...control.canvasSize, [axis]: { ...control.canvasSize[axis], [part]: next } } }, 'Alterar área de rolagem', `scroll-canvas-${axis}-${part}`)} onEnd={end}/>);
    return (<>
      {canvasField('Área (larg.)', 'x')}
      {canvasField('Área (alt.)', 'y')}
      <PropertyRow label="Direção">
        <SelectField label="Direção da rolagem" options={[
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'both', label: 'Ambas' },
        ]} value={control.direction} onChange={(direction) => edit({ direction }, 'Alterar direção da rolagem')}/>
      </PropertyRow>
      <PropertyRow label="Barra">
        <GuiNumberField label="Espessura da barra de rolagem" unit="px" value={control.scrollbarThickness} min={0} max={64} step={1} precision={0} onChange={(scrollbarThickness) => edit({ scrollbarThickness }, 'Alterar barra de rolagem', 'scroll-thickness')} onEnd={end}/>
      </PropertyRow>
      <GuiColorField label="Cor da barra" color={control.scrollbarColor} alpha={control.scrollbarAlpha} onChange={(patch) => edit(colorPatch(patch, 'scrollbarColor', 'scrollbarAlpha'), 'Alterar barra de rolagem', 'scroll-color')} onEnd={end}/>
    </>);
}
function DividerFields({ control }: {
    control: GuiDividerControl;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiDividerControl>, label: string, merge?: string) => setGuiControl(session, 'divider', patch, label, mergeOf(merge));
    return (<>
      <PropertyRow label="Orientação">
        <SegmentedControl label="Orientação do divisor" options={AXIS_OPTIONS} value={control.orientation} onChange={(orientation) => edit({ orientation }, 'Alterar orientação')}/>
      </PropertyRow>
      <PropertyRow label="Espessura">
        <GuiNumberField label="Espessura do divisor" unit="px" value={control.thickness} min={1} max={64} step={1} precision={0} onChange={(thickness) => edit({ thickness }, 'Alterar espessura', 'divider-thickness')} onEnd={end}/>
      </PropertyRow>
      <GuiColorField label="Cor" color={control.color} alpha={control.alpha} onChange={(patch) => edit(colorPatch(patch, 'color', 'alpha'), 'Alterar cor do divisor', 'divider-color')} onEnd={end}/>
      <ToggleField label="Tracejado" on={control.dashed} onToggle={() => edit({ dashed: !control.dashed }, 'Alternar tracejado')}/>
    </>);
}
function ControlFields({ control, interactable }: {
    control: GuiControl;
    interactable: boolean;
}) {
    switch (control.kind) {
        case 'button':
            return <ButtonFields control={control}/>;
        case 'toggle':
            return <ToggleFields control={control}/>;
        case 'slider':
            return <SliderFields control={control}/>;
        case 'progress':
            return <ProgressFields control={control}/>;
        case 'input':
            return <InputFields control={control}/>;
        case 'scroll':
            return <ScrollFields control={control}/>;
        case 'divider':
            return <DividerFields control={control}/>;
        case 'video':
            return <GuiVideoFields control={control} interactable={interactable}/>;
        case 'viewport':
            return <GuiViewportFields control={control} interactable={interactable}/>;
    }
}
export function GuiControlSection({ control, interactable = true }: {
    control: GuiControl;
    interactable?: boolean;
}) {
    return (<CollapsibleSection title={GUI_ELEMENT_LABELS[control.kind]}>
      <ControlFields control={control} interactable={interactable}/>
    </CollapsibleSection>);
}
