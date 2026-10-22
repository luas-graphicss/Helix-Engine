import { FileBundle } from '@/engine/assets/import/file-bundle';
import { importModelFile, isModelFile } from '@/engine/assets/import/import-registry';
import { baseNameWithoutExtension, fileExtension, type ImportedScene } from '@/engine/assets/import/import-types';
import { ANIMATION_EXTENSION, ANIMATION_MIME_TYPE, animationFileName, looksLikeAnimationDocument, parseAnimationDocument, serializeAnimationDocument, type AnimationDocument, } from './animation-document';
import { animationDocumentsFromScene } from './animation-from-imported';
import { BVH_EXTENSION, parseBvh, writeBvh } from './bvh';
export type AnimationExportFormat = 'hxanim' | 'hxanim-readable' | 'bvh';
export interface AnimationExportFormatInfo {
    readonly id: AnimationExportFormat;
    readonly label: string;
    readonly description: string;
    readonly extension: string;
    readonly mimeType: string;
    readonly requiresSkeleton: boolean;
}
export const ANIMATION_EXPORT_FORMATS: readonly AnimationExportFormatInfo[] = [
    {
        id: 'hxanim',
        label: 'Helix Animation (.hxanim)',
        description: 'Formato nativo, compacto: tudo que o editor de animação conhece (trilhas, eventos, esqueleto, origem).',
        extension: ANIMATION_EXTENSION,
        mimeType: ANIMATION_MIME_TYPE,
        requiresSkeleton: false,
    },
    {
        id: 'hxanim-readable',
        label: 'Helix Animation legível (.hxanim)',
        description: 'O mesmo formato com os números em texto puro, para inspecionar ou editar à mão. Arquivo maior.',
        extension: ANIMATION_EXTENSION,
        mimeType: ANIMATION_MIME_TYPE,
        requiresSkeleton: false,
    },
    {
        id: 'bvh',
        label: 'Biovision BVH (.bvh)',
        description: 'Captura de movimento clássica, aceita por Blender, Maya, MotionBuilder e afins. Reamostra as trilhas em quadros regulares; precisa do esqueleto.',
        extension: BVH_EXTENSION,
        mimeType: 'text/plain',
        requiresSkeleton: true,
    },
];
export function animationExportFormatInfo(id: AnimationExportFormat): AnimationExportFormatInfo {
    const info = ANIMATION_EXPORT_FORMATS.find((candidate) => candidate.id === id);
    if (!info)
        throw new Error(`Formato de exportação desconhecido: ${id}.`);
    return info;
}
export interface ExportedAnimation {
    readonly fileName: string;
    readonly blob: Blob;
}
export function exportAnimation(document: AnimationDocument, format: AnimationExportFormat = 'hxanim'): ExportedAnimation {
    const info = animationExportFormatInfo(format);
    if (info.requiresSkeleton && !document.skeleton)
        throw new Error(`"${document.name}" não traz esqueleto; ${info.label} precisa dele.`);
    const text = format === 'bvh'
        ? writeBvh(document)
        : serializeAnimationDocument(document, { encoding: format === 'hxanim-readable' ? 'readable' : 'binary' });
    return { fileName: animationFileName(document.name, info.extension), blob: new Blob([text], { type: info.mimeType }) };
}
export function animationDocumentToFile(document: AnimationDocument): File {
    const exported = exportAnimation(document, 'hxanim');
    return new File([exported.blob], exported.fileName, { type: ANIMATION_MIME_TYPE });
}
export const STANDALONE_ANIMATION_EXTENSIONS: readonly string[] = [ANIMATION_EXTENSION, BVH_EXTENSION, 'json'];
export function isStandaloneAnimationFile(file: File | string): boolean {
    const name = typeof file === 'string' ? file : file.name;
    return STANDALONE_ANIMATION_EXTENSIONS.includes(fileExtension(name));
}
export function mayContainAnimation(file: File | string): boolean {
    return isStandaloneAnimationFile(file) || isModelFile(typeof file === 'string' ? new File([], file) : file);
}
export interface ReadAnimationsOptions {
    bundle?: FileBundle;
    scene?: ImportedScene;
    metersPerUnit?: number;
}
export interface ReadAnimationsResult {
    readonly documents: AnimationDocument[];
    readonly scene: ImportedScene | null;
    readonly warnings: string[];
}
export async function readAnimations(file: File, options: ReadAnimationsOptions = {}): Promise<ReadAnimationsResult> {
    const extension = fileExtension(file.name);
    const warnings: string[] = [];
    if (extension === ANIMATION_EXTENSION || extension === 'json') {
        const text = await file.text();
        if (!looksLikeAnimationDocument(text))
            throw new Error(`"${file.name}" não é um arquivo de animação Helix.`);
        const document = parseAnimationDocument(text);
        return { documents: [document.name ? document : { ...document, name: baseNameWithoutExtension(file.name) }], scene: null, warnings };
    }
    if (extension === BVH_EXTENSION) {
        const document = parseBvh(await file.text(), { name: baseNameWithoutExtension(file.name), sourceFile: file.name, metersPerUnit: options.metersPerUnit });
        return { documents: [document], scene: null, warnings };
    }
    if (isModelFile(file)) {
        const scene = options.scene ?? (await importModelFile(file, options.bundle ?? new FileBundle([file])));
        const documents = animationDocumentsFromScene(scene);
        if (documents.length === 0)
            warnings.push(`"${file.name}" não contém animações.`);
        return { documents, scene, warnings };
    }
    throw new Error(`"${file.name}": formato de animação não reconhecido (aceitos: .${ANIMATION_EXTENSION}, .bvh, GLB, glTF, FBX).`);
}
