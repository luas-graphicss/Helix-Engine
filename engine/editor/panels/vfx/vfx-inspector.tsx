'use client';
import { Blocks, Image, Shapes, Sparkles, Sprout, Timer } from 'lucide-react';
import { vfxModuleInfo } from '@/engine/vfx/document/vfx-document';
import { VFX_SECTION_LABEL, type VfxInspectorSection } from '@/engine/editor/vfx/vfx-editor';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useVfxEditor } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { VFX_RULER_HEIGHT } from '@/engine/editor/vfx/ui/vfx-stack-model';
import { TabStrip, type TabDefinition } from '@/engine/ui/tab-strip';
import { EffectSection } from './inspector/effect-section';
import { InitialSection } from './inspector/initial-section';
import { ModuleSection } from './inspector/module-section';
import { RendererSection } from './inspector/renderer-section';
import { ShapeSection } from './inspector/shape-section';
import { SpawnSection } from './inspector/spawn-section';
const EMITTER_TABS: ReadonlyArray<{
    id: Exclude<VfxInspectorSection, 'effect' | 'module'>;
    icon: TabDefinition['icon'];
}> = [
    { id: 'spawn', icon: Timer },
    { id: 'shape', icon: Shapes },
    { id: 'initial', icon: Sprout },
    { id: 'renderer', icon: Image },
];
export function VfxInspector() {
    useSessionTopic('assets', 'scene', 'selection');
    const editor = useVfxEditor();
    const { document } = editor;
    const emitter = editor.selectedEmitter;
    const module = editor.selectedModule;
    if (!document)
        return null;
    const tabs: TabDefinition[] = [{ id: 'effect', label: 'Efeito', icon: Sparkles }];
    if (emitter) {
        for (const tab of EMITTER_TABS)
            tabs.push({ id: tab.id, label: VFX_SECTION_LABEL[tab.id], icon: tab.icon });
        if (module)
            tabs.push({ id: 'module', label: vfxModuleInfo(module.kind).label, icon: Blocks });
    }
    const active: VfxInspectorSection = emitter ? (editor.section === 'module' && !module ? 'spawn' : editor.section) : 'effect';
    const onChange = (id: string) => {
        const section = id as VfxInspectorSection;
        if (section === 'module') {
            if (emitter && module)
                editor.selectModule(emitter.id, module.id);
            return;
        }
        editor.setSection(section);
    };
    return (<div className="flex h-full min-w-0 flex-col bg-surface">
      <div className="shrink-0 border-b border-border bg-surface-sunken" style={{ height: VFX_RULER_HEIGHT }}>
        <TabStrip compact tabs={tabs} activeId={active} onChange={onChange}/>
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]">
        {active === 'effect' || !emitter ? (<EffectSection document={document}/>) : active === 'module' && module ? (<ModuleSection emitter={emitter} module={module}/>) : active === 'shape' ? (<ShapeSection emitter={emitter}/>) : active === 'initial' ? (<InitialSection emitter={emitter}/>) : active === 'renderer' ? (<RendererSection emitter={emitter}/>) : (<SpawnSection document={document} emitter={emitter}/>)}
      </div>
    </div>);
}
