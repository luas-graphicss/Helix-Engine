'use client';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Lightbulb, Plus, Spotlight } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ActionButton } from '@/engine/ui/action-button';
import { useSessionTopic, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { EntityContextMenuContent } from '@/engine/editor/menus/entity-context-menu';
import { collectLights, type LightEntry } from '@/engine/editor/lights/light-catalog';
import { AddLightMenu } from './lights/add-light-menu';
import { LightBudget } from './lights/light-budget';
import { LightRow } from './lights/light-row';
import { LightsToolbar } from './lights/lights-toolbar';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
function GroupLabel({ children }: {
    children: ReactNode;
}) {
    return <div className="flex h-row items-center px-2 text-3xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</div>;
}
function EmptyState({ filtered }: {
    filtered: boolean;
}) {
    if (filtered)
        return <p className="px-3 py-4 text-center text-2xs text-muted-foreground">Nenhuma luz com esse nome.</p>;
    return (<div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <span className="flex size-9 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
        <Lightbulb className="size-4" aria-hidden/>
      </span>
      <p className="text-2xs font-medium text-foreground">Nenhuma luz local ainda</p>
      <p className="max-w-56 text-3xs leading-relaxed text-pretty text-muted-foreground">
        Pontual, cônica, painel, disco ou tubo nascem sobre o alvo da câmera, sem sombra. Comece por um preset para ter cor, alcance e animação prontos.
      </p>
      <AddLightMenu trigger={<ActionButton icon={Plus} variant="primary" className="flex-none"/>}>Adicionar luz</AddLightMenu>
    </div>);
}
export function LightsPanel() {
    const session = useSessionTopic('scene', 'selection', 'view');
    const stats = useViewportStats();
    const [query, setQuery] = useState('');
    const listRef = useRef<HTMLDivElement>(null);
    const catalog = collectLights(session.scene, query);
    const soloId = session.render.soloLightId;
    const soloEntity = soloId === null ? null : session.findById(soloId);
    const { selectedId } = session;
    useEffect(() => {
        if (soloId !== null && !soloEntity)
            session.setSoloLight(null);
    }, [session, soloId, soloEntity]);
    useEffect(() => {
        if (selectedId === null)
            return;
        const frame = requestAnimationFrame(() => {
            listRef.current?.querySelector(`[data-entity-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
        });
        return () => cancelAnimationFrame(frame);
    }, [selectedId]);
    const onListContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget)
            session.select(null);
    };
    const renderRow = (entry: LightEntry) => (<LightRow key={entry.entity.id} entry={entry} shadowState={session.shadowsEnabled ? stats.localShadowStatus.get(entry.entity.id) : undefined} solo={entry.entity.id === soloId}/>);
    return (<div className="flex h-full flex-col">
      <LightsToolbar query={query} onQueryChange={setQuery}/>
      <LightBudget />
      {soloEntity && (<div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-primary/40 bg-primary/10 px-2 text-2xs text-foreground">
          <Spotlight className="size-3.5 shrink-0 text-primary" aria-hidden/>
          <span className="min-w-0 flex-1 truncate">
            Isolando <span className="font-semibold">{soloEntity.name}</span>: as outras luzes locais estão mudas.
          </span>
          <button type="button" onClick={() => session.setSoloLight(null)} className="shrink-0 rounded-sm border border-primary/50 px-1.5 py-px text-3xs font-medium text-primary transition-colors hover:bg-primary/15">
            Sair
          </button>
        </div>)}
      <ContextMenu>
        <ContextMenuTrigger render={<div ref={listRef} role="listbox" aria-label="Luzes da cena" onContextMenu={onListContextMenu} className="min-h-0 flex-1 overflow-auto py-1"/>}>
          {catalog.global.length > 0 && (<>
              <GroupLabel>Cena</GroupLabel>
              {catalog.global.map(renderRow)}
            </>)}
          <GroupLabel>Locais{catalog.localTotal > 0 && ` · ${catalog.localTotal}`}</GroupLabel>
          {catalog.local.length > 0 ? catalog.local.map(renderRow) : <EmptyState filtered={query.trim() !== ''}/>}
        </ContextMenuTrigger>
        <EntityContextMenuContent entity={session.selectedEntity}/>
      </ContextMenu>
      <PanelSummaryFooter parts={[
            plural(catalog.total, 'luz', 'luzes'),
            plural(catalog.localTotal, 'local', 'locais'),
            `${catalog.shadowed} com sombra`,
            catalog.inactive > 0 && plural(catalog.inactive, 'apagada', 'apagadas'),
        ]}/>
    </div>);
}
