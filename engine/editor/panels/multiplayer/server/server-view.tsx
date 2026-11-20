'use client';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { ViewGrid } from '../shared/panel-section';
import { BundleSection } from './bundle-section';
import { DeploySection } from './deploy-section';
import { LiveServerSection } from './live-server-section';
import { PlaytestTargetSection } from './playtest-target-section';
export function ServerView({ status }: {
    status: MultiplayerStatus;
}) {
    return (<ViewGrid>
      <DeploySection />
      <BundleSection />
      <PlaytestTargetSection />
      <LiveServerSection status={status}/>
    </ViewGrid>);
}
