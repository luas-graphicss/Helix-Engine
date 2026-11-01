'use client';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHub } from '../hub-context';
import { ProjectGrid } from '../projects/project-grid';
import { TemplateGallery } from '../templates/template-gallery';
import { SectionHeading } from './section-heading';
const RECENT_LIMIT = 8;
export function HomeSection() {
    const { registry, setSection } = useHub();
    const total = registry.active.length;
    const recent = registry.active.slice(0, RECENT_LIMIT);
    return (<div className="flex flex-col gap-10 p-6">
      <section aria-labelledby="templates-title" className="flex flex-col gap-4">
        <SectionHeading id="templates-title" title="Começar com um template" description="Escolha um ponto de partida. O jogo abre direto no editor e você pode renomeá-lo quando quiser."/>
        <TemplateGallery />
      </section>

      <section aria-labelledby="recent-title" className="flex flex-col gap-4">
        <SectionHeading id="recent-title" title="Recentes" count={total} action={total > RECENT_LIMIT ? (<Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setSection('projects')}>
                Ver todos
                <ArrowRight data-icon="inline-end" aria-hidden/>
              </Button>) : undefined}/>
        <ProjectGrid records={recent} total={total}/>
      </section>
    </div>);
}
