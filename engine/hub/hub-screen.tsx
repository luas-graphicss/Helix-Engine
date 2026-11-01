'use client';
import { HubDialogs } from './dialogs/hub-dialogs';
import { HubToastProvider } from './feedback/hub-toast';
import { HubProvider, useHub } from './hub-context';
import { HubHeader } from './hub-header';
import { OpeningOverlay } from './opening-overlay';
import { HomeSection } from './sections/home-section';
import { ProjectsSection } from './sections/projects-section';
import { RegistryUnavailable } from './sections/registry-unavailable';
import { TrashSection } from './sections/trash-section';
import { HubSidebar } from './sidebar/hub-sidebar';
export function HubScreen() {
    return (<HubToastProvider>
      <HubProvider>
        <div className="relative flex h-dvh overflow-clip bg-background text-foreground">
          <HubSidebar />
          <main className="relative flex min-w-0 flex-1 flex-col">
            <div aria-hidden className="boot-grid pointer-events-none absolute inset-0"/>
            <HubHeader />
            <div className="relative flex-1 overflow-y-auto">
              <HubBody />
            </div>
          </main>
        </div>
        <HubDialogs />
        <OpeningOverlay />
      </HubProvider>
    </HubToastProvider>);
}
function HubBody() {
    const { registry, section } = useHub();
    if (registry.status === 'unavailable')
        return <RegistryUnavailable message={registry.error}/>;
    switch (section) {
        case 'home':
            return <HomeSection />;
        case 'projects':
            return <ProjectsSection />;
        case 'trash':
            return <TrashSection />;
    }
}
