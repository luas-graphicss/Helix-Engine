'use client';
import { ChevronDown } from 'lucide-react';
import { SCRIPT_COMPILER_STATUS_LABEL, SCRIPT_FAMILIES, SCRIPT_FAMILY_LABEL, baseLanguageCandidates, isScriptLanguageId, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const NONE_VALUE = '';
interface GameLanguageSelectProps {
    value: ScriptLanguageId | null;
    disabled?: boolean;
    onChange(language: ScriptLanguageId): void;
    className?: string;
}
export function GameLanguageSelect({ value, disabled, onChange, className }: GameLanguageSelectProps) {
    const candidates = baseLanguageCandidates();
    return (<div className={cn('relative flex h-control min-w-0 items-center overflow-hidden rounded-sm transition-colors duration-100', WELL_CLASS, 'hover:border-border-strong focus-within:border-primary/80 focus-within:hover:border-primary/80 has-[:disabled]:opacity-50', className)}>
      <select value={value ?? NONE_VALUE} disabled={disabled} aria-label="Linguagem do jogo" onChange={(event) => {
            const next = event.currentTarget.value;
            if (isScriptLanguageId(next))
                onChange(next);
        }} className="h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-6 pl-1.5 font-mono text-2xs text-foreground outline-none disabled:cursor-default [&>optgroup]:bg-surface-overlay [&>optgroup]:text-muted-foreground [&_option]:bg-surface-overlay [&_option]:text-foreground">
        {value === null && (<option value={NONE_VALUE} disabled>
            Escolher a linguagem…
          </option>)}
        {SCRIPT_FAMILIES.map((family) => {
            const inFamily = candidates.filter((language) => language.family === family);
            if (inFamily.length === 0)
                return null;
            return (<optgroup key={family} label={SCRIPT_FAMILY_LABEL[family]}>
              {inFamily.map((language) => (<option key={language.id} value={language.id}>
                  {language.label}
                  {language.recommended ? ' (recomendada)' : ''} · {SCRIPT_COMPILER_STATUS_LABEL[language.compiler].toLowerCase()}
                </option>))}
            </optgroup>);
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" aria-hidden/>
    </div>);
}
