'use client';
import { useEffect, useState } from 'react';
import { bootStartedAt } from '@/engine/boot/boot-clock';
import { LoadingScreen } from '@/engine/boot/loading-screen';
import { useMinimumVisible } from '@/engine/boot/use-minimum-visible';
import type { Progress } from '@/engine/core/progress';
import type { ProjectRegistryStatus } from '@/engine/project/project-registry';
import { HubScreen } from './hub-screen';
import { useProjectRegistry } from './use-project-registry';
const MINIMUM_SPLASH_MS = 1600;
const PROGRESS: Record<ProjectRegistryStatus, Progress> = {
    idle: { label: 'Iniciando a engine', fraction: 0.15 },
    loading: { label: 'Lendo os seus jogos', fraction: 0.6 },
    ready: { label: 'Pronto', fraction: 1 },
    unavailable: { label: 'Pronto', fraction: 1 },
};
export function HubBoot() {
    const registry = useProjectRegistry();
    const [splashVisible, setSplashVisible] = useState(true);
    useEffect(() => {
        void registry.load();
    }, [registry]);
    const loaded = registry.status === 'ready' || registry.status === 'unavailable';
    const done = useMinimumVisible(loaded, bootStartedAt(), MINIMUM_SPLASH_MS);
    return (<>
      {loaded && <HubScreen />}
      {splashVisible && <LoadingScreen progress={PROGRESS[registry.status]} done={done} onExited={() => setSplashVisible(false)}/>}
    </>);
}
