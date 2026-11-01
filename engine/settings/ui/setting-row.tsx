'use client';
import { RotateCcw } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { ENGINE_SETTINGS, type SettingId } from '../engine-settings-schema';
import { engineSettings, useEngineSetting } from '../engine-settings-store';
import { SettingControl } from './setting-control';
export function SettingRow({ id }: {
    id: SettingId;
}) {
    const definition = ENGINE_SETTINGS[id];
    const value = useEngineSetting(id);
    const customized = !engineSettings.isDefault(id);
    const hint = definition.type === 'select' ? definition.options.find((option) => option.value === value)?.hint : undefined;
    return (<li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground">{definition.label}</span>
          {customized && <span className="size-1.5 rounded-full bg-primary" title="Diferente do padrão" aria-label="Diferente do padrão"/>}
          {definition.requiresReopen && <span className="rounded-xs border border-border bg-surface-raised px-1 font-mono text-3xs text-muted-foreground">ao reabrir o jogo</span>}
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground text-pretty">{definition.description}</p>
        {hint && <p className="font-mono text-3xs text-muted-foreground/80">{hint}</p>}
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-80">
        <SettingControl id={id}/>
        <IconButton label="Voltar ao padrão" size="xs" disabled={!customized} onClick={() => engineSettings.reset(id)}>
          <RotateCcw aria-hidden/>
        </IconButton>
      </div>
    </li>);
}
