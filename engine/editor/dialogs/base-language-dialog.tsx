'use client';
import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useBaseLanguageChange } from '@/engine/editor/code/language/use-base-language-change';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { languageMismatches } from '@/engine/editor/operations/script-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_COMPILER_STATUS_LABEL, SCRIPT_FAMILIES, SCRIPT_FAMILY_DESCRIPTION, SCRIPT_FAMILY_LABEL, baseLanguageCandidates, scriptLanguage, type ScriptLanguage } from '@/engine/scripting/script-languages';
import { useBetaFeaturesVersion } from '@/engine/settings/beta-features';
import { FOCUS_RING_CLASS, TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { EditorDialogShell } from './editor-dialog-shell';
import { LanguageChangeDialog } from './language-change-dialog';
interface BaseLanguageDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
function LanguageRow({ language, selected, onPick }: {
    language: ScriptLanguage;
    selected: boolean;
    onPick: () => void;
}) {
    return (<li>
      <button type="button" onClick={onPick} aria-pressed={selected} className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-highlight', FOCUS_RING_CLASS, selected && 'bg-primary/10')}>
        <LanguageTag language={language.id} size="sm" silent className="mt-0.5 w-12 justify-center"/>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{language.label}</span>
            {language.recommended && <span className="font-mono text-3xs tracking-wider text-primary uppercase">recomendada</span>}
            <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground">
              .{language.extensions[0]} · {SCRIPT_COMPILER_STATUS_LABEL[language.compiler].toLowerCase()}
            </span>
          </span>
          <span className="text-2xs leading-relaxed text-pretty text-muted-foreground">{language.description}</span>
        </span>
        <Check className={cn('mt-1 size-4 shrink-0 text-primary', !selected && 'invisible')} aria-hidden/>
      </button>
    </li>);
}
export function BaseLanguageDialog({ open, onOpenChange }: BaseLanguageDialogProps) {
    const session = useSessionTopic('scene', 'assets');
    useBetaFeaturesVersion();
    const { baseLanguage } = session.scene.scripting;
    const [query, setQuery] = useState('');
    const normalized = query.trim().toLowerCase();
    const candidates = baseLanguageCandidates().filter((language) => !normalized || language.label.toLowerCase().includes(normalized) || language.tag.toLowerCase().includes(normalized) || language.extensions.some((extension) => extension.includes(normalized)));
    const mismatches = languageMismatches(session);
    const scripts = session.library.byKind('script').length;
    const change = useBaseLanguageChange(session, () => onOpenChange(false));
    return (<EditorDialogShell open={open} onOpenChange={(next) => {
            if (next)
                setQuery('');
            onOpenChange(next);
        }} title="Linguagem base do jogo" description="Um jogo é programado numa só linguagem: todo script nasce nela e só ela compila. Trocar depois não apaga nada, mas os scripts que ficarem fora da nova linguagem param de compilar até ela voltar." size="lg" toolbar={<label className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" aria-hidden/>
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Buscar linguagem ou extensão" aria-label="Buscar linguagem" className={cn(TEXT_INPUT_CLASS, 'h-7 w-full pl-7 text-2xs')} autoFocus/>
        </label>} footer={<span className="ml-auto font-mono text-3xs text-muted-foreground">
          {baseLanguage ? `Base: ${scriptLanguage(baseLanguage).label}` : 'Nenhuma linguagem escolhida'}
          {scripts > 0 && ` · ${scripts} ${scripts === 1 ? 'script' : 'scripts'}`}
          {mismatches.length > 0 && ` · ${mismatches.length} fora da base`}
        </span>}>
      {candidates.length === 0 ? (<p className="px-4 py-10 text-center text-2xs text-muted-foreground">Nenhuma linguagem corresponde a &quot;{query}&quot;.</p>) : (SCRIPT_FAMILIES.map((family) => {
            const inFamily = candidates.filter((language) => language.family === family);
            if (inFamily.length === 0)
                return null;
            return (<section key={family} className="border-b border-border last:border-b-0">
              <header className="flex flex-col gap-0.5 bg-surface-sunken/60 px-4 pt-2.5 pb-2">
                <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{SCRIPT_FAMILY_LABEL[family]}</h3>
                <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">{SCRIPT_FAMILY_DESCRIPTION[family]}</p>
              </header>
              <ul className="divide-y divide-border/60">
                {inFamily.map((language) => (<LanguageRow key={language.id} language={language} selected={language.id === baseLanguage} onPick={() => change.request(language.id)}/>))}
              </ul>
            </section>);
        }))}
      <LanguageChangeDialog plan={change.pending} onConfirm={change.confirm} onCancel={change.cancel}/>
    </EditorDialogShell>);
}
