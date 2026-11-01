'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
import type { Progress } from '@/engine/core/progress';
import { HelixLogo } from './helix-logo';
export const LOADING_SCREEN_EXIT_MS = 480;
export interface LoadingScreenError {
    title: string;
    message: string;
    actions?: ReactNode;
}
export interface LoadingScreenProps {
    title?: string;
    progress: Progress | null;
    done?: boolean;
    onExited?: () => void;
    error?: LoadingScreenError | null;
}
export function LoadingScreen({ title, progress, done = false, onExited, error = null }: LoadingScreenProps) {
    const [exiting, setExiting] = useState(false);
    const onExitedRef = useRef(onExited);
    onExitedRef.current = onExited;
    useEffect(() => {
        if (!done)
            return;
        setExiting(true);
        const timer = setTimeout(() => onExitedRef.current?.(), LOADING_SCREEN_EXIT_MS);
        return () => clearTimeout(timer);
    }, [done]);
    const percent = progress ? Math.round(Math.min(1, Math.max(0, progress.fraction)) * 100) : null;
    return (<div role="status" aria-live="polite" aria-busy={!done && !error} data-exiting={exiting || undefined} className={cn('fixed inset-0 z-50 flex flex-col bg-background text-foreground transition-opacity ease-out data-[exiting]:pointer-events-none data-[exiting]:opacity-0')} style={{ transitionDuration: `${LOADING_SCREEN_EXIT_MS}ms` }}>
      <div aria-hidden className="boot-grid pointer-events-none absolute inset-0"/>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-9 px-6">
        <HelixLogo size={96}/>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[22px] font-semibold tracking-[0.34em] text-foreground uppercase">Helix</span>
          <span className="text-2xs tracking-[0.42em] text-muted-foreground uppercase">Engine</span>
        </div>

        {error ? (<div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-overlay" role="alert">
            <p className="text-sm font-medium text-foreground text-balance">{error.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty">{error.message}</p>
            {error.actions && <div className="mt-4 flex flex-wrap gap-2">{error.actions}</div>}
          </div>) : (<div className="w-full max-w-72">
            <div className="h-1 w-full overflow-hidden rounded-xs border border-border bg-surface-sunken shadow-well">
              {progress ? (<div className="h-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }}/>) : (<div className="boot-indeterminate h-full w-1/3 bg-primary"/>)}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-4 font-mono text-2xs text-muted-foreground">
              <span className="truncate">{progress?.label ?? 'Carregando a engine'}</span>
              <span className="tabular-nums">{percent === null ? '' : `${percent}%`}</span>
            </div>
          </div>)}
      </div>

      <footer className="relative flex items-center justify-between gap-4 px-6 py-5 font-mono text-3xs tracking-wider text-muted-foreground uppercase">
        <span>Helix Engine {ENGINE_VERSION_LABEL}</span>
        {title && <span className="truncate normal-case tracking-normal">{title}</span>}
      </footer>
    </div>);
}
