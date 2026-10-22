export async function downloadBlob(blob: Blob, fileName: string, description = 'Arquivo'): Promise<boolean> {
    const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    const picker = (window as Window & {
        showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;
    if (picker && extension && window.self === window.top) {
        try {
            const handle = await picker.call(window, {
                suggestedName: fileName,
                types: [{ description, accept: { [blob.type || 'application/octet-stream']: [extension] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        }
        catch (cause) {
            if (cause instanceof DOMException && cause.name === 'AbortError')
                return false;
        }
    }
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.rel = 'noopener';
        anchor.click();
    }
    finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
}
