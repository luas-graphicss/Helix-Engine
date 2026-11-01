'use client';
import type { GuiNode, GuiRadii } from '@/engine/gui/document/gui-document';
import { setGuiAppearance, setGuiFill, setGuiGradient, setGuiRadii, setGuiShadow, setGuiStroke } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiColorField } from '../fields/gui-color-field';
import { GuiGradientField } from '../fields/gui-gradient-field';
import { CORNER_SLOTS, GuiQuadField } from '../fields/gui-insets-field';
import { GuiNumberField } from '../fields/gui-number-field';
import { useGuiEdit } from '../use-gui-edit';
const percent = (value: number) => `${Math.round(value)} %`;
export function GuiAppearanceSection({ node }: {
    node: GuiNode;
}) {
    const { session, end } = useGuiEdit();
    const { fill, stroke, radii, shadow, opacity } = node.appearance;
    return (<CollapsibleSection title="Aparência">
      <GuiColorField label="Preenchimento" color={fill.color} alpha={fill.alpha} onChange={(patch) => setGuiFill(session, patch, 'Alterar preenchimento', { merge: 'fill' })} onEnd={end}/>
      <GuiGradientField value={fill.gradient} baseColor={fill.color} onChange={(gradient) => setGuiGradient(session, gradient, 'Alterar gradiente', { merge: 'gradient' })} onEnd={end}/>

      <ToggleField label="Borda" on={stroke !== null} onToggle={() => setGuiStroke(session, stroke ? null : {}, stroke ? 'Remover borda' : 'Adicionar borda')}/>
      {stroke && (<>
          <PropertyRow label="Espessura">
            <GuiNumberField label="Espessura da borda" unit="px" value={stroke.width} min={0} max={64} step={0.5} precision={1} onChange={(width) => setGuiStroke(session, { width }, 'Alterar borda', { merge: 'stroke-width' })} onEnd={end}/>
          </PropertyRow>
          <GuiColorField label="Cor da borda" color={stroke.color} alpha={stroke.alpha} onChange={(patch) => setGuiStroke(session, patch, 'Alterar borda', { merge: 'stroke-color' })} onEnd={end}/>
        </>)}

      <GuiQuadField label="Cantos" values={radii} slots={CORNER_SLOTS} onChange={(next) => setGuiRadii(session, next as GuiRadii, 'Alterar cantos', { merge: 'radii' })} onEnd={end}/>

      <ToggleField label="Sombra" on={shadow !== null} onToggle={() => setGuiShadow(session, shadow ? null : {}, shadow ? 'Remover sombra' : 'Adicionar sombra')}/>
      {shadow && (<>
          <PropertyRow label="Desfoque">
            <GuiNumberField label="Desfoque da sombra" unit="px" value={shadow.blur} min={0} max={256} step={1} precision={0} onChange={(blur) => setGuiShadow(session, { blur }, 'Alterar sombra', { merge: 'shadow-blur' })} onEnd={end}/>
          </PropertyRow>
          <PropertyRow label="Deslocamento">
            <GuiNumberField label="Deslocamento horizontal da sombra" axis="x" value={shadow.offsetX} step={1} precision={0} onChange={(offsetX) => setGuiShadow(session, { offsetX }, 'Alterar sombra', { merge: 'shadow-x' })} onEnd={end}/>
            <GuiNumberField label="Deslocamento vertical da sombra" axis="y" value={shadow.offsetY} step={1} precision={0} onChange={(offsetY) => setGuiShadow(session, { offsetY }, 'Alterar sombra', { merge: 'shadow-y' })} onEnd={end}/>
          </PropertyRow>
          <GuiColorField label="Cor da sombra" color={shadow.color} alpha={shadow.alpha} onChange={(patch) => setGuiShadow(session, patch, 'Alterar sombra', { merge: 'shadow-color' })} onEnd={end}/>
        </>)}

      <div onPointerUp={end} onKeyUp={end}>
        <SliderField label="Opacidade" value={opacity * 100} min={0} max={100} step={1} format={percent} onChange={(value) => setGuiAppearance(session, { opacity: value / 100 }, 'Alterar opacidade', { merge: 'opacity' })}/>
      </div>
    </CollapsibleSection>);
}
