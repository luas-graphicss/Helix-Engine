'use client';
import { FlaskConical, Languages } from 'lucide-react';
import { GameLanguageSelect } from '@/engine/editor/code/language/game-language-select';
import { useBaseLanguageChange } from '@/engine/editor/code/language/use-base-language-change';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { LanguageChangeDialog } from '@/engine/editor/dialogs/language-change-dialog';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { languageMismatches, mixLanguagesEnabled } from '@/engine/editor/operations/script-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_COMPILER_STATUS_LABEL, scriptLanguage } from '@/engine/scripting/script-languages';
import { useBetaFeaturesVersion } from '@/engine/settings/beta-features';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
export function GameLanguagePanel() {
    const session = useSessionTopic('scene', 'assets');
    useBetaFeaturesVersion();
    const change = useBaseLanguageChange(session);
    const { baseLanguage } = session.scene.scripting;
    const language = baseLanguage ? scriptLanguage(baseLanguage) : null;
    const readOnly = session.code.standalone;
    const scripts = session.library.byKind('script').length;
    const outside = languageMismatches(session).length;
    const mixing = mixLanguagesEnabled();
    return (<div className={cn('flex flex-col divide-y divide-border rounded-sm', WELL_CLASS)}>
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-sm border', language ? 'border-border bg-surface' : 'border-warning/50 bg-warning/10')}>
            {language ? <LanguageTag language={language.id} size="sm" silent className="border-0 px-0"/> : <Languages className="size-4 text-warning" aria-hidden/>}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">{language ? language.label : 'Nenhuma linguagem escolhida'}</span>
            <p className="text-2xs leading-relaxed text-pretty text-muted-foreground">
              {language ? `${language.description} ${SCRIPT_COMPILER_STATUS_LABEL[language.compiler]}.` : 'Escolha a linguagem em que este jogo é programado; todo script nasce nela.'}
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center md:w-80" title={readOnly ? 'A linguagem do jogo é trocada no editor principal' : undefined}>
          <GameLanguageSelect value={baseLanguage} disabled={readOnly} onChange={change.request} className="flex-1"/>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 font-mono text-3xs text-muted-foreground">
        <span>
          {scripts === 0 ? 'Nenhum script no jogo' : `${scripts} ${scripts === 1 ? 'script' : 'scripts'} no jogo`}
          {outside > 0 && <span className="text-warning"> · {outside} fora da linguagem</span>}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <FlaskConical className={cn('size-3', mixing ? 'text-primary' : '')} aria-hidden/>
          Mesclagem de linguagens {mixing ? 'ligada' : 'desligada'}
          <span aria-hidden>·</span>
          <button type="button" className="text-primary hover:underline" onClick={() => editorDialogs.open('beta')}>
            Funcionalidades beta
          </button>
        </span>
      </div>
      <LanguageChangeDialog plan={change.pending} onConfirm={change.confirm} onCancel={change.cancel}/>
    </div>);
}
