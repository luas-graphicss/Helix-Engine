'use client';
import { Check, CircleAlert, Copy, Eye, EyeOff, Layers, LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SHADER_MODEL_LABEL, STANDARD_SHADER_INPUTS } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { decodeShaderBundle, type CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { cn } from '@/lib/utils';
import { shaderBindingSnippet } from '../shader-snippets';
import { useCodeSelector } from './use-code-editor';
function standardInputName(bundle: CompiledShaderBundle, input: string): string {
    const spec = STANDARD_SHADER_INPUTS.find((entry) => entry.input === input);
    if (!spec)
        return input;
    return bundle.language === 'wgsl' ? (spec.models.length === 1 ? spec.wgslName : `helix.${spec.wgslName}`) : spec.glslName;
}
function CopySnippetButton({ snippet }: {
    snippet: string;
}) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
        catch {
            setCopied(false);
        }
    };
    return (<IconButton label={copied ? 'Trecho copiado' : `Copiar o trecho que liga o shader no script:\n${snippet}`} size="sm" onClick={() => void copy()} className={cn(copied && 'text-axis-y')}>
      {copied ? <Check /> : <Copy />}
    </IconButton>);
}
export function ShaderInfoBar({ assetId }: {
    assetId: string;
}) {
    const session = useEditorSession();
    const state = useSessionTopic('scene', 'assets');
    const tab = useCodeSelector((code) => code.tab(assetId));
    const { shaderPreview } = state;
    const compiled = state.scripts.compiler.get(assetId);
    const bundle = compiled && compiled.errorCount === 0 ? decodeShaderBundle(compiled.code) : null;
    const stale = compiled !== null && tab !== null && compiled.source !== tab.document.source;
    const previewing = shaderPreview.isPreviewing(assetId);
    const previewStatus = previewing ? shaderPreview.status : 'off';
    const baseLanguage = state.scene.scripting.baseLanguage;
    const snippet = shaderBindingSnippet(baseLanguage, bundle?.model ?? 'post', tab?.document.name ?? 'shader');
    const standardInputs = bundle ? Object.keys(bundle.standard) : [];
    const playing = state.playtest.isRunning;
    if (!tab)
        return null;
    return (<div className="flex min-h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-surface px-2 py-1 text-3xs text-muted-foreground">
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <Layers className="size-3.5 text-csg-intersect" aria-hidden/>
        <span className="font-medium text-foreground">Shader</span>
        <span className="rounded-xs border border-csg-intersect/50 px-1 font-mono text-[9px] leading-4 tracking-wider text-csg-intersect uppercase">{tab.document.language}</span>
      </span>

      {bundle ? (<>
          <span className="shrink-0 whitespace-nowrap" title="Modelo detectado pelo compilador: post (main de tela cheia) ou surface (void surface(inout HelixSurface s))">
            modelo <span className="text-foreground">{SHADER_MODEL_LABEL[bundle.model]}</span>
            {stale && <span className="text-warning"> · fonte alterado, compile de novo</span>}
          </span>
          <ToolbarSeparator />
          <span className="flex min-w-0 flex-wrap items-center gap-1" title="Uniformes declarados pelo shader; os apagados foram descartados pelo driver por nunca serem lidos">
            {bundle.uniforms.length === 0 ? (<span className="whitespace-nowrap">sem uniformes próprios</span>) : (bundle.uniforms.map((uniform) => (<span key={uniform.glslName} className={cn('rounded-xs border border-border px-1 font-mono leading-4 whitespace-nowrap', uniform.active ? 'text-foreground' : 'line-through opacity-50')} title={uniform.active ? `${uniform.type} declarado na linha ${uniform.line}` : `Declarado na linha ${uniform.line} mas nunca lido; uniforms.set("${uniform.name}") não tem efeito`}>
                  {uniform.owner ? `${uniform.owner}.` : ''}
                  {uniform.name}
                  <span className="text-muted-foreground">
                    : {uniform.type}
                    {uniform.arraySize > 1 ? `[${uniform.arraySize}]` : ''}
                  </span>
                </span>)))}
          </span>
          {standardInputs.length > 0 && (<>
              <ToolbarSeparator />
              <span className="min-w-0 truncate whitespace-nowrap" title="Entradas que a engine preenche a cada frame e este shader lê">
                engine: <span className="font-mono text-foreground">{standardInputs.map((input) => standardInputName(bundle, input)).join(', ')}</span>
              </span>
            </>)}
        </>) : (<span className="whitespace-nowrap">{compiled && compiled.errorCount > 0 ? `${compiled.errorCount} ${compiled.errorCount === 1 ? 'erro' : 'erros'} de compilação; veja os problemas abaixo.` : 'Compile (ou pré-visualize) para a engine ler o modelo e os uniformes deste shader.'}</span>)}

      <span className="ml-auto flex shrink-0 items-center gap-1">
        {previewing && shaderPreview.message && (<span className={cn('flex max-w-80 items-center gap-1 truncate whitespace-nowrap', previewStatus === 'error' ? 'text-destructive' : previewStatus === 'compiling' ? 'text-primary' : 'text-axis-y')} title={shaderPreview.message}>
            {previewStatus === 'compiling' ? <LoaderCircle className="size-3 animate-spin" aria-hidden/> : previewStatus === 'error' ? <CircleAlert className="size-3" aria-hidden/> : <Sparkles className="size-3" aria-hidden/>}
            <span className="truncate">{shaderPreview.message}</span>
          </span>)}
        <IconButton label={playing ? 'Pare o jogo para pré-visualizar o shader no editor' : previewing ? 'Desligar a pré-visualização no viewport' : bundle?.model === 'surface' || /void\s+surface\s*\(|fn\s+surface\s*\(/.test(tab.document.source) ? 'Pré-visualizar no material do ator selecionado' : 'Pré-visualizar na cadeia de pós-processamento do viewport'} size="sm" active={previewing && previewStatus !== 'error'} disabled={playing || state.code.standalone} onClick={() => void shaderPreview.toggle(assetId)}>
          {previewing ? <EyeOff /> : <Eye />}
        </IconButton>
        <CopySnippetButton snippet={snippet}/>
      </span>
    </div>);
}
