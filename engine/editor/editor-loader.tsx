'use client';
import dynamic from 'next/dynamic';
function EditorSplash() {
    return (<div className="flex h-dvh w-full items-center justify-center bg-background text-muted-foreground" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden/>
        <span className="font-mono text-xs tracking-wide">Carregando o editor…</span>
      </div>
    </div>);
}
export const EditorLoader = dynamic(() => import('./editor-shell').then((module) => module.EditorShell), {
    ssr: false,
    loading: EditorSplash,
});
