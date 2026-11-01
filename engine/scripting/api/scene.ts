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
    function addComponent(entityValue: unknown, kindValue: unknown, settings?: unknown): unknown {
        const member = 'helix.scene.addComponent';
        const entity = requireEntity(entityValue, member);
        const kind = requireOneOf(kindValue, COMPONENT_KINDS, member, 'o componente');
        const patch = settings === undefined ? {} : settings;
        switch (kind) {
            case 'mesh': {
                if (!settings)
                    throw new HelixArgumentError(member, 'mesh precisa dos dados da malha (helix.mesh.box(), helix.mesh.create(...)).');
                entity.mesh = settings as MeshData;
                if (!entity.material)
                    entity.material = createMaterial({ baseColor: vec3.create(0.7, 0.7, 0.7), roughness: 0.6 });
                break;
            }
            case 'material':
                entity.material = settings ? (settings as Entity['material']) : createMaterial();
                break;
            case 'light': {
                const options = patch as {
                    type?: string;
                };
                const type = options.type ?? 'point';
                entity.light = type === 'directional' ? createDirectionalLight() : type === 'ambient' ? createAmbientLight() : createLocalLight(requireOneOf(type, LOCAL_LIGHT_TYPES, member, 'o tipo da luz'));
                if (entity.light && settings)
                    assignSettings(entity.light as unknown as Record<string, unknown>, { ...(patch as object), type: undefined }, member, { allowUnknown: true, colors: new Set(['color', 'skyColor', 'groundColor']) });
                break;
            }
            case 'rigidBody':
                entity.rigidBody = rigidBodyFromPatch(settings ? patch : null, member);
                break;
            case 'character':
                entity.character = createCharacterSettings();
                if (settings)
                    assignSettings(entity.character as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'csg':
                if (!entity.mesh)
                    throw new HelixArgumentError(member, 'csg precisa de um ator com malha: o alvo guarda a malha original.');
                entity.csg = createCsgSettings(entity.mesh);
                if (settings)
                    assignSettings(entity.csg as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'csgBrush':
                if (!entity.parent?.csg)
                    throw new HelixArgumentError(member, 'um pincel CSG precisa ser filho de um alvo CSG (ator com o componente csg).');
                entity.csgBrush = createCsgBrushSettings();
                if (settings)
                    assignSettings(entity.csgBrush as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'audioSource':
                entity.audioSource = createAudioSourceSettings();
                if (settings)
                    assignSettings(entity.audioSource as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'audioZone':
                entity.audioZone = createAudioZoneSettings();
                if (settings)
                    assignSettings(entity.audioZone as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'guiSurface':
                entity.guiSurface = createGuiSurfaceSettings();
                if (settings)
                    assignSettings(entity.guiSurface as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'vfx':
                entity.vfx = createVfxSettings();
                if (settings)
                    assignSettings(entity.vfx as unknown as Record<string, unknown>, patch, member, { allowUnknown: true });
                break;
            case 'script':
                entity.script = createScriptSettings(patch as object);
                host.requestActorSync();
                break;
        }
        session.notify();
        return (entity as unknown as Record<string, unknown>)[kind];
    }
    function removeComponent(entityValue: unknown, kindValue: unknown): void {
        const member = 'helix.scene.removeComponent';
        const entity = requireEntity(entityValue, member);
        const kind = requireOneOf(kindValue, COMPONENT_KINDS, member, 'o componente');
        if (kind === 'script')
            host.destroyScriptsOf(entity);
        (entity as unknown as Record<string, unknown>)[kind] = null;
        if (kind === 'script')
            host.requestActorSync();
        session.notify();
    }
    async function instantiate(assetValue: unknown, options?: unknown): Promise<Entity> {
        const member = 'helix.scene.instantiate';
        const asset = host.resolveAsset(assetValue, member, 'model');
        const settings = (options ?? {}) as Record<string, unknown>;
        const imported = await session.library.loadModel(asset);
        const root = await instantiateImportedScene(session, imported, {
            ...DEFAULT_IMPORT_OPTIONS,
            rootName: typeof settings.name === 'string' ? settings.name : asset.name,
            placement: settings.position !== undefined ? 'target' : 'origin',
            placementPoint: settings.position !== undefined ? toVec3(settings.position, `${member}.position`) : null,
            frameAfterImport: false,
            saveToLibrary: false,
        });
        if (host.mode === 'play') {
            host.trackSpawned(root);
        }
        applyTransformOptions(root, settings, member);
        if (settings.parent instanceof Entity)
            settings.parent.add(root);
        host.requestActorSync();
        host.bus.emit('scene.spawned', root);
        return root;
    }
    const sceneApi = {
        get root() {
            return scene.root;
        },
        get sun() {
            return scene.findSunLight();
        },
        get activeCamera() {
            return host.cameraEntity();
        },
        find,
        findAll,
        byId,
        byKind,
        byTag,
        traverse: (visitor: unknown, from?: unknown) => {
            const fn = requireFunction<(entity: Entity) => void>(visitor, 'helix.scene.traverse', 'o visitante');
            scene.traverse(fn, from === undefined ? scene.root : requireEntity(from, 'helix.scene.traverse', 'a raiz'));
        },
        traverseVisible: (visitor: unknown, from?: unknown) => {
            const fn = requireFunction<(entity: Entity) => void>(visitor, 'helix.scene.traverseVisible', 'o visitante');
            scene.traverseVisible(fn, from === undefined ? scene.root : requireEntity(from, 'helix.scene.traverseVisible', 'a raiz'));
        },
        all: () => {
            const list: Entity[] = [];
            scene.traverse((entity) => {
                if (entity.parent)
                    list.push(entity);
            });
            return list;
        },
        count: () => session.countEntities(),
        spawn,
        spawnPrimitive: (kind: unknown, options?: unknown, parent?: unknown) => {
            const primitive = requireOneOf(kind, PRIMITIVES.map((entry) => entry.kind) as PrimitiveKind[], 'helix.scene.spawnPrimitive', 'a primitiva');
            const definition = getPrimitive(primitive);
            return spawn('mesh', { name: definition.label, ...(options as object), mesh: (options as {
                    mesh?: MeshData;
                } | undefined)?.mesh ?? definition.create() }, parent);
        },
        clone: (value: unknown, deep: unknown = true, parent?: unknown) => {
            const source = requireEntity(value, 'helix.scene.clone');
            const target = parent === undefined ? (source.parent ?? scene.root) : resolveParent(parent, 'helix.scene.clone');
            let copy: Entity;
            if (deep === false) {
                const shallow = cloneEntity(scene, source, null);
                for (const child of shallow.children.slice())
                    shallow.remove(child);
                copy = shallow;
            }
            else {
                copy = cloneEntity(scene, source, null);
            }
            copy.name = uniqueEntityName(scene, source.name);
            attach(copy, target, undefined, `Duplicar ${source.name}`);
            return copy;
        },
        destroy,
        reparent: (value: unknown, parentValue: unknown, index?: unknown) => {
            const entity = requireEntity(value, 'helix.scene.reparent');
            const parent = resolveParent(parentValue, 'helix.scene.reparent');
            if (entity === scene.root)
                throw new HelixError('helix.scene.reparent: a raiz não pode trocar de pai.');
            if (entity.contains(parent))
                throw new HelixError(`helix.scene.reparent: ${parent.name} está dentro de ${entity.name}; um ator não pode virar filho do próprio descendente.`);
            const previous = entity.parent;
            parent.insert(entity, index === undefined ? parent.children.length : requireNumber(index, 'helix.scene.reparent', 'a posição'));
            host.bus.emit('scene.reparented', { entity, oldParent: previous });
            session.notify();
        },
        insert: (parentValue: unknown, child: unknown, index: unknown) => {
            const parent = requireEntity(parentValue, 'helix.scene.insert', 'o pai');
            const entity = requireEntity(child, 'helix.scene.insert', 'o filho');
            parent.insert(entity, requireNumber(index, 'helix.scene.insert', 'a posição'));
            session.notify();
        },
        remove: (parentValue: unknown, child: unknown) => {
            const parent = requireEntity(parentValue, 'helix.scene.remove', 'o pai');
            const entity = requireEntity(child, 'helix.scene.remove', 'o filho');
            parent.remove(entity);
            session.notify();
        },
        contains: (ancestor: unknown, descendant: unknown) => requireEntity(ancestor, 'helix.scene.contains').contains(requireEntity(descendant, 'helix.scene.contains')),
        instantiate,
        addComponent,
        removeComponent,
        rename: (value: unknown, name: unknown) => {
            const entity = requireEntity(value, 'helix.scene.rename');
            entity.name = requireString(name, 'helix.scene.rename', 'o nome');
            host.bus.emit('scene.renamed', entity);
            session.notify();
        },
        setVisible: (value: unknown, visible: unknown) => {
            requireEntity(value, 'helix.scene.setVisible').visible = Boolean(visible);
            session.notify();
        },
        path: (value: unknown) => entityPath(requireEntity(value, 'helix.scene.path')),
        addTag: (value: unknown, tag: unknown) => {
            requireEntity(value, 'helix.scene.addTag').tags.add(requireString(tag, 'helix.scene.addTag', 'a etiqueta'));
        },
        removeTag: (value: unknown, tag: unknown) => requireEntity(value, 'helix.scene.removeTag').tags.delete(requireString(tag, 'helix.scene.removeTag', 'a etiqueta')),
        hasTag: (value: unknown, tag: unknown) => requireEntity(value, 'helix.scene.hasTag').tags.has(requireString(tag, 'helix.scene.hasTag', 'a etiqueta')),
        getMeta: (value: unknown, key: unknown) => requireEntity(value, 'helix.scene.getMeta').meta[requireString(key, 'helix.scene.getMeta', 'a chave')],
        setMeta: (value: unknown, key: unknown, data: unknown) => {
            const entity = requireEntity(value, 'helix.scene.setMeta');
            const name = requireString(key, 'helix.scene.setMeta', 'a chave');
            if (data === undefined) {
                delete entity.meta[name];
                return;
            }
            if (!isJsonValue(data))
                throw new HelixArgumentError('helix.scene.setMeta', 'o valor precisa ser serializável em JSON.');
            entity.meta[name] = data as Entity['meta'][string];
        },
        isAttached: (value: unknown) => {
            let current: Entity | null = requireEntity(value, 'helix.scene.isAttached');
            while (current.parent)
                current = current.parent;
            return current === scene.root;
        },
        saveAsPrefab: (value: unknown, name: unknown) => host.savePrefab(requireEntity(value, 'helix.scene.saveAsPrefab'), requireString(name, 'helix.scene.saveAsPrefab', 'o nome')),
        instantiatePrefab: async (asset: unknown, parent?: unknown) => {
            const member = 'helix.scene.instantiatePrefab';
            const target = parent === undefined ? scene.root : resolveParent(parent, member);
            const root = await host.instantiatePrefab(asset);
            attach(root, target, undefined, `Instanciar ${root.name}`);
            return root;
        },
        kinds: () => ENTITY_KINDS.slice(),
        components: () => COMPONENT_KINDS.slice(),
    };
    function worldPosition(entity: Entity, out = vec3.create()): Vec3 {
        world();
        return mat4.getTranslation(out, entity.worldMatrix);
    }
    function worldRotation(entity: Entity, out = quat.create()): Quat {
        world();
        return quat.fromMat4Rotation(out, entity.worldMatrix);
    }
    function worldScale(entity: Entity, out = vec3.create()): Vec3 {
        world();
        const m = entity.worldMatrix;
        return vec3.set(out, Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
    }
    function setWorldMatrix(entity: Entity, matrix: Float32Array): void {
        world();
        let local = matrix;
        if (entity.parent) {
            const inverse = mat4.invert(scratchParentInverse, entity.parent.worldMatrix);
            if (!inverse)
                throw new HelixError(`helix.transform: a matriz de mundo de ${entity.parent.name} não é invertível (escala zero?).`);
            local = mat4.multiply(scratchMatrix, inverse, matrix);
        }
        mat4.decomposeTranslationRotationScale(scratchTranslation, scratchRotation, scratchScale, local);
        vec3.copy(entity.transform.position, scratchTranslation);
        vec3.copy(entity.transform.rotation, scratchRotation);
        vec3.copy(entity.transform.scale, scratchScale);
        entity.worldMatrixStale = true;
    }
    function worldAxis(entity: Entity, column: 0 | 4 | 8, sign: number, out = vec3.create()): Vec3 {
        world();
        const m = entity.worldMatrix;
        return vec3.normalize(out, vec3.set(out, m[column] * sign, m[column + 1] * sign, m[column + 2] * sign));
    }
    function lookAt(entity: Entity, targetValue: unknown, upValue?: unknown): void {
        const target = toVec3(targetValue, 'helix.transform.lookAt');
        const up = upValue === undefined ? vec3.create(0, 1, 0) : toVec3(upValue, 'helix.transform.lookAt');
        const position = worldPosition(entity);
        const forward = vec3.subtract(vec3.create(), target, position);
        if (vec3.length(forward) < 1e-8)
            return;
        vec3.normalize(forward, forward);
        const right = vec3.cross(vec3.create(), up, forward);
        if (vec3.length(right) < 1e-6)
            vec3.cross(right, vec3.create(1, 0, 0), forward);
        vec3.normalize(right, right);
        const trueUp = vec3.cross(vec3.create(), forward, right);
        const scale = worldScale(entity);
        const m = mat4.identity(mat4.create());
        m[0] = right[0] * scale[0];
        m[1] = right[1] * scale[0];
        m[2] = right[2] * scale[0];
        m[4] = trueUp[0] * scale[1];
        m[5] = trueUp[1] * scale[1];
        m[6] = trueUp[2] * scale[1];
        m[8] = -forward[0] * scale[2];
        m[9] = -forward[1] * scale[2];
        m[10] = -forward[2] * scale[2];
        m[12] = position[0];
        m[13] = position[1];
        m[14] = position[2];
        setWorldMatrix(entity, m);
    }
    const transformApi = {
        position: (value: unknown) => requireEntity(value, 'helix.transform.position').transform.position,
        rotation: (value: unknown) => requireEntity(value, 'helix.transform.rotation').transform.rotation,
        scale: (value: unknown) => requireEntity(value, 'helix.transform.scale').transform.scale,
        setPosition: (value: unknown, position: unknown) => {
            toVec3(position, 'helix.transform.setPosition', requireEntity(value, 'helix.transform.setPosition').transform.position);
        },
        setRotation: (value: unknown, rotation: unknown) => {
            const entity = requireEntity(value, 'helix.transform.setRotation');
            const candidate = rotation as ArrayLike<number> | {
                w?: unknown;
            };
            if ((candidate as {
                w?: unknown;
            })?.w !== undefined || (ArrayBuffer.isView(rotation) && (rotation as Float32Array).length === 4) || (Array.isArray(rotation) && rotation.length === 4)) {
                quat.toEulerDegrees(entity.transform.rotation, toQuat(rotation, 'helix.transform.setRotation', scratchQuat));
            }
            else {
                toVec3(rotation, 'helix.transform.setRotation', entity.transform.rotation);
            }
        },
        setScale: (value: unknown, scale: unknown) => {
            const entity = requireEntity(value, 'helix.transform.setScale');
            if (typeof scale === 'number')
                vec3.set(entity.transform.scale, scale, scale, scale);
            else
                toVec3(scale, 'helix.transform.setScale', entity.transform.scale);
        },
        localMatrix: (value: unknown) => {
            const entity = requireEntity(value, 'helix.transform.localMatrix');
            entity.transform.updateLocalMatrix();
            return entity.transform.localMatrix;
        },
        worldMatrix: (value: unknown) => {
            world();
            return requireEntity(value, 'helix.transform.worldMatrix').worldMatrix;
        },
        updateLocalMatrix: (value: unknown) => requireEntity(value, 'helix.transform.updateLocalMatrix').transform.updateLocalMatrix(),
        worldPosition: (value: unknown) => worldPosition(requireEntity(value, 'helix.transform.worldPosition')),
        worldRotation: (value: unknown) => worldRotation(requireEntity(value, 'helix.transform.worldRotation')),
        worldRotationEuler: (value: unknown) => quat.toEulerDegrees(vec3.create(), worldRotation(requireEntity(value, 'helix.transform.worldRotationEuler'))),
        worldScale: (value: unknown) => worldScale(requireEntity(value, 'helix.transform.worldScale')),
        setWorldPosition: (value: unknown, position: unknown) => {
            const entity = requireEntity(value, 'helix.transform.setWorldPosition');
            const target = toVec3(position, 'helix.transform.setWorldPosition');
            world();
            if (!entity.parent) {
                vec3.copy(entity.transform.position, target);
                return;
            }
            const inverse = mat4.invert(scratchParentInverse, entity.parent.worldMatrix);
            if (!inverse)
                throw new HelixError('helix.transform.setWorldPosition: a matriz do pai não é invertível.');
            mat4.transformPoint(entity.transform.position, inverse, target);
            entity.worldMatrixStale = true;
        },
        setWorldRotation: (value: unknown, rotation: unknown) => {
            const entity = requireEntity(value, 'helix.transform.setWorldRotation');
            const q = (rotation as {
                w?: unknown;
            })?.w !== undefined || (ArrayBuffer.isView(rotation) && (rotation as Float32Array).length === 4) ? toQuat(rotation, 'helix.transform.setWorldRotation') : quat.fromEulerDegrees(quat.create(), toVec3(rotation, 'helix.transform.setWorldRotation'));
            const position = worldPosition(entity);
            const scale = worldScale(entity);
            const m = mat4.fromTranslationRotationScale(mat4.create(), position, quat.toEulerDegrees(vec3.create(), q), scale);
            setWorldMatrix(entity, m);
        },
        setWorldMatrix: (value: unknown, matrix: unknown) => {
            if (!(matrix instanceof Float32Array) || matrix.length !== 16)
                throw new HelixArgumentError('helix.transform.setWorldMatrix', 'esperava uma Mat4.');
            setWorldMatrix(requireEntity(value, 'helix.transform.setWorldMatrix'), matrix);
        },
        forward: (value: unknown) => worldAxis(requireEntity(value, 'helix.transform.forward'), 8, -1),
        back: (value: unknown) => worldAxis(requireEntity(value, 'helix.transform.back'), 8, 1),
        right: (value: unknown) => worldAxis(requireEntity(value, 'helix.transform.right'), 0, 1),
        left: (value: unknown) => worldAxis(requireEntity(value, 'helix.transform.left'), 0, -1),
        up: (value: unknown) => worldAxis(requireEntity(value, 'helix.transform.up'), 4, 1),
        down: (value: unknown) => worldAxis(requireEntity(value, 'helix.transform.down'), 4, -1),
        translate: (value: unknown, deltaValue: unknown, space: unknown = 'local') => {
            const entity = requireEntity(value, 'helix.transform.translate');
            const delta = toVec3(deltaValue, 'helix.transform.translate');
            const mode = requireOneOf(space, ['local', 'world'] as const, 'helix.transform.translate', 'o espaço');
            if (mode === 'local') {
                entity.transform.updateLocalMatrix();
                const rotated = quat.rotateVec3(scratchVec, quat.fromEulerDegrees(scratchQuat, entity.transform.rotation), delta);
                vec3.add(entity.transform.position, entity.transform.position, rotated);
                return;
            }
            world();
            if (!entity.parent) {
                vec3.add(entity.transform.position, entity.transform.position, delta);
                return;
            }
            const inverse = mat4.invert(scratchParentInverse, entity.parent.worldMatrix);
            if (!inverse)
                throw new HelixError('helix.transform.translate: a matriz do pai não é invertível.');
            const localDelta = mat4.transformDirection(scratchVec, inverse, delta);
            vec3.add(entity.transform.position, entity.transform.position, localDelta);
        },
        rotate: (value: unknown, eulerDelta: unknown, space: unknown = 'local') => {
            const entity = requireEntity(value, 'helix.transform.rotate');
            const delta = toVec3(eulerDelta, 'helix.transform.rotate');
            const mode = requireOneOf(space, ['local', 'world'] as const, 'helix.transform.rotate', 'o espaço');
            const current = quat.fromEulerDegrees(quat.create(), entity.transform.rotation);
            const change = quat.fromEulerDegrees(quat.create(), delta);
            const result = mode === 'local' ? quat.multiply(quat.create(), current, change) : quat.multiply(quat.create(), change, current);
            const expected = vec3.add(vec3.create(), entity.transform.rotation, delta);
            quat.toEulerDegreesNear(entity.transform.rotation, quat.normalize(result, result), expected);
        },
        rotateAround: (value: unknown, pointValue: unknown, axisValue: unknown, degrees: unknown) => {
            const entity = requireEntity(value, 'helix.transform.rotateAround');
            const point = toVec3(pointValue, 'helix.transform.rotateAround');
            const axis = vec3.normalize(vec3.create(), toVec3(axisValue, 'helix.transform.rotateAround'));
            const angle = (requireNumber(degrees, 'helix.transform.rotateAround', 'o ângulo') * Math.PI) / 180;
            const position = worldPosition(entity);
            const offset = vec3.subtract(vec3.create(), position, point);
            vec3.rotateAroundAxis(offset, offset, axis, angle);
            const rotation = quat.multiply(quat.create(), quat.fromAxisAngle(quat.create(), axis, angle), worldRotation(entity));
            const m = mat4.fromTranslationRotationScale(mat4.create(), vec3.add(offset, point, offset), quat.toEulerDegrees(vec3.create(), rotation), worldScale(entity));
            setWorldMatrix(entity, m);
        },
        lookAt: (value: unknown, target: unknown, up?: unknown) => lookAt(requireEntity(value, 'helix.transform.lookAt'), target instanceof Entity ? worldPosition(target) : target, up),
        setParentKeepWorld: (value: unknown, parentValue: unknown) => {
            const entity = requireEntity(value, 'helix.transform.setParentKeepWorld');
            const parent = resolveParent(parentValue, 'helix.transform.setParentKeepWorld');
            if (entity.contains(parent))
                throw new HelixError('helix.transform.setParentKeepWorld: o novo pai está dentro do ator.');
            world();
            const matrix = mat4.copy(mat4.create(), entity.worldMatrix);
            const previous = entity.parent;
            parent.add(entity);
            setWorldMatrix(entity, matrix);
            host.bus.emit('scene.reparented', { entity, oldParent: previous });
            session.notify();
        },
        localToWorld: (value: unknown, point: unknown) => {
            world();
            return mat4.transformPoint(vec3.create(), requireEntity(value, 'helix.transform.localToWorld').worldMatrix, toVec3(point, 'helix.transform.localToWorld'));
        },
        worldToLocal: (value: unknown, point: unknown) => {
            world();
            const inverse = mat4.invert(mat4.create(), requireEntity(value, 'helix.transform.worldToLocal').worldMatrix);
            if (!inverse)
                throw new HelixError('helix.transform.worldToLocal: a matriz de mundo não é invertível.');
            return mat4.transformPoint(vec3.create(), inverse, toVec3(point, 'helix.transform.worldToLocal'));
        },
        localToWorldDirection: (value: unknown, direction: unknown) => {
            world();
            return mat4.transformDirection(vec3.create(), requireEntity(value, 'helix.transform.localToWorldDirection').worldMatrix, toVec3(direction, 'helix.transform.localToWorldDirection'));
        },
        worldToLocalDirection: (value: unknown, direction: unknown) => {
            world();
            const inverse = mat4.invert(mat4.create(), requireEntity(value, 'helix.transform.worldToLocalDirection').worldMatrix);
            if (!inverse)
                throw new HelixError('helix.transform.worldToLocalDirection: a matriz de mundo não é invertível.');
            return mat4.transformDirection(vec3.create(), inverse, toVec3(direction, 'helix.transform.worldToLocalDirection'));
        },
        bounds: (value: unknown) => host.boundsOf(requireEntity(value, 'helix.transform.bounds')),
        distance: (a: unknown, b: unknown) => vec3.distance(worldPosition(requireEntity(a, 'helix.transform.distance')), b instanceof Entity ? worldPosition(b) : toVec3(b, 'helix.transform.distance')),
        directionTo: (a: unknown, b: unknown) => {
            const from = worldPosition(requireEntity(a, 'helix.transform.directionTo'));
            const to = b instanceof Entity ? worldPosition(b) : toVec3(b, 'helix.transform.directionTo');
            return vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), to, from));
        },
        reset: (value: unknown) => {
            const entity = requireEntity(value, 'helix.transform.reset');
            vec3.set(entity.transform.position, 0, 0, 0);
            vec3.set(entity.transform.rotation, 0, 0, 0);
            vec3.set(entity.transform.scale, 1, 1, 1);
        },
    };
    return { scene: sceneApi, transform: transformApi };
}
function defaultNameFor(kind: EntityKind): string {
    switch (kind) {
        case 'group':
            return 'Grupo';
        case 'mesh':
            return 'Malha';
        case 'light':
            return 'Luz';
        case 'camera':
            return 'Câmera';
        case 'terrain':
            return 'Terreno';
        case 'character':
            return 'Personagem';
        case 'sound':
            return 'Som';
        case 'gui':
            return 'Interface';
        case 'vfx':
            return 'Efeito';
        case 'script':
            return 'Script';
    }
}
export type SceneApi = ReturnType<typeof createSceneApi>['scene'];
export type TransformApi = ReturnType<typeof createSceneApi>['transform'];
export { isLocalLight };
export type { LibraryAsset };
