'use client';
import type { ReactNode } from 'react';
import type { GuiNode, GuiStateStyle } from '@/engine/gui/document/gui-document';
import { GUI_STATE_LABELS, setGuiState, setGuiStateTransition, type GuiStateKey } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { GuiColorField } from '../fields/gui-color-field';
import { GuiNumberField } from '../fields/gui-number-field';
import { useGuiEdit } from '../use-gui-edit';
const STATE_KEYS: readonly GuiStateKey[] = ['hover', 'pressed', 'disabled'];
type OverrideRowProps = {
    label: string;
    enabled: boolean;
    onToggle: () => void;
    children: ReactNode;
};
function OverrideRow({ label, enabled, onToggle, children }: OverrideRowProps) {
    return (<PropertyRow label={label}>
      <ToggleSwitch label={`Substituir ${label.toLowerCase()} neste estado`} on={enabled} onToggle={onToggle}/>
      {enabled ? children : <span className="truncate text-2xs text-muted-foreground italic">herdado</span>}
    </PropertyRow>);
}
function StateBlock({ node, stateKey }: {
    node: GuiNode;
    stateKey: GuiStateKey;
}) {
    const { session, end } = useGuiEdit();
    const style = node.states[stateKey];
    const base = node.appearance;
    const edit = (patch: Partial<GuiStateStyle>, merge?: string) => setGuiState(session, stateKey, patch, merge ? { merge } : undefined);
    return (<>
      <ToggleField label={GUI_STATE_LABELS[stateKey]} on={style !== null} onToggle={() => setGuiState(session, stateKey, style ? null : {})}/>
      {style && (<div className="ml-3 flex flex-col gap-0.5 border-l border-border">
          <OverrideRow label="Preenchimento" enabled={style.fillColor !== null} onToggle={() => edit({ fillColor: style.fillColor === null ? base.fill.color : null })}>
            <GuiColorField inline label="Preenchimento no estado" color={style.fillColor ?? base.fill.color} onChange={(patch) => patch.color && edit({ fillColor: patch.color }, `state-${stateKey}-fill`)} onEnd={end}/>
          </OverrideRow>
          <OverrideRow label="Opac. do preench." enabled={style.fillAlpha !== null} onToggle={() => edit({ fillAlpha: style.fillAlpha === null ? base.fill.alpha : null })}>
            <GuiNumberField label="Opacidade do preenchimento no estado" unit="%" value={(style.fillAlpha ?? base.fill.alpha) * 100} min={0} max={100} step={1} precision={0} onChange={(value) => edit({ fillAlpha: value / 100 }, `state-${stateKey}-fill-alpha`)} onEnd={end}/>
          </OverrideRow>
          <OverrideRow label="Borda" enabled={style.strokeColor !== null} onToggle={() => edit({ strokeColor: style.strokeColor === null ? (base.stroke?.color ?? base.fill.color) : null })}>
            <GuiColorField inline label="Cor da borda no estado" color={style.strokeColor ?? base.stroke?.color ?? base.fill.color} onChange={(patch) => patch.color && edit({ strokeColor: patch.color }, `state-${stateKey}-stroke`)} onEnd={end}/>
          </OverrideRow>
          {node.text && (<OverrideRow label="Texto" enabled={style.textColor !== null} onToggle={() => edit({ textColor: style.textColor === null ? node.text!.color : null })}>
              <GuiColorField inline label="Cor do texto no estado" color={style.textColor ?? node.text.color} onChange={(patch) => patch.color && edit({ textColor: patch.color }, `state-${stateKey}-text`)} onEnd={end}/>
            </OverrideRow>)}
          <PropertyRow label="Escala">
            <GuiNumberField label="Escala no estado" unit="×" value={style.scale} min={0.1} max={3} step={0.01} precision={2} onChange={(scale) => edit({ scale }, `state-${stateKey}-scale`)} onEnd={end}/>
          </PropertyRow>
          <OverrideRow label="Opacidade" enabled={style.opacity !== null} onToggle={() => edit({ opacity: style.opacity === null ? base.opacity : null })}>
            <GuiNumberField label="Opacidade no estado" unit="%" value={(style.opacity ?? base.opacity) * 100} min={0} max={100} step={1} precision={0} onChange={(value) => edit({ opacity: value / 100 }, `state-${stateKey}-opacity`)} onEnd={end}/>
          </OverrideRow>
        </div>)}
    </>);
}
export function GuiStatesSection({ node }: {
    node: GuiNode;
}) {
    const { session, end } = useGuiEdit();
    const hasStates = STATE_KEYS.some((key) => node.states[key] !== null);
    return (<CollapsibleSection title="Estados interativos" defaultOpen={hasStates}>
      <PropertyRow label="Transição">
        <GuiNumberField label="Duração da transição" unit="ms" value={node.states.transitionMs} min={0} max={5000} step={10} precision={0} onChange={(transitionMs) => setGuiStateTransition(session, transitionMs, { merge: 'state-transition' })} onEnd={end}/>
      </PropertyRow>
      {STATE_KEYS.map((key) => (<StateBlock key={key} node={node} stateKey={key}/>))}
    </CollapsibleSection>);
}
