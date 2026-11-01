'use client';
import type { ComponentType, SVGProps } from 'react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { SCRIPT_RUN_CONTEXT_DESCRIPTION, SCRIPT_RUN_CONTEXT_LABEL, countScriptLines, scriptByteLength } from '@/engine/scripting/script-document';
import { SCRIPT_COMPILER_STATUS_LABEL, isShaderLanguage, scriptLanguage } from '@/engine/scripting/script-languages';
import { SHADER_MODEL_LABEL } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { decodeShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { openSettingsSection } from '@/engine/settings/ui/settings-navigation';
import { cn } from '@/lib/utils';
import type { CodeCompileState, CodeVerifierStatus } from '../code-editor';
import { toggleCodeOption } from '../code-preferences';
import { ErrorIcon, IdleIcon, SpinnerIcon, SuccessIcon, WarningIcon, WrapIcon } from '../icons/code-icons';
import { LanguageTag } from './language-tag';
import { useCodeEditor } from './use-code-editor';
type Icon = ComponentType<SVGProps<SVGSVGElement>>;
function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function ShaderStatus({ assetId }: {
    assetId: string;
}) {
    const session = useSessionTopic('scene', 'assets', 'playtest');
    const compiled = session.scripts.compiler.get(assetId);
    const bundle = compiled && compiled.errorCount === 0 ? decodeShaderBundle(compiled.code) : null;
    const previewing = session.shaderPreview.isPreviewing(assetId) && session.shaderPreview.status === 'on';
    return (<span className="shrink-0 whitespace-nowrap" title="Shaders não executam: o renderer os liga por helix.post.custom.add ou helix.material.fromShader">
      shader{bundle ? ` · ${SHADER_MODEL_LABEL[bundle.model]} · ${bundle.uniforms.length} ${bundle.uniforms.length === 1 ? 'uniforme' : 'uniformes'}` : ' · não compilado'}
      {previewing && <span className="text-axis-y"> · em pré-visualização</span>}
    </span>);
}
const COMPILE_ICON: Record<CodeCompileState, Icon> = { unavailable: IdleIcon, idle: IdleIcon, compiling: SpinnerIcon, ok: SuccessIcon, failed: ErrorIcon };
const COMPILE_TONE: Record<CodeCompileState, string> = { unavailable: 'text-muted-foreground', idle: 'text-muted-foreground', compiling: 'text-primary', ok: 'text-axis-y', failed: 'text-destructive' };
const VERIFIER_LABEL: Record<CodeVerifierStatus, string> = { idle: 'verificador', loading: 'carregando verificador', checking: 'verificando', ok: 'verificado', unavailable: 'sem verificador' };
function VerifierStatus({ assetId }: {
    assetId: string;
}) {
    const code = useCodeEditor();
    const state = code.verifierFor(assetId);
    const busy = state.status === 'loading' || state.status === 'checking';
    const tone = state.status === 'ok' ? (state.errors > 0 ? 'text-destructive' : state.warnings > 0 ? 'text-warning' : 'text-axis-y') : busy ? 'text-primary' : 'text-muted-foreground';
    const Glyph: Icon = busy ? SpinnerIcon : state.status === 'ok' ? (state.errors > 0 ? ErrorIcon : state.warnings > 0 ? WarningIcon : SuccessIcon) : IdleIcon;
    const summary = state.status === 'ok' ? (state.errors === 0 && state.warnings === 0 ? 'sem problemas' : [state.errors > 0 && `${state.errors} ${state.errors === 1 ? 'erro' : 'erros'}`, state.warnings > 0 && `${state.warnings} ${state.warnings === 1 ? 'aviso' : 'avisos'}`].filter(Boolean).join(', ')) : VERIFIER_LABEL[state.status];
    return (<button type="button" onClick={() => openSettingsSection('code')} title={state.detail ? `${state.detail}. Clique para as preferências de verificação.` : 'Verificação ao vivo: clique para as preferências.'} className={cn('flex shrink-0 items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground', tone)}>
      <Glyph className={cn('size-3', busy && 'animate-spin')} aria-hidden/>
      <span className="max-w-56 truncate">{state.status === 'ok' && state.detail ? `${state.detail} · ${summary}` : summary}</span>
    </button>);
}
export function CodeStatusStrip() {
    const session = useSessionTopic('scene', 'assets', 'playtest');
    const code = useCodeEditor();
    const tab = code.activeTab;
    const hint = useShortcutHint();
    const CompileIcon = COMPILE_ICON[code.compileState];
    const errors = code.count('error');
    const warnings = code.count('warning');
    const { entryScriptId } = session.scene.scripting;
    return (<footer className="flex min-h-6 shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border bg-surface px-2 py-0.5 font-mono text-3xs text-muted-foreground">
      {tab ? (<>
          <span className="shrink-0 tabular-nums whitespace-nowrap text-foreground">
            Ln {tab.cursor.line}, Col {tab.cursor.column}
            {tab.cursor.selectionLength > 0 && ` (${tab.cursor.selectionLength} ${tab.cursor.selectionLength === 1 ? 'caractere' : 'caracteres'}${tab.cursor.selectionLines > 1 ? `, ${tab.cursor.selectionLines} linhas` : ''})`}
          </span>
          <span className="shrink-0 tabular-nums whitespace-nowrap">
            {countScriptLines(tab.document.source).toLocaleString('pt-BR')} linhas · {formatBytes(scriptByteLength(tab.document.source))}
          </span>
          <span className={cn('shrink-0 whitespace-nowrap', code.isDirty(tab) ? 'text-warning' : '')} title={code.isDirty(tab) ? hint('Alterações não salvas', 'code.save') : 'Salvo na biblioteca'}>
            {code.isDirty(tab) ? 'não salvo' : 'salvo'}
          </span>
          <VerifierStatus assetId={tab.assetId}/>
        </>) : (<span className="shrink-0 whitespace-nowrap">
          {code.tabs.length === 0 ? 'Nenhum script aberto' : `${code.tabs.length} ${code.tabs.length === 1 ? 'aba' : 'abas'} · ${code.openLines.toLocaleString('pt-BR')} linhas`}
        </span>)}
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5">
        {(errors > 0 || warnings > 0) && (<span className="flex shrink-0 items-center gap-2 whitespace-nowrap" title="Problemas em todos os scripts do projeto">
            {errors > 0 && (<span className="flex items-center gap-1 text-destructive">
                <ErrorIcon className="size-3" aria-hidden/>
                {errors}
              </span>)}
            {warnings > 0 && (<span className="flex items-center gap-1 text-warning">
                <WarningIcon className="size-3" aria-hidden/>
                {warnings}
              </span>)}
          </span>)}
        <span className={cn('flex shrink-0 items-center gap-1 whitespace-nowrap', COMPILE_TONE[code.compileState])} title={code.compileMessage}>
          <CompileIcon className={cn('size-3', code.compileState === 'compiling' && 'animate-spin')} aria-hidden/>
          <span className="max-w-72 truncate">{code.compileMessage}</span>
        </span>
        {tab && (<>
            <button type="button" title="Quebrar linhas longas" aria-pressed={code.options.wordWrap} onClick={() => toggleCodeOption('wordWrap')} className={cn('flex shrink-0 items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground', code.options.wordWrap && 'text-primary')}>
              <WrapIcon className="size-3" aria-hidden/>
              quebra
            </button>
            {isShaderLanguage(tab.document.language) ? (<ShaderStatus assetId={tab.assetId}/>) : (<span className="shrink-0 whitespace-nowrap" title={SCRIPT_RUN_CONTEXT_DESCRIPTION[tab.document.runContext]}>
                {SCRIPT_RUN_CONTEXT_LABEL[tab.document.runContext].toLowerCase()}
                {entryScriptId === tab.assetId && ' · entrada'}
              </span>)}
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap" title={SCRIPT_COMPILER_STATUS_LABEL[scriptLanguage(tab.document.language).compiler]}>
              <LanguageTag language={tab.document.language} silent/>
              <span className="text-foreground">{scriptLanguage(tab.document.language).label}</span>
            </span>
            <span className="shrink-0 tabular-nums whitespace-nowrap">
              {scriptLanguage(tab.document.language).indent.useTabs ? 'tab' : `${scriptLanguage(tab.document.language).indent.size} espaços`} · {code.options.fontSize} px
            </span>
          </>)}
      </span>
    </footer>);
}
