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
export function relativePathOf(file: File): string {
    return file.webkitRelativePath || file.name;
}
export interface BundleEntry {
    file: File;
    path: string;
}
export class FileBundle {
    private readonly byPath = new Map<string, File>();
    private readonly byName = new Map<string, File>();
    private readonly pathByFile = new Map<File, string>();
    constructor(files: Iterable<File>, pathOf: (file: File) => string = relativePathOf) {
        for (const file of files) {
            const path = pathOf(file);
            const relative = normalizePath(path);
            this.byPath.set(relative, file);
            this.pathByFile.set(file, path);
            const name = baseName(relative);
            if (!this.byName.has(name))
                this.byName.set(name, file);
        }
    }
    static fromEntries(entries: Iterable<BundleEntry>): FileBundle {
        const paths = new Map<File, string>();
        const files: File[] = [];
        for (const { file, path } of entries) {
            paths.set(file, path);
            files.push(file);
        }
        return new FileBundle(files, (file) => paths.get(file) ?? file.name);
    }
    get files(): File[] {
        return Array.from(this.byPath.values());
    }
    get entries(): BundleEntry[] {
        return Array.from(this.pathByFile, ([file, path]) => ({ file, path }));
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
