'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Ban, Download, Package, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadBuildOptions, saveBuildOptions } from '@/engine/build/build-options-store';
import { BUILD_STAGES, formatBuildBytes, formatEta, predictStageSeconds, type BuildStageId } from '@/engine/build/build-progress';
import { BUILD_PLATFORMS, buildPlatformOf, type BuildOptions, type BuildPlatformId } from '@/engine/build/build-targets';
import { gameCompiler } from '@/engine/build/game-compiler';
import { isTemplateCached } from '@/engine/build/template-store';
import { useBuildProgress } from '@/engine/build/use-game-compiler';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { projectRecordOf } from '@/engine/project/project-context';
import { EMPTY_WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { EditorDialogShell } from '../editor-dialog-shell';
import { BuildContents } from './build-contents';
import { BuildForm } from './build-form';
import { BuildLog } from './build-log';
import { BuildProgressView } from './build-progress-view';
import { BuildResultView } from './build-result-view';
interface BuildGameDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
const NO_PLATFORMS: ReadonlySet<BuildPlatformId> = new Set();
const TEMPLATE_ONLY: ReadonlySet<BuildStageId> = new Set(['template']);
export function BuildGameDialog({ open, onOpenChange }: BuildGameDialogProps) {
    const session = useSessionTopic('project');
    const progress = useBuildProgress();
    const projectId = session.project.id;
    const projectName = projectRecordOf(session.project)?.name ?? 'Jogo';
    const [options, setOptions] = useState<BuildOptions>(() => loadBuildOptions(projectId, projectName));
    const [cached, setCached] = useState<ReadonlySet<BuildPlatformId>>(NO_PLATFORMS);
    const mine = gameCompiler.lastProjectId === projectId;
    const running = progress.status === 'running';
    const showProgress = running && mine;
    const showResult = progress.status === 'done' && mine && gameCompiler.result !== null;
    const failure = mine && (progress.status === 'failed' || progress.status === 'cancelled') ? gameCompiler.error : null;
    useEffect(() => {
        if (!open)
            return;
        setOptions(gameCompiler.lastOptions && gameCompiler.lastProjectId === projectId ? gameCompiler.lastOptions : loadBuildOptions(projectId, projectName));
    }, [open, projectId, projectName]);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        void Promise.all(BUILD_PLATFORMS.map(async (platform) => [platform.id, await isTemplateCached(platform)] as const)).then((entries) => {
            if (!cancelled)
                setCached(new Set(entries.filter(([, isCached]) => isCached).map(([id]) => id)));
        });
        return () => {
            cancelled = true;
        };
    }, [open, progress.status]);
    const patch = (changes: Partial<BuildOptions>) => setOptions((current) => ({ ...current, ...changes }));
    const run = () => {
        saveBuildOptions(projectId, options);
        gameCompiler.run(session, options).catch(() => {
        });
    };
    const platform = buildPlatformOf(options.platform);
    const predicted = predictStageSeconds(cached.has(platform.id) ? TEMPLATE_ONLY : undefined);
    const estimateSeconds = BUILD_STAGES.reduce((sum, stage) => sum + predicted[stage.id], 0);
    const canRun = options.gameName.trim().length > 0 && !running;
    const currentIndex = BUILD_STAGES.findIndex((stage) => stage.id === progress.stage);
    let footer: ReactNode;
    if (showProgress) {
        footer = (<>
        <span className="font-mono text-3xs text-muted-foreground tabular-nums">
          Etapa {Math.max(currentIndex + 1, 1)} de {BUILD_STAGES.length} · restam {formatEta(progress.etaSeconds)}
        </span>
        <Button size="xs" variant="outline" className="ml-auto" onClick={() => gameCompiler.cancel()}>
          <Ban aria-hidden/>
          Cancelar
        </Button>
      </>);
    }
    else if (showResult && gameCompiler.result) {
        footer = (<>
        <span className="truncate font-mono text-3xs text-muted-foreground">
          {gameCompiler.result.fileName} · {formatBuildBytes(gameCompiler.result.summary.totalBytes)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="xs" variant="outline" title="O navegador pode ter bloqueado o primeiro download." onClick={() => gameCompiler.downloadAgain()}>
            <Download aria-hidden/>
            Baixar de novo
          </Button>
          <Button size="xs" variant="secondary" onClick={() => gameCompiler.reset()}>
            <RotateCcw aria-hidden/>
            Compilar outra…
          </Button>
          <Button size="xs" onClick={() => onOpenChange(false)}>
            Concluído
          </Button>
        </div>
      </>);
    }
    else {
        footer = (<>
        <span className="text-3xs text-muted-foreground">
          Estimativa: {formatEta(estimateSeconds)}
          {cached.has(platform.id) ? ' · Helix Player no cache' : ` · inclui baixar o Helix Player (${formatBuildBytes(platform.templateBytes)}), só desta vez`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="xs" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button size="xs" disabled={!canRun} title={canRun ? `Gera ${platform.label.toLowerCase()} e baixa o zip.` : 'Dê um nome ao jogo para compilar.'} onClick={run}>
            <Package aria-hidden/>
            {failure ? 'Compilar de novo' : 'Compilar'}
          </Button>
        </div>
      </>);
    }
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Compilar jogo para computador" description="O jogo exatamente como no playtest, embrulhado no Helix Player para abrir sem navegador: sem o editor, sem compiladores e sem o lado do servidor. Tudo é compilado aqui, no seu navegador, e entregue como um zip pronto para a loja." action="helix.build" size="lg" dismissible={!running} footer={footer}>
      {showProgress ? (<BuildProgressView progress={progress} options={options}/>) : showResult && gameCompiler.result ? (<BuildResultView result={gameCompiler.result} options={options} log={progress.log}/>) : (<>
          {failure && (<div className="flex flex-col gap-2 border-b border-border px-5 py-4">
              <p className={cn('px-3 py-2 text-2xs leading-relaxed text-pretty', progress.status === 'failed' ? 'text-destructive' : 'text-muted-foreground', EMPTY_WELL_CLASS)} role={progress.status === 'failed' ? 'alert' : 'status'}>
                {progress.status === 'failed' ? `A compilação falhou: ${failure}` : failure}
              </p>
              {progress.log.length > 1 && (<details className="group">
                  <summary className="cursor-pointer text-3xs text-muted-foreground select-none hover:text-foreground">Ver o registro da tentativa</summary>
                  <BuildLog lines={progress.log} follow={false} className="mt-2"/>
                </details>)}
            </div>)}
          <BuildForm options={options} onChange={patch} cached={cached} disabled={running}/>
          <BuildContents />
        </>)}
    </EditorDialogShell>);
}
