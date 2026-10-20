'use client';
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLabel } from '@/engine/assets/import/import-registry';
import type { ImportNormalsMode, ImportUpAxisOption } from '@/engine/assets/import/import-materializer';
import type { ImportPlacement } from '@/engine/editor/operations/import-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import type { ImportDraft } from '../use-import-draft';
import { describeUnits, formatBytes, formatInteger, formatScale } from './import-format';
const UP_AXIS_OPTIONS: ReadonlyArray<{
    value: ImportUpAxisOption;
    label: string;
}> = [
    { value: 'auto', label: 'Auto' },
    { value: 'y', label: 'Y' },
    { value: 'z', label: 'Z' },
];
const PLACEMENT_OPTIONS: ReadonlyArray<{
    value: ImportPlacement;
    label: string;
}> = [
    { value: 'target', label: 'Alvo' },
    { value: 'origin', label: 'Origem' },
    { value: 'keep', label: 'Arquivo' },
];
const NORMALS_OPTIONS: ReadonlyArray<{
    value: ImportNormalsMode;
    label: string;
}> = [
    { value: 'keep', label: 'Do arquivo' },
    { value: 'smooth', label: 'Suaves' },
    { value: 'flat', label: 'Planas' },
];
const SCALE_PRESETS = [0.001, 0.01, 0.1, 1, 10, 100];
function InfoRow({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return (<PropertyRow label={label}>
      <span className="min-w-0 truncate font-mono text-2xs text-foreground">{children}</span>
    </PropertyRow>);
}
function Hint({ children, className }: {
    children: ReactNode;
    className?: string;
}) {
    return <p className={cn('px-2 text-[10px] leading-4 text-muted-foreground', className)}>{children}</p>;
}
function NumberInput({ value, min, label, onCommit }: {
    value: number;
    min: number;
    label: string;
    onCommit: (value: number) => void;
}) {
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);
    const commit = () => {
        const parsed = Number.parseFloat(text.replace(',', '.'));
        if (Number.isFinite(parsed) && parsed >= min && parsed !== value)
            onCommit(parsed);
        else
            setText(String(value));
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter')
            event.currentTarget.blur();
        else if (event.key === 'Escape') {
            setText(String(value));
            event.currentTarget.blur();
        }
    };
    return <FieldInput aria-label={label} inputMode="decimal" value={text} onChange={(event) => setText(event.currentTarget.value)} onBlur={commit} onKeyDown={onKeyDown}/>;
}
type ImportOptionsTabProps = {
    draft: ImportDraft;
    fileSize: number;
};
export function ImportOptionsTab({ draft, fileSize }: ImportOptionsTabProps) {
    const { scene, options, stats, warnings, updateOptions } = draft;
    const computedNormals = scene.meshes.filter((mesh) => !mesh.hadNormals).length;
    const withoutUvs = scene.meshes.filter((mesh) => !mesh.hadUvs).length;
    return (<div className="flex flex-col">
      {warnings.length > 0 && (<section aria-label="Avisos da leitura" className="flex flex-col gap-1 border-b border-border bg-warning/10 px-2 py-2">
          <h3 className="flex items-center gap-1.5 text-2xs font-semibold text-warning">
            <TriangleAlert className="size-3.5" aria-hidden/>
            {warnings.length === 1 ? '1 aviso' : `${warnings.length} avisos`}
          </h3>
          <ul className="flex max-h-28 flex-col gap-0.5 overflow-y-auto pl-5 text-[10px] leading-4 text-foreground/80">
            {warnings.map((warning, index) => (<li key={`${index}-${warning}`} className="list-disc break-words">
                {warning}
              </li>))}
          </ul>
        </section>)}

      <CollapsibleSection title="Arquivo">
        <InfoRow label="Formato">{formatLabel(scene.format)}</InfoRow>
        <InfoRow label="Tamanho">{formatBytes(fileSize)}</InfoRow>
        <InfoRow label="Eixo vertical">{scene.upAxis === 'z' ? 'Z (será convertido para Y)' : 'Y'}</InfoRow>
        <InfoRow label="Unidade">{scene.metersPerUnit ? describeUnits(scene.metersPerUnit) : 'Não declarada'}</InfoRow>
        <InfoRow label="Hierarquia">
          {formatInteger(stats.nodes)} {stats.nodes === 1 ? 'nó' : 'nós'} · {formatInteger(stats.meshes)} {stats.meshes === 1 ? 'malha' : 'malhas'}
        </InfoRow>
        <InfoRow label="Geometria">
          {formatInteger(stats.vertices)} vértices · {formatInteger(stats.triangles)} triângulos
        </InfoRow>
        <InfoRow label="Aparência">
          {formatInteger(stats.materials)} {stats.materials === 1 ? 'material' : 'materiais'} · {formatInteger(stats.textures)} {stats.textures === 1 ? 'textura' : 'texturas'}
        </InfoRow>
      </CollapsibleSection>

      <CollapsibleSection title="Transformação">
        <PropertyRow label="Nome da raiz">
          <FieldInput aria-label="Nome da raiz" value={options.rootName ?? ''} placeholder={scene.name} onChange={(event) => updateOptions({ rootName: event.currentTarget.value || null })}/>
        </PropertyRow>
        <PropertyRow label="Escala">
          <NumberInput label="Fator de escala" value={options.scale} min={1e-6} onCommit={(scale) => updateOptions({ scale })}/>
        </PropertyRow>
        <div className="flex items-center gap-1 px-2 pl-[calc(88px+0.5rem)]">
          {SCALE_PRESETS.map((preset) => (<button key={preset} type="button" onClick={() => updateOptions({ scale: preset })} aria-pressed={options.scale === preset} className={cn('rounded-sm px-1 py-px font-mono text-[10px] leading-4 transition-colors', options.scale === preset ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
              {formatScale(preset)}
            </button>))}
        </div>
        <ToggleField label="Converter unidades" on={options.convertUnits && scene.metersPerUnit !== null} onToggle={scene.metersPerUnit ? () => updateOptions({ convertUnits: !options.convertUnits }) : undefined}/>
        <Hint>
          {scene.metersPerUnit
            ? `Arquivo em ${describeUnits(scene.metersPerUnit)}. Escala final aplicada à raiz: ${formatScale(draft.effectiveScale)}.`
            : 'O formato não declara unidades; use a escala para ajustar o tamanho.'}
        </Hint>
        <PropertyRow label="Eixo vertical">
          <SegmentedControl label="Eixo vertical do arquivo" options={UP_AXIS_OPTIONS} value={options.upAxis} onChange={(upAxis) => updateOptions({ upAxis })}/>
        </PropertyRow>
        <Hint>{draft.upAxis === 'z' ? 'Tratado como Z-up: a raiz recebe rotação de −90° em X.' : 'Tratado como Y-up, igual à engine.'}</Hint>
        <PropertyRow label="Posicionar">
          <SegmentedControl label="Posição inicial" options={PLACEMENT_OPTIONS} value={options.placement} onChange={(placement) => updateOptions({ placement })}/>
        </PropertyRow>
        <Hint>
          {options.placement === 'target' && 'Centralizado no alvo da câmera, apoiado na altura dele.'}
          {options.placement === 'origin' && 'Centralizado na origem do mundo, apoiado em Y = 0.'}
          {options.placement === 'keep' && 'Mantém as coordenadas exatamente como estão no arquivo.'}
        </Hint>
        <ToggleField label="Enquadrar ao importar" on={options.frameAfterImport} onToggle={() => updateOptions({ frameAfterImport: !options.frameAfterImport })}/>
      </CollapsibleSection>

      <CollapsibleSection title="Geometria">
        <PropertyRow label="Normais">
          <SegmentedControl label="Normais" options={NORMALS_OPTIONS} value={options.normals} onChange={(normals) => updateOptions({ normals })}/>
        </PropertyRow>
        <SliderField label="Ângulo de suavização" value={options.smoothingAngle} min={0} max={180} step={1} disabled={options.normals !== 'smooth'} format={(value) => `${Math.round(value)}°`} onChange={(smoothingAngle) => updateOptions({ smoothingAngle })}/>
        <ToggleField label="Inverter V das UVs" on={options.flipUvV} onToggle={() => updateOptions({ flipUvV: !options.flipUvV })}/>
        <ToggleField label="Inverter faces" on={options.flipWinding} onToggle={() => updateOptions({ flipWinding: !options.flipWinding })}/>
        {(computedNormals > 0 || withoutUvs > 0) && (<Hint>
            {computedNormals > 0 && `${computedNormals} ${computedNormals === 1 ? 'malha veio' : 'malhas vieram'} sem normais (calculadas na leitura). `}
            {withoutUvs > 0 && `${withoutUvs} ${withoutUvs === 1 ? 'malha não tem' : 'malhas não têm'} UVs: texturas não se aplicam a ${withoutUvs === 1 ? 'ela' : 'elas'}.`}
          </Hint>)}
      </CollapsibleSection>
    </div>);
}
