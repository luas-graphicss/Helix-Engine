'use client';
import { useCallback, useMemo, useState } from 'react';
import { FileBundle } from '@/engine/assets/import/file-bundle';
import { mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import { computeImportStats, type ImportedScene, type ImportedTexture, type ImportStats, type ImportUpAxis } from '@/engine/assets/import/import-types';
import { effectiveImportScale, resolveUpAxis } from '@/engine/assets/import/import-materializer';
import { DEFAULT_IMPORT_OPTIONS, type ImportOptions } from '@/engine/editor/operations/import-operations';
export type TextureStatus = 'embedded' | 'file' | 'missing';
export interface ImportDraft {
    scene: ImportedScene;
    options: ImportOptions;
    files: File[];
    revision: number;
    stats: ImportStats;
    effectiveScale: number;
    upAxis: ImportUpAxis;
    warnings: string[];
    updateOptions: (patch: Partial<ImportOptions>) => void;
    setMeshIncluded: (index: number, included: boolean) => void;
    setAllMeshesIncluded: (included: boolean) => void;
    bindTextureFile: (index: number, file: File) => void;
    setTexturePath: (index: number, path: string) => boolean;
    addCompanionFiles: (files: File[]) => number;
    setMaterialDoubleSided: (index: number, doubleSided: boolean) => void;
}
export function textureStatus(texture: ImportedTexture): TextureStatus {
    if (!texture.data)
        return 'missing';
    return texture.data instanceof File ? 'file' : 'embedded';
}
const MISSING_TEXTURE_WARNING = /^Textura não encontrada: "(.+)"\./;
function bindFile(texture: ImportedTexture, file: File): void {
    texture.data = file;
    texture.mimeType = file.type || mimeTypeFromFileName(file.name);
}
export function useImportDraft(scene: ImportedScene, initialFiles: File[]): ImportDraft {
    const [options, setOptions] = useState<ImportOptions>(() => ({ ...DEFAULT_IMPORT_OPTIONS, excludedMeshes: new Set<number>() }));
    const [bundleFiles, setBundleFiles] = useState(initialFiles);
    const [revision, setRevision] = useState(0);
    const bundle = useMemo(() => new FileBundle(bundleFiles), [bundleFiles]);
    const updateOptions = useCallback((patch: Partial<ImportOptions>) => setOptions((current) => ({ ...current, ...patch })), []);
    const setMeshIncluded = useCallback((index: number, included: boolean) => {
        setOptions((current) => {
            const excludedMeshes = new Set(current.excludedMeshes);
            if (included)
                excludedMeshes.delete(index);
            else
                excludedMeshes.add(index);
            return { ...current, excludedMeshes };
        });
    }, []);
    const setAllMeshesIncluded = useCallback((included: boolean) => {
        setOptions((current) => ({ ...current, excludedMeshes: included ? new Set<number>() : new Set(scene.meshes.map((_, index) => index)) }));
    }, [scene]);
    const bindTextureFile = useCallback((index: number, file: File) => {
        const texture = scene.textures[index];
        if (!texture)
            return;
        bindFile(texture, file);
        texture.sourcePath = file.name;
        setBundleFiles((current) => [...current, file]);
        setRevision((value) => value + 1);
    }, [scene]);
    const setTexturePath = useCallback((index: number, path: string) => {
        const texture = scene.textures[index];
        if (!texture)
            return false;
        texture.sourcePath = path;
        const file = bundle.resolve(path, scene.sourceFile);
        if (file)
            bindFile(texture, file);
        setRevision((value) => value + 1);
        return file !== null;
    }, [scene, bundle]);
    const addCompanionFiles = useCallback((files: File[]) => {
        const merged = new FileBundle([...bundleFiles, ...files]);
        let resolved = 0;
        for (const texture of scene.textures) {
            if (texture.data)
                continue;
            const file = merged.resolve(texture.sourcePath, scene.sourceFile);
            if (!file)
                continue;
            bindFile(texture, file);
            resolved++;
        }
        setBundleFiles((current) => [...current, ...files]);
        if (resolved > 0)
            setRevision((value) => value + 1);
        return resolved;
    }, [scene, bundleFiles]);
    const setMaterialDoubleSided = useCallback((index: number, doubleSided: boolean) => {
        const material = scene.materials[index];
        if (!material || material.doubleSided === doubleSided)
            return;
        material.doubleSided = doubleSided;
        setRevision((value) => value + 1);
    }, [scene]);
    const stats = useMemo(() => computeImportStats(scene), [scene, revision]);
    const warnings = useMemo(() => scene.warnings.filter((warning) => {
        const match = MISSING_TEXTURE_WARNING.exec(warning);
        if (!match)
            return true;
        return scene.textures.some((texture) => texture.sourcePath === match[1] && !texture.data);
    }), [scene, revision]);
    return {
        scene,
        options,
        files: bundleFiles,
        revision,
        stats,
        effectiveScale: effectiveImportScale(scene, options),
        upAxis: resolveUpAxis(scene, options),
        warnings,
        updateOptions,
        setMeshIncluded,
        setAllMeshesIncluded,
        bindTextureFile,
        setTexturePath,
        addCompanionFiles,
        setMaterialDoubleSided,
    };
}
