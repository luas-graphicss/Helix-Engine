'use client';
import { CaseUpper, Italic } from 'lucide-react';
import type { GuiTextAlign, GuiTextStyle, GuiTextVerticalAlign } from '@/engine/gui/document/gui-document';
import { GUI_FONT_WEIGHTS } from '@/engine/gui/fonts/gui-font-registry';
import { setGuiText, setGuiTextOutline, setGuiTextShadow } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiColorField } from '../fields/gui-color-field';
import { GuiFontPicker } from '../fields/gui-font-picker';
import { GuiNumberField } from '../fields/gui-number-field';
import { useGuiEdit } from '../use-gui-edit';
const ALIGN_OPTIONS: ReadonlyArray<{
    value: GuiTextAlign;
    label: string;
}> = [
    { value: 'left', label: 'Esq.' },
    { value: 'center', label: 'Centro' },
    { value: 'right', label: 'Dir.' },
];
const VERTICAL_OPTIONS: ReadonlyArray<{
    value: GuiTextVerticalAlign;
    label: string;
}> = [
    { value: 'top', label: 'Topo' },
    { value: 'middle', label: 'Meio' },
    { value: 'bottom', label: 'Base' },
];
export function GuiTextSection({ text }: {
    text: GuiTextStyle;
}) {
    const { session, end } = useGuiEdit();
    const edit = (patch: Partial<GuiTextStyle>, label: string, merge?: string) => setGuiText(session, patch, label, merge ? { merge } : undefined);
    return (<CollapsibleSection title="Texto">
      <div className="px-2">
        <textarea value={text.content} rows={2} spellCheck={false} aria-label="Conteúdo do texto" onChange={(event) => edit({ content: event.currentTarget.value }, 'Editar texto', 'text-content')} onBlur={end} className="w-full resize-y rounded-sm border border-border bg-input px-1.5 py-1 text-2xs leading-relaxed text-foreground shadow-well outline-none transition-colors duration-100 hover:border-border-strong focus:border-primary/80 focus:hover:border-primary/80"/>
      </div>
      <GuiFontPicker value={text.family} onChange={(family) => edit({ family }, 'Alterar fonte')}/>
      <PropertyRow label="Tamanho e peso">
        <GuiNumberField label="Tamanho da fonte" unit="px" value={text.size} min={4} max={512} step={1} precision={1} onChange={(size) => edit({ size }, 'Alterar tamanho do texto', 'text-size')} onEnd={end}/>
        <SelectField label="Peso da fonte" options={GUI_FONT_WEIGHTS} value={text.weight} onChange={(weight) => edit({ weight }, 'Alterar peso do texto')}/>
      </PropertyRow>
      <PropertyRow label="Estilo">
        <IconButton label="Itálico" size="sm" active={text.italic} onClick={() => edit({ italic: !text.italic }, 'Alternar itálico')}>
          <Italic />
        </IconButton>
        <IconButton label="Maiúsculas" size="sm" active={text.uppercase} onClick={() => edit({ uppercase: !text.uppercase }, 'Alternar maiúsculas')}>
          <CaseUpper />
        </IconButton>
      </PropertyRow>
      <GuiColorField label="Cor" color={text.color} alpha={text.alpha} onChange={(patch) => edit(patch, 'Alterar cor do texto', 'text-color')} onEnd={end}/>
      <PropertyRow label="Alinhamento">
        <SegmentedControl label="Alinhamento horizontal" options={ALIGN_OPTIONS} value={text.align} onChange={(align) => edit({ align }, 'Alterar alinhamento do texto')}/>
      </PropertyRow>
      <PropertyRow label="Vertical">
        <SegmentedControl label="Alinhamento vertical" options={VERTICAL_OPTIONS} value={text.verticalAlign} onChange={(verticalAlign) => edit({ verticalAlign }, 'Alterar alinhamento vertical')}/>
      </PropertyRow>
      <PropertyRow label="Entrelinha">
        <GuiNumberField label="Altura de linha" unit="×" value={text.lineHeight} min={0.5} max={4} step={0.05} precision={2} onChange={(lineHeight) => edit({ lineHeight }, 'Alterar entrelinha', 'text-line-height')} onEnd={end}/>
        <GuiNumberField label="Espaçamento entre letras" unit="px" value={text.letterSpacing} min={-20} max={100} step={0.1} precision={1} onChange={(letterSpacing) => edit({ letterSpacing }, 'Alterar espaçamento entre letras', 'text-letter-spacing')} onEnd={end}/>
      </PropertyRow>
      <ToggleField label="Quebrar linhas" on={text.wrap} onToggle={() => edit({ wrap: !text.wrap }, 'Alternar quebra de linhas')}/>
      <ToggleField label="Caber na caixa" on={text.fitToBox} onToggle={() => edit({ fitToBox: !text.fitToBox }, 'Alternar ajuste à caixa')}/>

      <ToggleField label="Sombra do texto" on={text.shadow !== null} onToggle={() => setGuiTextShadow(session, text.shadow ? null : {})}/>
      {text.shadow && (<>
          <PropertyRow label="Desfoque">
            <GuiNumberField label="Desfoque da sombra do texto" unit="px" value={text.shadow.blur} min={0} max={64} step={1} precision={0} onChange={(blur) => setGuiTextShadow(session, { blur }, { merge: 'text-shadow-blur' })} onEnd={end}/>
          </PropertyRow>
          <PropertyRow label="Deslocamento">
            <GuiNumberField label="Deslocamento horizontal da sombra do texto" axis="x" value={text.shadow.offsetX} step={1} precision={0} onChange={(offsetX) => setGuiTextShadow(session, { offsetX }, { merge: 'text-shadow-x' })} onEnd={end}/>
            <GuiNumberField label="Deslocamento vertical da sombra do texto" axis="y" value={text.shadow.offsetY} step={1} precision={0} onChange={(offsetY) => setGuiTextShadow(session, { offsetY }, { merge: 'text-shadow-y' })} onEnd={end}/>
          </PropertyRow>
          <GuiColorField label="Cor da sombra" color={text.shadow.color} alpha={text.shadow.alpha} onChange={(patch) => setGuiTextShadow(session, patch, { merge: 'text-shadow-color' })} onEnd={end}/>
        </>)}

      <ToggleField label="Contorno" on={text.outline !== null} onToggle={() => setGuiTextOutline(session, text.outline ? null : {})}/>
      {text.outline && (<>
          <PropertyRow label="Espessura">
            <GuiNumberField label="Espessura do contorno" unit="px" value={text.outline.width} min={0} max={32} step={0.5} precision={1} onChange={(width) => setGuiTextOutline(session, { width }, { merge: 'text-outline-width' })} onEnd={end}/>
          </PropertyRow>
          <GuiColorField label="Cor do contorno" color={text.outline.color} alpha={text.outline.alpha} onChange={(patch) => setGuiTextOutline(session, patch, { merge: 'text-outline-color' })} onEnd={end}/>
        </>)}
    </CollapsibleSection>);
}
