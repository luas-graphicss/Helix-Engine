'use client';
import { Atom, Code2, LayoutTemplate, Monitor, MousePointer2, Save, SlidersHorizontal, Volume2, type LucideIcon } from 'lucide-react';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { ENGINE_SETTING_SECTIONS } from '../engine-settings-schema';
import { customizedCountInSection, useEngineSettingsVersion } from '../engine-settings-store';
const SECTION_ICON: Readonly<Record<string, LucideIcon>> = {
    editor: SlidersHorizontal,
    project: Save,
    selection: MousePointer2,
    gui: LayoutTemplate,
    simulation: Atom,
    render: Monitor,
    code: Code2,
    audio: Volume2,
};
interface SettingsNavProps {
    activeId: string;
    muted: boolean;
    onSelect(id: string): void;
}
export function SettingsNav({ activeId, muted, onSelect }: SettingsNavProps) {
    useEngineSettingsVersion();
    return (<nav aria-label="Seções das configurações" className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-sunken/50">
      <ul className="flex flex-col py-1">
        {ENGINE_SETTING_SECTIONS.map((section) => {
            const Icon = SECTION_ICON[section.id] ?? SlidersHorizontal;
            const count = customizedCountInSection(section.id);
            const active = !muted && section.id === activeId;
            return (<li key={section.id}>
              <button type="button" onClick={() => onSelect(section.id)} aria-current={active ? 'true' : undefined} title={section.description} className={cn('flex h-8 w-full items-center gap-2 px-4 text-left text-xs transition-colors duration-100', FOCUS_RING_CLASS, active ? 'bg-surface-raised text-foreground shadow-bevel' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
                <Icon className={cn('size-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden/>
                <span className="min-w-0 flex-1 truncate">{section.title}</span>
                {count > 0 && (<span className="shrink-0 rounded-xs border border-primary/40 bg-primary/10 px-1 font-mono text-3xs text-primary" title={`${count} fora do padrão`}>
                    {count}
                  </span>)}
              </button>
            </li>);
        })}
      </ul>
    </nav>);
}
