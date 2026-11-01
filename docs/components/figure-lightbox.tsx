'use client';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
interface FigureLightboxProps {
    readonly src: string;
    readonly alt: string;
    readonly children: ReactNode;
}
export function FigureLightbox({ src, alt, children }: FigureLightboxProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    function close(event: MouseEvent<HTMLDialogElement>) {
        if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === 'IMG')
            dialog.current?.close();
    }
    return (<>
      <button type="button" className="docs-figure-zoom" onClick={() => dialog.current?.showModal()} aria-label={`Ampliar: ${alt}`}>
        {children}
      </button>
      <dialog ref={dialog} className="docs-lightbox" onClick={close} aria-label={alt}>
        
        <img src={src} alt={alt} loading="lazy" decoding="async"/>
        <button type="button" className="docs-lightbox-close" onClick={() => dialog.current?.close()} aria-label="Fechar">
          <X className="size-4" aria-hidden/>
        </button>
      </dialog>
    </>);
}
