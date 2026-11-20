'use client';
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { LiveDevicesProvider } from '@/engine/editor/input/live-devices-context';
import { restoreDefaultInputAsset } from '@/engine/editor/operations/input/input-action-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { countActions, countBindings } from '@/engine/input/actions/asset-queries';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ActionsView } from './input/actions/actions-view';
import { DevicesView } from './input/devices/devices-view';
import { PlayersView } from './input/players/players-view';
import { SchemesView } from './input/schemes/schemes-view';
const VIEWS = [
    { value: 'actions', label: 'Ações' },
    { value: 'schemes', label: 'Esquemas' },
    { value: 'devices', label: 'Dispositivos' },
    { value: 'players', label: 'Jogadores' },
] as const;
type InputView = (typeof VIEWS)[number]['value'];
function InputViewBody({ view }: {
    view: InputView;
}) {
    switch (view) {
        case 'actions':
            return <ActionsView />;
        case 'schemes':
            return <SchemesView />;
        case 'devices':
            return <DevicesView />;
        case 'players':
            return <PlayersView />;
    }
}
export function InputPanel() {
    const session = useSessionTopic('scene', 'playtest');
    const [view, setView] = useState<InputView>('actions');
    const asset = session.scene.input;
    return (<LiveDevicesProvider>
      <div className="flex h-full min-h-0 flex-col">
        <PanelToolbar>
          <span className="flex min-w-0 max-w-md flex-1">
            <SegmentedControl label="Seção do sistema de entrada" options={VIEWS} value={view} onChange={setView}/>
          </span>
          <IconButton label="Restaurar mapas, esquemas e jogadores padrão" size="sm" className="ml-auto" onClick={() => restoreDefaultInputAsset(session)}>
            <RotateCcw />
          </IconButton>
        </PanelToolbar>
        <div className="min-h-0 flex-1">
          <InputViewBody view={view}/>
        </div>
        <PanelSummaryFooter parts={[`${asset.maps.length} mapas`, `${countActions(asset)} ações`, `${countBindings(asset)} vínculos`, `${asset.schemes.length} esquemas`, asset.customDevices.length > 0 && `${asset.customDevices.length} customizados`]}/>
      </div>
    </LiveDevicesProvider>);
}
