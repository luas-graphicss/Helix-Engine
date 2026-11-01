'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
export type ToastTone = 'info' | 'success' | 'warning' | 'error';
export interface ToastOptions {
    message: string;
    tone?: ToastTone;
    action?: {
        label: string;
        onClick: () => void;
    };
    durationMs?: number;
}
type ActiveToast = ToastOptions & {
    id: number;
};
const DEFAULT_DURATION_MS = 6000;
const ICONS: Record<ToastTone, typeof Info> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };
const ICON_CLASS: Record<ToastTone, string> = { info: 'text-primary', success: 'text-success', warning: 'text-warning', error: 'text-destructive' };
const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);
export function HubToastProvider({ children }: {
    children: ReactNode;
}) {
    const [toast, setToast] = useState<ActiveToast | null>(null);
    const counter = useRef(0);
    const show = useCallback((options: ToastOptions) => {
        counter.current += 1;
        setToast({ ...options, id: counter.current });
    }, []);
    useEffect(() => {
        if (!toast)
            return;
        const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), toast.durationMs ?? DEFAULT_DURATION_MS);
        return () => clearTimeout(timer);
    }, [toast]);
    const tone = toast?.tone ?? 'info';
    const Icon = ICONS[tone];
    return (<ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-40 flex justify-end">
        {toast && (<div role="status" className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-sm bg-surface-overlay py-2 pr-2 pl-3 text-xs text-foreground shadow-overlay animate-in fade-in-0 slide-in-from-bottom-2">
            <Icon className={cn('size-4 shrink-0', ICON_CLASS[tone])} aria-hidden/>
            <span className="leading-snug text-pretty">{toast.message}</span>
            {toast.action && (<button type="button" className="shrink-0 rounded-sm px-2 py-1 font-medium text-primary transition-colors duration-100 hover:bg-highlight" onClick={() => {
                    toast.action?.onClick();
                    setToast(null);
                }}>
                {toast.action.label}
              </button>)}
            <button type="button" aria-label="Fechar aviso" className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground" onClick={() => setToast(null)}>
              <X className="size-3.5" aria-hidden/>
            </button>
          </div>)}
      </div>
    </ToastContext.Provider>);
}
export function useToast(): (options: ToastOptions) => void {
    const show = useContext(ToastContext);
    if (!show)
        throw new Error('useToast deve ser usado dentro de HubToastProvider.');
    return show;
}
