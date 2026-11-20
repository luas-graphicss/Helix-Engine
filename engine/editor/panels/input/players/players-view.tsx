'use client';
import { useEffect, useReducer } from 'react';
import { updateInputPlayers } from '@/engine/editor/operations/input/input-player-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { findControlScheme } from '@/engine/input/actions/asset-queries';
import { ALL_MAPS, MAX_LOCAL_PLAYERS } from '@/engine/input/actions/input-asset';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { JOIN_MODE_OPTIONS } from '../input-labels';
import { ColumnNote } from '../shared/column';
const wholeNumber = (value: number) => String(Math.round(value));
export function PlayersView() {
    const session = useEditorSession();
    const asset = session.scene.input;
    const { system } = session.scripts.inputSystem;
    const [, refresh] = useReducer((revision: number) => revision + 1, 0);
    useEffect(() => system.players.onEvent(refresh), [system]);
    const mapOptions = [{ value: ALL_MAPS, label: 'Todos os mapas' }, ...asset.maps.map(({ id, name }) => ({ value: id, label: name }))];
    const players = session.scripts.running ? system.players.all : [];
    return (<div className="flex h-full min-h-0 flex-col overflow-auto @2xl/panel:flex-row">
      <div className="min-w-0 @2xl/panel:w-96 @2xl/panel:border-r @2xl/panel:border-border">
        <CollapsibleSection title="Multiplayer local">
          <SliderField label="Máx. jogadores" value={asset.players.maxPlayers} min={1} max={MAX_LOCAL_PLAYERS} step={1} format={wholeNumber} onChange={(maxPlayers) => updateInputPlayers(session, { maxPlayers })}/>
          <PropertyRow label="Entrada" hint="Por script: helix.input.players.join. Ao pressionar: um controle vinculado em dispositivo livre cria o jogador.">
            <SegmentedControl label="Como os jogadores entram" options={JOIN_MODE_OPTIONS} value={asset.players.joinMode} onChange={(joinMode) => updateInputPlayers(session, { joinMode })}/>
          </PropertyRow>
          <PropertyRow label="Mapa inicial">
            <SelectField label="Mapa ativo quando o jogador entra" options={mapOptions} value={asset.players.defaultMap} onChange={(defaultMap) => updateInputPlayers(session, { defaultMap })}/>
          </PropertyRow>
        </CollapsibleSection>
      </div>
      <div className="min-w-0 flex-1">
        <CollapsibleSection title="No teste de jogo">
          {players.length === 0 && <ColumnNote>{session.scripts.running ? 'Nenhum jogador entrou ainda.' : 'Inicie o teste de jogo para acompanhar os jogadores.'}</ColumnNote>}
          <ul className="flex flex-col">
            {players.map((player) => (<li key={player.index} className="flex min-h-row items-center gap-2 px-2 text-2xs">
                <span className="shrink-0 font-medium text-foreground">Jogador {player.index + 1}</span>
                <span className="shrink-0 text-muted-foreground">{player.scheme === null ? 'Sem esquema' : (findControlScheme(asset, player.scheme)?.name ?? player.scheme)}</span>
                <span className="min-w-0 flex-1 truncate text-right font-mono text-3xs text-muted-foreground/70">{player.devices.map((device) => device.name).join(' + ') || 'sem dispositivo'}</span>
              </li>))}
          </ul>
        </CollapsibleSection>
      </div>
    </div>);
}
