'use client';
import { isFullViewport, type CameraViewport } from '@/engine/camera/camera-settings';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ScalarField } from '../number-fields';
type ViewportPresetId = 'full' | 'left' | 'right' | 'top' | 'bottom' | 'corner';
const PERCENT = 100;
const VIEWPORT_PRESETS: Record<ViewportPresetId, CameraViewport> = {
    full: { x: 0, y: 0, width: 1, height: 1 },
    left: { x: 0, y: 0, width: 0.5, height: 1 },
    right: { x: 0.5, y: 0, width: 0.5, height: 1 },
    top: { x: 0, y: 0.5, width: 1, height: 0.5 },
    bottom: { x: 0, y: 0, width: 1, height: 0.5 },
    corner: { x: 0.7, y: 0.68, width: 0.28, height: 0.28 },
};
const PRESET_OPTIONS: ReadonlyArray<{
    value: ViewportPresetId;
    label: string;
}> = [
    { value: 'full', label: 'Cheia' },
    { value: 'left', label: 'Esq.' },
    { value: 'right', label: 'Dir.' },
    { value: 'top', label: 'Topo' },
    { value: 'bottom', label: 'Base' },
    { value: 'corner', label: 'Canto' },
];
const MATCH_TOLERANCE = 1e-3;
function matchPreset(viewport: CameraViewport): ViewportPresetId | null {
    const match = PRESET_OPTIONS.find(({ value }) => {
        const preset = VIEWPORT_PRESETS[value];
        return (['x', 'y', 'width', 'height'] as const).every((key) => Math.abs(preset[key] - viewport[key]) <= MATCH_TOLERANCE);
    });
    return match?.value ?? null;
}
function percent(value: number): string {
    return `${Math.round(value * PERCENT)}%`;
}
function ViewportDiagram({ viewport }: {
    viewport: CameraViewport;
}) {
    const description = isFullViewport(viewport)
        ? 'A câmera ocupa a tela inteira'
        : `A câmera ocupa ${percent(viewport.width)} da largura e ${percent(viewport.height)} da altura, a ${percent(viewport.x)} da esquerda e ${percent(viewport.y)} da base`;
    return (<div role="img" aria-label={description} className="relative mx-2 my-1 aspect-video overflow-hidden rounded-sm bg-surface-sunken shadow-well">
      <span className="absolute rounded-xs bg-primary/80" style={{ left: percent(viewport.x), bottom: percent(viewport.y), width: percent(viewport.width), height: percent(viewport.height) }}/>
    </div>);
}
export function ViewportRectField({ viewport, onChange }: {
    viewport: CameraViewport;
    onChange: (patch: Partial<CameraViewport>) => void;
}) {
    const commit = (key: keyof CameraViewport, value: number) => {
        if (Number.isFinite(value))
            onChange({ [key]: value / PERCENT });
    };
    return (<>
      <ViewportDiagram viewport={viewport}/>
      <PropertyRow label="Área na tela" hint="Parte da tela que esta câmera ocupa: telas divididas e imagem dentro da imagem">
        <SegmentedControl label="Área na tela" options={PRESET_OPTIONS} value={matchPreset(viewport)} onChange={(preset) => onChange(VIEWPORT_PRESETS[preset])}/>
      </PropertyRow>
      <PropertyRow label="Posição" hint="Canto inferior esquerdo, em porcentagem da tela">
        <ScalarField label="Posição horizontal" value={viewport.x * PERCENT} suffix="%" onCommit={(value) => commit('x', value)}/>
        <ScalarField label="Posição vertical" value={viewport.y * PERCENT} suffix="%" onCommit={(value) => commit('y', value)}/>
      </PropertyRow>
      <PropertyRow label="Tamanho" hint="Largura e altura, em porcentagem da tela">
        <ScalarField label="Largura" value={viewport.width * PERCENT} suffix="%" onCommit={(value) => commit('width', value)}/>
        <ScalarField label="Altura" value={viewport.height * PERCENT} suffix="%" onCommit={(value) => commit('height', value)}/>
      </PropertyRow>
    </>);
}
