type ImportRequestListener = (files: File[]) => void;
let listener: ImportRequestListener | null = null;
export function requestImport(files: File[]): void {
    if (files.length > 0)
        listener?.(files);
}
export function subscribeImportRequests(next: ImportRequestListener): () => void {
    listener = next;
    return () => {
        if (listener === next)
            listener = null;
    };
}
