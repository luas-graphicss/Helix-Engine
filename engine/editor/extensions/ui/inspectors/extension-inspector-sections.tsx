'use client';
import { Puzzle } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { inspectorTargets, sortInspectors } from '../../inspectors/inspector-targets';
import { ExtensionGuiView } from '../gui/extension-gui-view';
import { useContributions } from '../use-contributions';
export function ExtensionInspectorSections({ selection }: {
    selection: readonly Entity[];
}) {
    const inspectors = useContributions(useEditorSession().extensions.inspectors);
    return (<>
      {sortInspectors(inspectors)
            .filter((inspector) => inspectorTargets(inspector, selection).length > 0)
            .map((inspector) => (<CollapsibleSection key={inspector.id} title={inspector.title} hint={`${inspector.title} · seção criada por uma extensão`} defaultOpen={inspector.defaultOpen} trailing={<Puzzle className="mr-1 size-3 text-muted-foreground/70" aria-hidden/>}>
            <ExtensionGuiView surface={inspector.surface}/>
          </CollapsibleSection>))}
    </>);
}
