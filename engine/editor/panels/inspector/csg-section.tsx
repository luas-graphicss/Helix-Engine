'use client';
import { Diff, Hammer, Plus, RefreshCw, Undo2, Unlink } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import type { Entity } from '@/engine/core/scene/entity';
import { getTriangleCount } from '@/engine/renderer/geometry/mesh-data';
import { brushTarget } from '@/engine/geometry/csg/csg-system';
import { brushesOf, canBeCsgTarget } from '@/engine/geometry/csg/csg-roles';
import { CSG_OPERATIONS, CSG_OPERATION_LABEL, CSG_PRECISION_LABEL, type CsgOperation, type CsgPrecision, } from '@/engine/geometry/csg/csg-settings';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addCsgBrush, consolidateCsg, rebuildCsg, releaseBrush, revertCsg, selectBrushTarget, setBrushEnabled, setBrushOperation, setCsgLive, setCsgPrecision, setCsgShowBrushes, } from '@/engine/editor/operations/csg-operations';
import { BrushList } from './csg/brush-list';
import { BrushTools } from './csg/brush-tools';
import { CsgCollisionRow } from './csg/csg-collision-row';
import { TargetTools } from './csg/target-tools';
const OPERATION_OPTIONS: ReadonlyArray<{
    value: CsgOperation;
    label: string;
}> = CSG_OPERATIONS.map((operation) => ({
    value: operation,
    label: CSG_OPERATION_LABEL[operation],
}));
const PRECISION_OPTIONS: ReadonlyArray<{
    value: CsgPrecision;
    label: string;
}> = [
    { value: 'fast', label: CSG_PRECISION_LABEL.fast },
    { value: 'exact', label: CSG_PRECISION_LABEL.exact },
];
const percent = (value: number) => `${Math.round(value * 100)}%`;
function formatMilliseconds(value: number): string {
    return value < 10 ? value.toFixed(1) : Math.round(value).toString();
}
function CsgPrompt({ entity }: {
    entity: Entity;
}) {
    return (<CollapsibleSection title="CSG" defaultOpen={false}>
      <p className="px-2 pt-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Esculpa este ator com pincéis: subtraia para abrir furos e portas, una para fundir formas ou mantenha só a interseção. O resultado é
        reconstruído ao vivo enquanto você move os pincéis, e a colisão acompanha.
      </p>
      <TargetTools target={entity}/>
    </CollapsibleSection>);
}
function GhostOpacityField() {
    const session = useEditorState();
    return (<SliderField label="Fantasmas" value={session.csgPreferences.ghostOpacity} min={0.05} max={1} format={percent} onChange={(value) => session.updateCsgPreferences({ ghostOpacity: value })}/>);
}
function CsgTargetSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const settings = entity.csg;
    if (!settings)
        return null;
    const brushes = brushesOf(entity);
    const stats = session.csg.statsOf(entity);
    const sourceTriangles = getTriangleCount(settings.sourceMesh);
    const resultTriangles = entity.mesh ? getTriangleCount(entity.mesh) : 0;
    return (<CollapsibleSection title="CSG" trailing={<IconButton label="Reconstruir agora" size="sm" className="size-5 [&_svg]:size-3" onClick={() => rebuildCsg(session, entity)}>
          <RefreshCw />
        </IconButton>}>
      <ToggleField label="Reconstruir ao vivo" on={settings.live} onToggle={() => setCsgLive(session, entity, !settings.live)}/>
      <ToggleField label="Mostrar pincéis" on={settings.showBrushes} onToggle={() => setCsgShowBrushes(session, entity, !settings.showBrushes)}/>
      <PropertyRow label="Precisão">
        <SegmentedControl label="Precisão do CSG" options={PRECISION_OPTIONS} value={settings.precision} onChange={(precision) => setCsgPrecision(session, entity, precision)}/>
      </PropertyRow>
      <PropertyRow label="Triângulos">
        <FieldInput readOnly value={`${sourceTriangles.toLocaleString('pt-BR')} → ${resultTriangles.toLocaleString('pt-BR')}`} title={stats ? `${stats.clippedTriangles.toLocaleString('pt-BR')} triângulos do alvo entraram no recorte na última reconstrução.` : undefined} aria-label="Triângulos da fonte e do resultado"/>
      </PropertyRow>
      {stats && stats.builds > 0 && (<PropertyRow label="Reconstrução">
          <FieldInput readOnly value={stats.deferred ? `adiada · solte o gizmo` : `${formatMilliseconds(stats.lastBuildMs)} ms · ${stats.builds.toLocaleString('pt-BR')}×`} title={stats.deferred
                ? 'Alvo pesado: a reconstrução acontece ao soltar o botão do mouse.'
                : settings.precision === 'fast'
                    ? 'Modo rápido: só os triângulos perto de cada pincel são recortados.'
                    : 'Modo exato: toda a malha entra em cada operação.'} aria-label="Duração da última reconstrução e total de reconstruções"/>
        </PropertyRow>)}
      <CsgCollisionRow target={entity}/>
      <GhostOpacityField />

      <BrushList brushes={brushes}/>
      <TargetTools target={entity}/>

      <ActionRow>
        <ActionButton icon={Hammer} variant="primary" onClick={() => consolidateCsg(session, entity)} title="Fixa o resultado como malha do ator e remove os pincéis">
          Consolidar
        </ActionButton>
        <ActionButton icon={Undo2} variant="danger" onClick={() => revertCsg(session, entity)} title="Devolve a malha original ao ator e remove os pincéis">
          Reverter
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
function CsgBrushSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const settings = entity.csgBrush;
    if (!settings)
        return null;
    const target = brushTarget(entity);
    return (<CollapsibleSection title="Pincel CSG" trailing={<IconButton label="Soltar pincel (volta a ser uma malha comum)" size="sm" className="size-5 [&_svg]:size-3" onClick={() => releaseBrush(session, entity)}>
          <Unlink />
        </IconButton>}>
      <PropertyRow label="Operação">
        <SegmentedControl label="Operação do pincel" options={OPERATION_OPTIONS} value={settings.operation} onChange={(operation) => setBrushOperation(session, entity, operation)}/>
      </PropertyRow>
      <ToggleField label="Ativo" on={settings.enabled} onToggle={() => setBrushEnabled(session, entity, !settings.enabled)}/>
      <PropertyRow label="Alvo">
        {target ? (<button type="button" onClick={() => selectBrushTarget(session, entity)} className="flex h-6 min-w-0 flex-1 items-center gap-1.5 truncate rounded-sm border border-border bg-input px-2 text-left text-2xs text-foreground hover:bg-highlight" title={`Selecionar ${target.name}`}>
            <Diff className="size-3 shrink-0 text-muted-foreground" aria-hidden/>
            <span className="truncate">{target.name}</span>
          </button>) : (<FieldInput readOnly value="Solto (fora de um alvo CSG)" aria-label="Alvo do pincel"/>)}
      </PropertyRow>
      {target && <BrushTools brush={entity} target={target}/>}
      <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        {target
            ? 'Mova, gire e escale o pincel com o gizmo: o alvo é reconstruído ao vivo. Pincéis nunca colidem; o que colide é o resultado no alvo.'
            : 'Arraste este ator para dentro de um alvo CSG na hierarquia para que ele volte a esculpir.'}
      </p>
      {target && (<ActionRow>
          <ActionButton icon={Plus} variant="primary" onClick={() => addCsgBrush(session, target, 'box', settings.operation)} title={`Adiciona outro pincel a ${target.name}`}>
            Outro pincel
          </ActionButton>
        </ActionRow>)}
    </CollapsibleSection>);
}
export function CsgSection({ entity }: {
    entity: Entity;
}) {
    if (entity.csgBrush)
        return <CsgBrushSection entity={entity}/>;
    if (entity.csg)
        return <CsgTargetSection entity={entity}/>;
    if (canBeCsgTarget(entity))
        return <CsgPrompt entity={entity}/>;
    return null;
}
