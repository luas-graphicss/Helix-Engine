'use client';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { ViewGrid } from '../shared/panel-section';
import { NetworkSimulatorSection } from './network-simulator-section';
import { TestClientsSection } from './test-clients-section';
import { TrafficSection } from './traffic-section';
export function ToolsView({ status }: {
    status: MultiplayerStatus;
}) {
    return (<ViewGrid>
      <NetworkSimulatorSection status={status}/>
      <TestClientsSection status={status}/>
      <TrafficSection status={status}/>
    </ViewGrid>);
}
