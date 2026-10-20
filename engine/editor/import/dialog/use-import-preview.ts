'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as aabb from '@/engine/core/math/aabb';
import { getTriangleCount } from '@/engine/renderer/geometry/mesh-data';
import type { MaterializeOptions } from '@/engine/assets/import/import-materializer';
import type { ImportedScene } from '@/engine/assets/import/import-types';
import { ImportPreviewModel } from '../preview/import-preview-model';
const REBUILD_DELAY_MS = 120;
export interface ImportPreviewState {
    model: ImportPreviewModel;
    building: boolean;
    dimensions: readonly [
        number,
        number,
        number
    ] | null;
    triangles: number;
    texturesVisible: boolean;
    setTexturesVisible: (visible: boolean) => void;
}
function materializeKey(options: MaterializeOptions): string {
    return JSON.stringify([
        options.scale,
        options.convertUnits,
        options.upAxis,
        options.normals,
        options.smoothingAngle,
        options.flipUvV,
        options.flipWinding,
        Array.from(options.excludedMeshes).sort((a, b) => a - b),
    ]);
}
export function useImportPreview(scene: ImportedScene, options: MaterializeOptions, revision: number, onError: (message: string) => void): ImportPreviewState {
    const model = useMemo(() => new ImportPreviewModel(), []);
    const [building, setBuilding] = useState(true);
    const [dimensions, setDimensions] = useState<readonly [
        number,
        number,
        number
    ] | null>(null);
    const [triangles, setTriangles] = useState(0);
    const [texturesVisible, setTexturesVisibleState] = useState(true);
    const latestBuild = useRef(0);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const key = materializeKey(options);
    useEffect(() => {
        const ticket = ++latestBuild.current;
        setBuilding(true);
        const timer = window.setTimeout(() => {
            model
                .rebuild(scene, optionsRef.current)
                .then((result) => {
                if (ticket !== latestBuild.current)
                    return;
                if (result) {
                    const { bounds } = model;
                    setDimensions(aabb.isEmpty(bounds) ? null : [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]);
                    setTriangles(result.meshes.reduce((sum, mesh) => sum + getTriangleCount(mesh.geometry), 0));
                }
                setBuilding(false);
            })
                .catch((cause: unknown) => {
                if (ticket !== latestBuild.current)
                    return;
                setBuilding(false);
                onErrorRef.current(cause instanceof Error ? cause.message : String(cause));
            });
        }, REBUILD_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [model, scene, key, revision]);
    useEffect(() => () => model.clear(), [model]);
    const setTexturesVisible = useCallback((visible: boolean) => {
        model.setTexturesVisible(visible);
        setTexturesVisibleState(visible);
    }, [model]);
    return { model, building, dimensions, triangles, texturesVisible, setTexturesVisible };
}
