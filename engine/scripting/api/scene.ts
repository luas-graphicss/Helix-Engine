import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat4 from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Quat } from '@/engine/core/math/quat';
import { Entity, type EntityKind, type EntityOptions } from '@/engine/core/scene/entity';
import { cloneEntity, entityPath, uniqueEntityName } from '@/engine/core/scene/entity-utils';
import { createMaterial } from '@/engine/core/scene/material';
import { createRigidBodySettings, colliderRequiresStatic, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { createCharacterSettings } from '@/engine/character/character-settings';
import { createCsgSettings, createCsgBrushSettings } from '@/engine/geometry/csg/csg-settings';
import { createAudioSourceSettings } from '@/engine/audio/world/audio-source-settings';
import { createAudioZoneSettings } from '@/engine/audio/world/audio-zone-settings';
import { createGuiSurfaceSettings } from '@/engine/gui/world/gui-surface-settings';
import { createVfxSettings } from '@/engine/vfx/vfx-settings';
import { createScriptSettings } from '@/engine/scripting/script-settings';
import { createPointLight, createDirectionalLight, createAmbientLight, createLocalLight, isLocalLight, LOCAL_LIGHT_TYPES, type LocalLightType } from '@/engine/core/scene/light';
import { getPrimitive, PRIMITIVES, type PrimitiveKind } from '@/engine/editor/primitives/primitive-catalog';
import { addEntity, deleteEntity } from '@/engine/editor/operations/entity-operations';
import { instantiateImportedScene, DEFAULT_IMPORT_OPTIONS } from '@/engine/editor/operations/import-operations';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, isJsonValue, requireEntity, requireFunction, requireJson, requireNumber, requireOneOf, requireString, toQuat, toVec3 } from '../runtime/values';
const ENTITY_KINDS: readonly EntityKind[] = ['group', 'mesh', 'light', 'camera', 'terrain', 'character', 'sound', 'gui', 'vfx', 'script'];
const COMPONENT_KINDS = ['mesh', 'material', 'light', 'rigidBody', 'character', 'csg', 'csgBrush', 'audioSource', 'audioZone', 'guiSurface', 'vfx', 'script'] as const;
type ComponentKind = (typeof COMPONENT_KINDS)[number];
const scratchParentInverse = mat4.create();
const scratchMatrix = mat4.create();
const scratchTranslation = vec3.create();
const scratchRotation = vec3.create();
const scratchScale = vec3.create();
const scratchQuat = quat.create();
const scratchVec = vec3.create();
export function createSceneApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    function world(): void {
        scene.updateWorldMatrices();
    }
    function resolveParent(parent: unknown, member: string): Entity {
        if (parent === undefined || parent === null)
            return scene.root;
        return requireEntity(parent, member, 'o pai');
    }
    function applyTransformOptions(entity: Entity, options: Record<string, unknown>, member: string): void {
        if (options.position !== undefined)
            toVec3(options.position, `${member}.position`, entity.transform.position);
        if (options.rotation !== undefined)
            toVec3(options.rotation, `${member}.rotation`, entity.transform.rotation);
        if (options.scale !== undefined) {
            if (typeof options.scale === 'number')
                vec3.set(entity.transform.scale, options.scale, options.scale, options.scale);
            else
                toVec3(options.scale, `${member}.scale`, entity.transform.scale);
        }
        if (options.visible !== undefined)
            entity.visible = Boolean(options.visible);
        if (Array.isArray(options.tags))
            for (const tag of options.tags)
                if (typeof tag === 'string')
                    entity.tags.add(tag);
        if (options.meta !== undefined)
            entity.meta = requireJson(options.meta, `${member}.meta`);
    }
    function componentSettings<T extends object>(create: () => T, patch: unknown, member: string, options?: Parameters<typeof assignSettings>[3]): T {
        const settings = create();
        if (patch !== null && typeof patch === 'object')
            assignSettings(settings as unknown as Record<string, unknown>, patch, member, options);
        return settings;
    }
    function rigidBodyFromPatch(patch: unknown, member: string): RigidBodySettings {
        const body = createRigidBodySettings();
        if (patch !== null && typeof patch === 'object') {
            const { layer, collidesWith, ...rest } = patch as Record<string, unknown>;
            assignSettings(body as unknown as Record<string, unknown>, rest, member);
            if (layer !== undefined && layer !== null)
                body.layer = requireString(layer, member, 'layer');
            if (collidesWith !== undefined && collidesWith !== null) {
                if (!Array.isArray(collidesWith) || collidesWith.some((name) => typeof name !== 'string'))
                    throw new HelixArgumentError(member, 'collidesWith precisa ser uma lista de nomes de camadas.');
                body.collidesWith = collidesWith.slice() as string[];
            }
        }
        if (colliderRequiresStatic(body.collider) && body.type !== 'static') {
            throw new HelixArgumentError(member, `o colisor "${body.collider}" exige um corpo estático (a mesma regra do inspetor).`);
        }
        return body;
    }
    function buildOptions(kind: EntityKind, options: Record<string, unknown>, member: string): Omit<EntityOptions, 'id'> {
        const name = typeof options.name === 'string' && options.name.trim() ? options.name.trim() : defaultNameFor(kind);
        const built: Omit<EntityOptions, 'id'> = { name: uniqueEntityName(scene, name), kind };
        const lenient = { allowUnknown: true };
        if (options.mesh !== undefined)
            built.mesh = options.mesh as MeshData;
        if (options.material !== undefined)
            built.material = options.material as EntityOptions['material'];
        if (options.light !== undefined)
            built.light = options.light as EntityOptions['light'];
        if (options.terrain !== undefined)
            built.terrain = options.terrain as EntityOptions['terrain'];
        if (options.rigidBody !== undefined)
            built.rigidBody = rigidBodyFromPatch(options.rigidBody, `${member}.rigidBody`);
        if (options.character !== undefined)
            built.character = componentSettings(createCharacterSettings, options.character, `${member}.character`, lenient);
        if (options.skin !== undefined)
            built.skin = options.skin as EntityOptions['skin'];
        if (options.rig !== undefined)
            built.rig = options.rig as EntityOptions['rig'];
        if (options.csg !== undefined)
            built.csg = options.csg as EntityOptions['csg'];
        if (options.csgBrush !== undefined)
            built.csgBrush = componentSettings(createCsgBrushSettings, options.csgBrush, `${member}.csgBrush`, lenient);
        if (options.audioSource !== undefined)
            built.audioSource = componentSettings(createAudioSourceSettings, options.audioSource, `${member}.audioSource`, lenient);
        if (options.audioZone !== undefined)
            built.audioZone = componentSettings(createAudioZoneSettings, options.audioZone, `${member}.audioZone`, lenient);
        if (options.guiSurface !== undefined)
            built.guiSurface = componentSettings(createGuiSurfaceSettings, options.guiSurface, `${member}.guiSurface`, lenient);
        if (options.vfx !== undefined)
            built.vfx = typeof options.vfx === 'string' ? createVfxSettings({ assetId: options.vfx }) : componentSettings(createVfxSettings, options.vfx, `${member}.vfx`, lenient);
        if (options.script !== undefined)
            built.script = createScriptSettings(options.script as object);
        if (options.castShadows !== undefined)
            built.castShadows = Boolean(options.castShadows);
        if (options.receiveShadows !== undefined)
            built.receiveShadows = Boolean(options.receiveShadows);
        if (options.locked !== undefined)
            built.locked = Boolean(options.locked);
        if (kind === 'mesh' && !built.mesh && typeof options.primitive === 'string') {
            built.mesh = getPrimitive(requireOneOf(options.primitive, PRIMITIVES.map((entry) => entry.kind), `${member}.primitive`)).create();
        }
        if (kind === 'mesh' && built.mesh && !built.material)
            built.material = createMaterial({ baseColor: vec3.create(0.7, 0.7, 0.7), roughness: 0.6 });
        if (kind === 'light' && !built.light) {
            const type = typeof options.type === 'string' ? options.type : 'point';
            built.light = type === 'directional' ? createDirectionalLight() : type === 'ambient' ? createAmbientLight() : (LOCAL_LIGHT_TYPES as readonly string[]).includes(type) ? createLocalLight(type as LocalLightType) : createPointLight();
        }
        if (kind === 'gui' && !built.guiSurface && typeof options.gui === 'string') {
            built.guiSurface = createGuiSurfaceSettings({ content: { kind: 'screen', assetId: options.gui } } as Parameters<typeof createGuiSurfaceSettings>[0]);
        }
        if (kind === 'vfx' && !built.vfx && typeof options.effect === 'string')
            built.vfx = createVfxSettings({ assetId: options.effect });
        if (kind === 'sound' && !built.audioSource && !built.audioZone && typeof options.audio === 'string')
            built.audioSource = createAudioSourceSettings({ assetId: options.audio });
        if (kind === 'script' && !built.script)
            built.script = createScriptSettings({ assetId: typeof options.asset === 'string' ? options.asset : null });
        if (kind === 'script') {
            built.castShadows = false;
            built.receiveShadows = false;
        }
        return built;
    }
    function spawn(kindValue: unknown, optionsValue?: unknown, parentValue?: unknown): Entity {
        const member = 'helix.scene.spawn';
        const kind = requireOneOf(kindValue, ENTITY_KINDS, member, 'o tipo do ator');
        const options = optionsValue === undefined || optionsValue === null ? {} : (optionsValue as Record<string, unknown>);
        if (typeof options !== 'object')
            throw new HelixArgumentError(member, 'as opções precisam ser um objeto.');
        const parent = resolveParent(parentValue ?? options.parent, member);
        const entity = scene.createEntity(buildOptions(kind, options, member), null);
        applyTransformOptions(entity, options, member);
        attach(entity, parent, undefined, `Criar ${entity.name}`);
        return entity;
    }
    function attach(entity: Entity, parent: Entity, index: number | undefined, label: string): void {
        if (host.mode === 'editor') {
            addEntity(session, entity, parent, label);
            if (index !== undefined)
                parent.insert(entity, index);
        }
        else {
            if (index === undefined)
                parent.add(entity);
            else
                parent.insert(entity, index);
            host.trackSpawned(entity);
        }
        host.requestActorSync();
        host.bus.emit('scene.spawned', entity);
        session.notify();
    }
    function destroy(value: unknown): void {
        const entity = requireEntity(value, 'helix.scene.destroy');
        if (entity === scene.root)
            throw new HelixError('helix.scene.destroy: a raiz da cena não pode ser destruída.');
        if (!entity.parent)
            return;
        host.destroyScriptsOf(entity);
        if (host.mode === 'editor') {
            deleteEntity(session, entity);
        }
        else {
            host.trackDestroyed(entity);
            entity.parent.remove(entity);
        }
        if (session.selectedEntity && entity.contains(session.selectedEntity))
            session.select(null);
        host.requestActorSync();
        host.bus.emit('scene.destroyed', entity);
        session.notify();
    }
    function find(name: unknown, from?: unknown): Entity | null {
        const wanted = requireString(name, 'helix.scene.find');
        const root = from === undefined ? scene.root : requireEntity(from, 'helix.scene.find', 'a raiz da busca');
        if (wanted.includes('/')) {
            let current: Entity | null = root;
            for (const part of wanted.split('/').map((entry) => entry.trim()).filter(Boolean)) {
                current = current?.children.find((child) => child.name === part) ?? null;
                if (!current)
                    return null;
            }
            return current === root ? null : current;
        }
        let found: Entity | null = null;
        scene.traverse((entity) => {
            if (!found && entity !== root && entity.name === wanted)
                found = entity;
        }, root);
        return found;
    }
    function findAll(name: unknown, from?: unknown): Entity[] {
        const wanted = requireString(name, 'helix.scene.findAll');
        const root = from === undefined ? scene.root : requireEntity(from, 'helix.scene.findAll', 'a raiz da busca');
        const list: Entity[] = [];
        scene.traverse((entity) => {
            if (entity !== root && entity.name === wanted)
                list.push(entity);
        }, root);
        return list;
    }
    function byKind(kind: unknown): Entity[] {
        const wanted = requireOneOf(kind, ENTITY_KINDS, 'helix.scene.byKind', 'o tipo');
        const list: Entity[] = [];
        scene.traverse((entity) => {
            if (entity.kind === wanted)
                list.push(entity);
        });
        return list;
    }
    function byTag(tag: unknown): Entity[] {
        const wanted = requireString(tag, 'helix.scene.byTag', 'a etiqueta');
        const list: Entity[] = [];
        scene.traverse((entity) => {
            if (entity.tags.has(wanted))
                list.push(entity);
        });
        return list;
    }
    function byId(id: unknown): Entity | null {
        return session.findById(requireNumber(id, 'helix.scene.byId', 'o id'));
    }
}
