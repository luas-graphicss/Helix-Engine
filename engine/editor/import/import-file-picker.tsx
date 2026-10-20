'use client';
import { useEffect, useRef } from 'react';
import { IMPORT_ACCEPT } from '@/engine/assets/import/import-registry';
import { requestImport } from './import-requests';
let openPicker: (() => void) | null = null;
export function openImportFilePicker(): void {
    openPicker?.();
}
export function ImportFilePicker() {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        openPicker = () => inputRef.current?.click();
        return () => {
            openPicker = null;
        };
    }, []);
    return (<input ref={inputRef} type="file" multiple accept={IMPORT_ACCEPT} className="hidden" tabIndex={-1} aria-label="Arquivos de modelo para importar" onChange={(event) => {
            const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
            event.currentTarget.value = '';
            requestImport(files);
        }}/>);
}
