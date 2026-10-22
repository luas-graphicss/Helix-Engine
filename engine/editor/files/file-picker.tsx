'use client';
import { useEffect, useRef } from 'react';
export interface FilePickerOptions {
    accept: string;
    multiple?: boolean;
}
type Opener = (options: FilePickerOptions) => Promise<File[]>;
let opener: Opener | null = null;
export function pickFiles(options: FilePickerOptions): Promise<File[]> {
    return opener ? opener(options) : Promise.resolve([]);
}
export function FilePickerHost() {
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingRef = useRef<((files: File[]) => void) | null>(null);
    const settle = (files: File[]) => {
        const resolve = pendingRef.current;
        pendingRef.current = null;
        resolve?.(files);
    };
    useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        opener = ({ accept, multiple = false }) => new Promise((resolve) => {
            pendingRef.current?.([]);
            pendingRef.current = resolve;
            input.accept = accept;
            input.multiple = multiple;
            input.click();
        });
        const onCancel = () => settle([]);
        input.addEventListener('cancel', onCancel);
        return () => {
            input.removeEventListener('cancel', onCancel);
            opener = null;
        };
    }, []);
    return (<input ref={inputRef} type="file" className="hidden" tabIndex={-1} aria-label="Arquivos a abrir" onChange={(event) => {
            const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
            event.currentTarget.value = '';
            settle(files);
        }}/>);
}
