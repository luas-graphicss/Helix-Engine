'use client';
import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { isModelFile } from '@/engine/assets/import/import-registry';
import type { ImportedScene } from '@/engine/assets/import/import-types';
import { addFilesToLibrary } from '@/engine/editor/operations/asset-library-operations';
import { instantiateImportedScene, parseImportFiles, type ImportOptions, type ParsedImport } from '@/engine/editor/operations/import-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { subscribeImportRequests } from '../import-requests';
import { ImportDialog } from './import-dialog';
const LOG_SOURCE = 'Importação';
type HostState = {
    status: 'idle';
} | {
    status: 'parsing';
    fileNames: string[];
} | {
    status: 'ready';
    queue: ParsedImport[];
    index: number;
    files: File[];
};
export function ImportDialogHost() {
    const session = useEditorSession();
    const [state, setState] = useState<HostState>({ status: 'idle' });
    useEffect(() => subscribeImportRequests(async (files) => {
        setState((current) => (current.status === 'ready' ? current : { status: 'parsing', fileNames: files.map((file) => file.name) }));
        const parsed = await parseImportFiles(session, files);
        setState((current) => {
            if (current.status === 'ready') {
                return parsed.length > 0 ? { ...current, queue: [...current.queue, ...parsed], files: [...current.files, ...files] } : current;
            }
            return parsed.length > 0 ? { status: 'ready', queue: parsed, index: 0, files } : { status: 'idle' };
        });
    }), [session]);
    const advance = useCallback(() => {
        setState((current) => {
            if (current.status !== 'ready')
                return current;
            const index = current.index + 1;
            return index < current.queue.length ? { ...current, index } : { status: 'idle' };
        });
    }, []);
    const cancelAll = useCallback(() => {
        setState((current) => {
            if (current.status === 'ready') {
                const remaining = current.queue.length - current.index;
                session.log.info(LOG_SOURCE, `Importação cancelada (${remaining} ${remaining === 1 ? 'arquivo' : 'arquivos'} não ${remaining === 1 ? 'importado' : 'importados'}).`);
            }
            return { status: 'idle' };
        });
    }, [session]);
    const importCurrent = useCallback(async (scene: ImportedScene, options: ImportOptions, sourceFiles: File[]) => {
        try {
            await instantiateImportedScene(session, scene, options);
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Falha ao importar "${scene.sourceFile}": ${cause instanceof Error ? cause.message : String(cause)}`);
            return;
        }
        advance();
        if (options.saveToLibrary) {
            const model = sourceFiles.find(isModelFile);
            void addFilesToLibrary(session, sourceFiles, { parsedScenes: model ? new Map([[model, scene]]) : undefined });
        }
    }, [session, advance]);
    const reportPreviewError = useCallback((message: string) => session.log.error(LOG_SOURCE, `Falha na pré-visualização: ${message}`), [session]);
    if (state.status === 'parsing') {
        return (<Dialog open disablePointerDismissal onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false} className="w-auto max-w-sm gap-3 rounded-sm border border-border-strong bg-surface p-5 text-foreground" aria-busy>
          <div className="flex items-center gap-3">
            <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" aria-hidden/>
            <div className="flex min-w-0 flex-col">
              <DialogTitle className="text-xs font-semibold">Lendo {state.fileNames.length === 1 ? 'arquivo' : 'arquivos'}…</DialogTitle>
              <DialogDescription className="truncate font-mono text-2xs text-muted-foreground">{state.fileNames.join(', ')}</DialogDescription>
            </div>
          </div>
        </DialogContent>
      </Dialog>);
    }
    if (state.status !== 'ready')
        return null;
    const current = state.queue[state.index];
    return (<ImportDialog key={`${state.index}-${current.file.name}-${current.file.lastModified}`} parsed={current} companionFiles={state.files} position={{ index: state.index, total: state.queue.length }} onImport={importCurrent} onSkip={advance} onCancel={cancelAll} onPreviewError={reportPreviewError}/>);
}
