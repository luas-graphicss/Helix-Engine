function normalizePath(path: string): string {
    let decoded = path;
    try {
        decoded = decodeURIComponent(path);
    }
    catch {
    }
    return decoded.replace(/\\/g, '/').replace(/^(\.\/)+/, '').toLowerCase();
}
function baseName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}
export class FileBundle {
    private readonly byPath = new Map<string, File>();
    private readonly byName = new Map<string, File>();
    constructor(files: Iterable<File>) {
        for (const file of files) {
            const relative = normalizePath(file.webkitRelativePath || file.name);
            this.byPath.set(relative, file);
            const name = baseName(relative);
            if (!this.byName.has(name))
                this.byName.set(name, file);
        }
    }
    get files(): File[] {
        return Array.from(this.byPath.values());
    }
    resolve(reference: string, fromPath = ''): File | null {
        if (!reference)
            return null;
        const normalized = normalizePath(reference);
        const fromDirectory = normalizePath(fromPath).replace(/[^/]*$/, '');
        const candidates = [fromDirectory + normalized, normalized, baseName(normalized)];
        for (const candidate of candidates) {
            const direct = this.byPath.get(candidate);
            if (direct)
                return direct;
        }
        return this.byName.get(baseName(normalized)) ?? null;
    }
}
export function isDataUri(uri: string): boolean {
    return /^data:/i.test(uri);
}
export async function dataUriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return response.blob();
}
