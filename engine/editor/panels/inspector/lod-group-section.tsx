'use client';
import { Layers, RefreshCw, Ruler, Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { createLodGroup, fitLodGroupRadius, previewLodGroupLevel, removeLodGroup, setLodGroupScreenHeight, syncLodGroupLevels } from '@/engine/editor/operations/lod-group-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_LOD_GROUP_LEVELS, MAX_LOD_SCREEN_HEIGHT, MIN_LOD_SCREEN_HEIGHT, type LodGroupSettings } from '@/engine/renderer/lod/groups/lod-group-settings';
import { lodGroupPreview } from '@/engine/renderer/render-overrides';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { formatNumber } from './number-fields';
const PERCENT = 100;
const AUTOMATIC_PREVIEW = 'auto';
type PreviewLevel = number | typeof AUTOMATIC_PREVIEW;
const LEVEL_FADE = 0.11;
const HINT_CLASS = 'px-2 pb-1 text-3xs leading-relaxed text-pretty text-muted-foreground';
function percent(value: number): string {
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 1 ? 2 : 1 })}%`;
}
function manageableLevels(group: Entity): number {
    return Math.min(group.children.length, MAX_LOD_GROUP_LEVELS);
}
function TransitionBar({ screenHeights }: {
    screenHeights: readonly number[];
}) {
    const shares: number[] = [];
    let ceiling = MAX_LOD_SCREEN_HEIGHT;
    for (const height of screenHeights) {
        shares.push(Math.sqrt(Math.max(ceiling - height, 0)));
        ceiling = height;
    }
    return (<div role="img" aria-label="Faixa de altura em tela de cada nível, do mais próximo ao mais distante" className="mx-2 my-1 flex h-5 overflow-hidden rounded-sm bg-surface-sunken shadow-well">
      {shares.map((share, level) => (<span key={level} className="flex min-w-5 items-center justify-center bg-primary font-mono text-3xs text-primary-foreground" style={{ flexGrow: share, opacity: 1 - level * LEVEL_FADE }}>
          L{level}
        </span>))}
      <span className="flex min-w-10 items-center justify-center font-mono text-3xs text-muted-foreground" style={{ flexGrow: Math.sqrt(ceiling) }}>
        oculto
      </span>
    </div>);
}
function LodGroupEditor({ group, settings }: {
    group: Entity;
    settings: LodGroupSettings;
}) {
    const session = useEditorSession();
    const levelCount = Math.min(settings.screenHeights.length, group.children.length);
    const levels = Array.from({ length: levelCount }, (_, level) => level);
    const previewOptions: { value: PreviewLevel; label: string }[] = [{ value: AUTOMATIC_PREVIEW, label: 'Auto' }, ...levels.map((level) => ({ value: level, label: `L${level}` }))];
    const outOfSync = settings.screenHeights.length !== manageableLevels(group);
    return (<CollapsibleSection title="Grupo de LOD">
      <TransitionBar screenHeights={settings.screenHeights.slice(0, levelCount)}/>
      {levels.map((level) => (<SliderField key={level} label={`L${level} · ${group.children[level].name}`} value={settings.screenHeights[level] * PERCENT} min={MIN_LOD_SCREEN_HEIGHT * PERCENT} max={MAX_LOD_SCREEN_HEIGHT * PERCENT} step={0.1} scale="log" format={percent} onChange={(value) => setLodGroupScreenHeight(session, group, level, value / PERCENT)}/>))}
      <p className={HINT_CLASS}>
        Cada filho aparece enquanto o grupo ocupa pelo menos essa fração da altura da tela. Abaixo da última transição, o grupo deixa de ser
        desenhado.
      </p>
      <PropertyRow label="Pré-visualizar" hint="Fixa o nível mostrado no editor. Não é salvo com o jogo.">
        <SegmentedControl label="Nível mostrado no editor" options={previewOptions} value={lodGroupPreview(group) ?? AUTOMATIC_PREVIEW} onChange={(value) => previewLodGroupLevel(session, group, typeof value === 'number' ? value : null)}/>
      </PropertyRow>
      <PropertyRow label="Raio" hint="Esfera em torno da origem do grupo usada para medir a altura em tela">
        <span className="font-mono text-2xs text-foreground/80 tabular-nums">{formatNumber(settings.radius)} m</span>
      </PropertyRow>
      <ActionRow>
        <ActionButton icon={Ruler} onClick={() => fitLodGroupRadius(session, group)}>
          Recalcular raio
        </ActionButton>
        {outOfSync && (<ActionButton icon={RefreshCw} onClick={() => syncLodGroupLevels(session, group)}>
            Atualizar níveis
          </ActionButton>)}
        <ActionButton icon={Trash2} variant="danger" onClick={() => removeLodGroup(session, group)}>
          Remover
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
export function LodGroupSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    if (entity.lodGroup)
        return <LodGroupEditor group={entity} settings={entity.lodGroup}/>;
    if (entity.kind !== 'group' || entity.children.length === 0)
        return null;
    return (<CollapsibleSection title="Grupo de LOD" defaultOpen={false}>
      <p className={HINT_CLASS}>
        Cada filho direto vira um nível de detalhe, na ordem da hierarquia: o primeiro é o mais detalhado. O grupo mostra um nível por vez,
        conforme a altura que ocupa na tela.
      </p>
      <ActionRow>
        <ActionButton icon={Layers} variant="primary" onClick={() => createLodGroup(session, entity)}>
          Criar com {manageableLevels(entity)} nível(is)
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
