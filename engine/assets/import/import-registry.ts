import { FileBundle } from './file-bundle';
import { IGNORE_PROGRESS, type ImportProgressReporter } from './import-progress';
import { fileExtension, type ImportedScene, type ImportFormat } from './import-types';
import { importGltf, isGlb } from './gltf/gltf-importer';
import { importObj } from './obj/obj-importer';
import { importStl } from './stl/stl-importer';
import { importFbx } from './fbx/fbx-importer';
export interface ImportFormatInfo {
    format: ImportFormat;
    label: string;
    extensions: readonly string[];
    companions: readonly string[];
}
export const IMPORT_FORMATS: readonly ImportFormatInfo[] = [
    { format: 'glb', label: 'glTF binário', extensions: ['glb'], companions: [] },
    { format: 'gltf', label: 'glTF 2.0', extensions: ['gltf'], companions: ['bin', 'png', 'jpg', 'jpeg', 'webp'] },
    { format: 'obj', label: 'Wavefront OBJ', extensions: ['obj'], companions: ['mtl', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tga'] },
    { format: 'stl', label: 'STL', extensions: ['stl'], companions: [] },
    { format: 'fbx', label: 'Autodesk FBX', extensions: ['fbx'], companions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tga'] },
];
export const IMPORT_FORMAT_SUMMARY = 'glTF, GLB, OBJ, STL, FBX';
export function formatLabel(format: ImportFormat): string {
    return IMPORT_FORMATS.find((info) => info.format === format)?.label ?? format.toUpperCase();
}
export const IMPORT_ACCEPT = Array.from(new Set(IMPORT_FORMATS.flatMap((info) => [...info.extensions, ...info.companions]).map((extension) => `.${extension}`)))
    .concat('image/*')
    .join(',');
export function detectFormat(file: File): ImportFormat | null {
    const extension = fileExtension(file.name);
    return IMPORT_FORMATS.find((info) => info.extensions.includes(extension))?.format ?? null;
}
export function isModelFile(file: File): boolean {
    return detectFormat(file) !== null;
}
export function partitionImportFiles(files: Iterable<File>): {
    models: File[];
    bundle: FileBundle;
} {
    const list = Array.from(files);
    return { models: list.filter(isModelFile), bundle: new FileBundle(list) };
}
export async function importModelFile(file: File, bundle: FileBundle, progress: ImportProgressReporter = IGNORE_PROGRESS): Promise<ImportedScene> {
    const format = detectFormat(file);
    switch (format) {
        case 'glb':
        case 'gltf':
            return importGltf(file, bundle, progress);
        case 'obj':
            return importObj(file, bundle, progress);
        case 'stl':
            return importStl(file, progress);
        case 'fbx':
            return importFbx(file, bundle, progress);
        default: {
            const head = await file.slice(0, 12).arrayBuffer();
            if (isGlb(head))
                return importGltf(file, bundle, progress);
            throw new Error(`Formato não reconhecido: "${file.name}".`);
        }
    }
}
