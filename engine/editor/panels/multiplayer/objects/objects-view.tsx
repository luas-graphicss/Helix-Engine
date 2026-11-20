'use client';
import { NETWORK_SPAWN_ICON } from '@/engine/editor/multiplayer/spawn-icons';
import { addNetworkObject, canAddNetworkObject } from '@/engine/editor/operations/multiplayer/network-object-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { AUTHORITY_LABEL, NETWORK_SPAWN_HINT, NETWORK_SPAWN_LABEL, NETWORK_SPAWN_MODES } from '@/engine/net/scene/network-object-settings';
import { networkEntities } from '@/engine/net/scene/scene-network-plan';
import { ActionButton } from '@/engine/ui/action-button';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { plural } from '../shared/format';
import { PanelSection, SectionNote, ViewGrid } from '../shared/panel-section';
export function ObjectsView() {
    const session = useSessionTopic('scene', 'selection');
    const entities = networkEntities(session.scene);
    const selected = session.selectedEntity;
    const canAdd = selected !== null && canAddNetworkObject(selected);
    return (<ViewGrid>
      <PanelSection title="Objetos de rede da cena" description="Atores cuja pose, posse e variáveis viajam pela sessão. Clique para selecionar; as opções ficam na seção Objeto de rede do Inspetor.">
        {entities.length === 0 ? (<SectionNote>Nenhum ator em rede ainda. Selecione um ator e escolha ao lado como ele entra na sessão.</SectionNote>) : (<ul className="flex flex-col gap-px">
            {entities.map((entity) => {
                const settings = entity.networkObject;
                if (!settings)
                    return null;
                const Icon = NETWORK_SPAWN_ICON[settings.spawn];
                const isSelected = entity === selected;
                return (<li key={entity.id}>
                  <button type="button" aria-pressed={isSelected} onClick={() => session.select(entity)} className={cn('flex h-control w-full cursor-default items-center gap-2 rounded-sm px-1.5 text-left text-2xs select-none', isSelected ? 'bg-primary/20 text-foreground' : 'text-foreground/90 hover:bg-highlight', FOCUS_RING_CLASS)}>
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
                    <span className="min-w-0 flex-1 truncate font-medium">{entity.name}</span>
                    <span className="shrink-0 text-3xs text-muted-foreground">{NETWORK_SPAWN_LABEL[settings.spawn]}</span>
                    <span className="w-14 shrink-0 text-right font-mono text-3xs text-muted-foreground/80">{AUTHORITY_LABEL[settings.authority]}</span>
                    <span className="w-12 shrink-0 text-right font-mono text-3xs text-muted-foreground/70">{plural(settings.variables.length, 'var', 'vars')}</span>
                  </button>
                </li>);
            })}
          </ul>)}
      </PanelSection>
      <PanelSection title="Pôr o ator selecionado em rede" description={selected ? `Selecionado: ${selected.name}.` : 'Selecione um ator na cena ou na hierarquia.'}>
        <ul className="flex flex-col gap-2">
          {NETWORK_SPAWN_MODES.map((mode) => (<li key={mode} className="flex items-start gap-2">
              <ActionButton icon={NETWORK_SPAWN_ICON[mode]} disabled={!canAdd} className="w-40 shrink-0" onClick={() => {
                    if (selected)
                        addNetworkObject(session, selected, mode);
                }}>
                {NETWORK_SPAWN_LABEL[mode]}
              </ActionButton>
              <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{NETWORK_SPAWN_HINT[mode]}</span>
            </li>))}
        </ul>
        {selected && !canAdd && <SectionNote>{selected.networkObject ? 'Este ator já é um objeto de rede.' : 'Este ator não pode entrar em rede: a raiz, terrenos, interfaces e scripts ficam de fora, e um objeto de rede não pode conter outro.'}</SectionNote>}
      </PanelSection>
    </ViewGrid>);
}
