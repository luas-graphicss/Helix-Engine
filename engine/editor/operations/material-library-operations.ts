import type { Entity } from '@/engine/core/scene/entity';
import { cloneMaterial, type Material } from '@/engine/core/scene/material';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { CompositeCommand } from '@/engine/editor/commands/composite-command';
import { resolveMap, type MaterialDocument, type MaterialMapKind } from '@/engine/materials/material-document';
import { extractChannel } from '@/engine/materials/map-packing';
import { applyPhysicalProperties } from '@/engine/materials/physical-material';
import { cloneRigidBodySettings, copyRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import type { TerrainMaterial } from '@/engine/terrain/materials/terrain-material';
import type { CustomMaterialMaps } from '@/engine/terrain/materials/terrain-material-library';
import { setEntityMaterial } from './material-operations';
import { addTerrainLayer } from './terrain-operations';
const LOG_SOURCE = 'Materiais';
export function applyLibraryMaterial(session: EditorSession, entity: Entity, document: MaterialDocument, withPhysics = true): boolean {
    if (!entity.mesh) {
        session.log.warn(LOG_SOURCE, `${entity.name} não tem malha para receber um material.`);
        return false;
    }
    const previousMaterial = entity.material;
    const body = entity.rigidBody;
    const previousBody = body ? cloneRigidBodySettings(body) : null;
    const nextBody = body && withPhysics ? applyPhysicalProperties(cloneRigidBodySettings(body), document.physics, entity.transform.scale) : null;
    if (previousMaterial === document.material && !nextBody)
        return true;
    session.history.execute(new CompositeCommand(`Aplicar ${document.name} a ${entity.name}`, () => {
        entity.material = document.material;
        if (body && nextBody)
            copyRigidBodySettings(body, nextBody);
    }, () => {
        entity.material = previousMaterial;
        if (body && previousBody)
            copyRigidBodySettings(body, previousBody);
    }));
    session.log.info(LOG_SOURCE, nextBody ? `${document.name} aplicado a ${entity.name} (massa ${nextBody.mass.toLocaleString('pt-BR')} kg).` : `${document.name} aplicado a ${entity.name}.`);
    return true;
}
export type MaterialTargetKind = 'mesh' | 'terrain' | null;
export function materialTargetKind(entity: Entity | null): MaterialTargetKind {
    if (!entity)
        return null;
    if (entity.terrain)
        return 'terrain';
    if (entity.mesh)
        return 'mesh';
    return null;
}
export function describeApplyTarget(entity: Entity | null): string {
    switch (materialTargetKind(entity)) {
        case 'terrain':
            return `Adicionar camada a ${entity!.name}`;
        case 'mesh':
            return `Aplicar a ${entity!.name}`;
        default:
            return 'Aplicar à seleção';
    }
}
export function applyLibraryMaterialToEntity(session: EditorSession, entity: Entity, document: MaterialDocument): boolean {
    switch (materialTargetKind(entity)) {
        case 'terrain':
            return addTerrainLayerFromDocument(session, entity, document);
        case 'mesh':
            return applyLibraryMaterial(session, entity, document);
        default:
            session.log.warn(LOG_SOURCE, `${entity.name} não tem malha nem terreno para receber um material.`);
            return false;
    }
}
export function applyLibraryMaterialToSelection(session: EditorSession, document: MaterialDocument): boolean {
    const entity = session.selectedEntity;
    if (!entity) {
        session.log.warn(LOG_SOURCE, 'Selecione um ator com malha ou um terreno para aplicar o material.');
        return false;
    }
    return applyLibraryMaterialToEntity(session, entity, document);
}
export function countMaterialUsers(session: EditorSession, document: MaterialDocument): number {
    let total = 0;
    session.scene.traverse((entity) => {
        if (entity.material === document.material)
            total++;
    });
    return total;
}
export function saveEntityMaterialToLibrary(session: EditorSession, entity: Entity): MaterialDocument | null {
    const material: Material | null = entity.material;
    if (!material)
        return null;
    const existing = session.materials.forMaterial(material);
    if (existing)
        return existing;
    const document = session.materials.createFromMaterial(material, material.name === 'Material' ? entity.name : material.name);
    applyLibraryMaterial(session, entity, document, false);
    session.log.info(LOG_SOURCE, `"${document.name}" salvo na biblioteca a partir de ${entity.name}.`);
    return document;
}
export function detachLibraryMaterial(session: EditorSession, entity: Entity): Material | null {
    const material = entity.material;
    if (!material || !material.libraryId)
        return null;
    const copy = cloneMaterial(material);
    copy.name = `${material.name} (local)`;
    setEntityMaterial(session, entity, copy);
    session.log.info(LOG_SOURCE, `${entity.name} agora usa uma cópia local de ${material.name}.`);
    return copy;
}
const terrainIdByDocument = new WeakMap<MaterialDocument, string>();
const documentIdByTerrainId = new Map<string, string>();
function documentTerrainMaps(document: MaterialDocument): CustomMaterialMaps {
    return {
        albedo: resolveMap(document, 'albedo'),
        normal: resolveMap(document, 'normal'),
        roughness: resolveMap(document, 'roughness'),
        occlusion: resolveMap(document, 'occlusion'),
        height: resolveMap(document, 'height'),
    };
}
export function terrainMaterialForDocument(session: EditorSession, document: MaterialDocument): TerrainMaterial {
    const existingId = terrainIdByDocument.get(document);
    const existing = existingId ? session.terrain.materials.get(existingId) : null;
    if (existing)
        return existing;
    const material = session.terrain.materials.createCustom(document.name, documentTerrainMaps(document));
    terrainIdByDocument.set(document, material.id);
    documentIdByTerrainId.set(material.id, document.id);
    return material;
}
export function isTerrainMaterialFromLibrary(terrainMaterialId: string): boolean {
    return documentIdByTerrainId.has(terrainMaterialId);
}
export function libraryDocumentForTerrainMaterial(session: EditorSession, terrainMaterialId: string): MaterialDocument | null {
    const documentId = documentIdByTerrainId.get(terrainMaterialId);
    return documentId ? session.materials.get(documentId) : null;
}
export function syncTerrainMaterialFromDocument(session: EditorSession, document: MaterialDocument): void {
    const id = terrainIdByDocument.get(document);
    if (!id || !session.terrain.materials.get(id))
        return;
    session.terrain.materials.updateCustomMaps(id, documentTerrainMaps(document));
    session.terrain.materials.renameCustom(id, document.name);
}
export function addTerrainLayerFromDocument(session: EditorSession, entity: Entity, document: MaterialDocument): boolean {
    const material = terrainMaterialForDocument(session, document);
    const layer = addTerrainLayer(session, entity, material.id);
    if (layer)
        session.log.info(LOG_SOURCE, `Camada "${layer.name}" criada com o material ${document.name}.`);
    return layer !== null;
}
const RESOLUTION_SUFFIX = /[_\-. ]?(\d+k|\d{3,4}(x\d{3,4})?)$/i;
const SLOT_PATTERNS: ReadonlyArray<readonly [
    MaterialMapKind | 'arm',
    RegExp
]> = [
    ['arm', /^(arm|orm|rma|occlusionroughnessmetallic)$/i],
    ['albedo', /^(albedo|alb|base[_-]?colou?r|basecolor|diffuse|diff|colou?r|col|d)$/i],
    ['normal', /^(normal(gl|dx|map)?|nrm|nor(_?gl|_?dx)?|norm|nmap|n)$/i],
    ['roughness', /^(roughness|rough|rgh|r)$/i],
    ['metallic', /^(metallic|metalness|metal|met|mtl|m)$/i],
    ['occlusion', /^(ambient[_-]?occlusion|occlusion|ao|occ)$/i],
    ['height', /^(height|displacement|disp|bump|hgt|depth|h)$/i],
    ['emissive', /^(emissive|emission|emit|glow|e)$/i],
];
interface ClassifiedFile {
    file: File;
    base: string;
    slot: MaterialMapKind | 'arm' | null;
}
function classifyFile(file: File): ClassifiedFile {
    let stem = file.name.replace(/\.[^.]+$/, '').replace(RESOLUTION_SUFFIX, '');
    const separator = Math.max(stem.lastIndexOf('_'), stem.lastIndexOf('-'), stem.lastIndexOf(' '), stem.lastIndexOf('.'));
    if (separator <= 0)
        return { file, base: stem, slot: null };
    const suffix = stem.slice(separator + 1);
    const match = SLOT_PATTERNS.find(([, pattern]) => pattern.test(suffix));
    if (!match)
        return { file, base: stem, slot: null };
    stem = stem.slice(0, separator).replace(RESOLUTION_SUFFIX, '');
    return { file, base: stem, slot: match[0] };
}
export interface PbrImportResult {
    created: MaterialDocument[];
    assigned: number;
    unrecognized: string[];
}
export async function importPbrFiles(session: EditorSession, files: File[], target: MaterialDocument | null = null): Promise<PbrImportResult> {
    const images = files.filter((file) => (file.type || mimeTypeFromFileName(file.name) || '').startsWith('image/'));
    const result: PbrImportResult = { created: [], assigned: 0, unrecognized: [] };
    if (images.length === 0) {
        session.log.warn(LOG_SOURCE, 'Nenhuma imagem reconhecida entre os arquivos.');
        return result;
    }
    const groups = new Map<string, ClassifiedFile[]>();
    for (const file of images) {
        const classified = classifyFile(file);
        const key = classified.base.toLowerCase();
        const group = groups.get(key) ?? [];
        group.push(classified);
        groups.set(key, group);
    }
    const useTarget = target !== null && groups.size === 1;
    for (const group of groups.values()) {
        const document = useTarget && target ? target : session.materials.create(group[0].base.replace(/[_-]+/g, ' ').trim() || 'Material');
        if (!useTarget)
            result.created.push(document);
        for (const entry of group) {
            const slot = entry.slot ?? (group.length === 1 ? 'albedo' : null);
            if (!slot) {
                result.unrecognized.push(entry.file.name);
                continue;
            }
            try {
                const mimeType = entry.file.type || mimeTypeFromFileName(entry.file.name);
                const image = await decodeImage(entry.file, mimeType);
                if (slot === 'arm') {
                    session.materials.setSource(document, 'occlusion', { image: extractChannel(image, 0), fileName: `${entry.file.name} · R`, mimeType: null, blob: null });
                    session.materials.setSource(document, 'roughness', { image: extractChannel(image, 1), fileName: `${entry.file.name} · G`, mimeType: null, blob: null });
                    session.materials.setSource(document, 'metallic', { image: extractChannel(image, 2), fileName: `${entry.file.name} · B`, mimeType: null, blob: null });
                    result.assigned += 3;
                }
                else {
                    session.materials.setSource(document, slot, { image, fileName: entry.file.name, mimeType, blob: entry.file });
                    result.assigned++;
                }
            }
            catch (cause) {
                session.log.error(LOG_SOURCE, `Não foi possível decodificar "${entry.file.name}": ${cause instanceof Error ? cause.message : String(cause)}`);
            }
        }
    }
    const where = useTarget && target ? `em ${target.name}` : `em ${result.created.length} ${result.created.length === 1 ? 'material' : 'materiais'}`;
    session.log.info(LOG_SOURCE, `${result.assigned} ${result.assigned === 1 ? 'mapa importado' : 'mapas importados'} ${where}.`);
    if (result.unrecognized.length > 0) {
        session.log.warn(LOG_SOURCE, `Sem slot reconhecido pelo nome: ${result.unrecognized.join(', ')}. Use os botões de cada mapa para vinculá-los.`);
    }
    return result;
}
