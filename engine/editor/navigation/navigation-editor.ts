import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { bakeSurface, type NavSurfaceReport } from '@/engine/navigation/scene/bake-surface';
import { stampSceneObstacles } from '@/engine/navigation/scene/stamp-scene-obstacles';
import type { NavSurfaceSettings } from '@/engine/navigation/surface/nav-surface-settings';
export const NAVIGATION_HELPER_MODES = ['all', 'selected', 'off'] as const;
export type NavigationHelperMode = (typeof NAVIGATION_HELPER_MODES)[number];
export const NAVIGATION_HELPER_MODE_LABEL: Record<NavigationHelperMode, string> = {
    all: 'Toda a navegação',
    selected: 'Só a seleção',
    off: 'Ocultos',
};
interface SurfacePreview {
    readonly report: NavSurfaceReport;
    readonly settings: NavSurfaceSettings;
}
const LOG_SOURCE = 'Navegação';
export class NavigationEditor {
    helpers: NavigationHelperMode = 'all';
    version = 0;
    private readonly previews = new Map<Entity, SurfacePreview>();
    constructor(private readonly session: EditorSession) { }
    setHelpers(mode: NavigationHelperMode): void {
        if (mode === this.helpers)
            return;
        this.helpers = mode;
        this.refresh();
    }
    previewOf(surface: Entity): NavSurfaceReport | null {
        return this.previews.get(surface)?.report ?? null;
    }
    isStale(surface: Entity): boolean {
        const preview = this.previews.get(surface);
        return preview !== undefined && preview.settings !== surface.navSurface;
    }
    bake(surface: Entity): void {
        const settings = surface.navSurface;
        if (!settings)
            return;
        const { scene, log } = this.session;
        scene.updateWorldMatrices();
        const report = bakeSurface(scene, surface, settings);
        if (report.mesh) {
            stampSceneObstacles(scene, report.mesh);
            log.info(LOG_SOURCE, `NavMesh de ${surface.name} gerado: ${report.mesh.polygons.count} polígonos, ${report.mesh.walkableArea.toFixed(0)} m² em ${report.milliseconds.toFixed(0)} ms.`);
        }
        else {
            log.warn(LOG_SOURCE, `${surface.name} não encontrou área caminhável; confira a geometria coletada, a rampa máxima e a altura do agente.`);
        }
        this.previews.set(surface, { report, settings });
        this.refresh();
    }
    clear(surface: Entity): void {
        if (this.previews.delete(surface))
            this.refresh();
    }
    previewMeshes(selection: ReadonlySet<number> | null): NavMesh[] {
        const { scene } = this.session;
        const meshes: NavMesh[] = [];
        for (const [surface, { report }] of this.previews) {
            if (!surface.navSurface || scene.findById(surface.id) !== surface) {
                this.previews.delete(surface);
                continue;
            }
            if (report.mesh && (selection === null || selection.has(surface.id)))
                meshes.push(report.mesh);
        }
        return meshes;
    }
    private refresh(): void {
        this.version++;
        this.session.notify('view');
    }
}
