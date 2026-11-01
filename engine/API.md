# Helix Engine — API de scripting

Contrato que toda linguagem precisa cumprir antes de entrar no editor de código.

Este documento lista, área por área, **tudo** que um script pode ler, alterar, criar, destruir, ouvir e substituir na engine. A regra é uma só: **o usuário tem controle sobre tudo através do código.** Se existe no editor, existe na API. Se a engine não oferece algo do jeito que o jogo precisa, a API dá o caminho para fazer por cima do que existe ou do zero, desligando a parte da engine que atrapalha.

Uma linguagem só passa a `compiler: 'ready'` (ver `scripting/script-languages.ts`) depois de ligar cada item deste arquivo e passar na suíte de conformidade da seção 22. Antes disso ela fica `pending` ou `beta` e aparece assim no editor.

---

## 0. Como ler este documento

### 0.1 Legenda de estado

Cada membro traz um estado. Ele diz onde a implementação está hoje, não se o membro é opcional — **nenhum membro é opcional**.

| Estado | Significado |
| --- | --- |
| `engine` | Já existe no núcleo TypeScript (o módulo está indicado). A linguagem só precisa da ponte. |
| `expor` | A engine tem a mecânica por dentro, mas ainda não oferece uma superfície estável para scripts. A engine precisa expor antes (ou junto) da primeira linguagem. |
| `novo` | Não existe ainda em lugar nenhum. Entra na engine como parte do suporte a scripting. |

### 0.2 Convenção de nomes

O namespace raiz é `helix`. Cada área é um sub-namespace (`helix.scene`, `helix.physics`, …). Cada linguagem adapta ao próprio idioma mantendo os mesmos nomes e a mesma ordem de argumentos:

| Linguagem | Forma |
| --- | --- |
| Luau, Lua, JavaScript, TypeScript, Python, Ruby, PHP, Dart, GDScript | `helix.scene.spawn("mesh", { name = "Caixa" })` / `helix.scene.spawn("mesh", { name: "Caixa" })` |
| C#, Java, Kotlin, Swift, Haxe | `Helix.Scene.Spawn("mesh", new SpawnOptions { Name = "Caixa" })` |
| C, C++, Rust, Zig, Go | `helix_scene_spawn(HELIX_MESH, &options)` / `helix::scene::spawn(Kind::Mesh, options)` |
| GLSL, WGSL | Só as seções 8.6 e 14.6 (uniformes e ganchos de shader). |
| HTML, CSS, SVG | Só a seção 11 (GUI declarativa) e 16 (ativos). |
| JSON, YAML, TOML, XML, Markdown | Só a seção 16 (dados carregados como ativos) e 17 (documentos). |
| WAT, Shell | WAT é alvo de compilação (seção 21); Shell só roda em `editor` (seção 19). |

Assinaturas abaixo estão numa pseudo-notação neutra: `nome(arg: Tipo, opcional?: Tipo = padrão): Retorno`. `Vec3` é `{x, y, z}`; `Quat` é `{x, y, z, w}`; ângulos em graus salvo quando dito o contrário; distâncias em metros; tempo em segundos; cores em `Vec3` linear 0..1 (ou `string` CSS na GUI).

### 0.3 Os cinco princípios

1. **Paridade total.** Cada propriedade do inspetor, cada botão do editor e cada ferramenta tem um equivalente na API. Quando algo novo entrar no editor, entra aqui no mesmo commit.
2. **Mesmo modelo de dados.** Scripts veem o mesmo `Entity` + componentes que o editor e o arquivo `.helix`. Não há "objeto de script" paralelo.
3. **Três níveis em todo sistema** (seção 20): ajustar os valores que existem; **enganchar** antes/depois do que a engine faz; **desligar e substituir** com acesso bruto (WebGL2, `AudioContext`, canvas 2D, buffers).
4. **Determinismo onde importa.** Física e VFX com `seed`; `fixedUpdate` com passo fixo; ordem de execução de scripts estável e visível.
5. **Falhar alto, nunca em silêncio.** Erros de script vão ao console com arquivo e linha; a engine continua rodando; nada é engolido.

---

## 1. Núcleo do runtime — `helix`

Ponte: `scripting/`, `editor/playtest/playtest-controller.ts`.

### 1.1 Ciclo de vida do script

Funções que o script define e a engine chama. Todas opcionais para o script; todas obrigatórias para a linguagem.

- `onLoad()` — compilado e ligado ao ator, antes da cena começar. `novo`
- `onStart()` — primeiro frame em que o ator está ativo. `novo`
- `onUpdate(dt: number)` — todo frame, antes do render. `novo`
- `onFixedUpdate(h: number)` — a cada passo de física (`PhysicsSettings.fixedTimestep`), pode rodar 0..N vezes por frame. `novo`
- `onLateUpdate(dt: number)` — depois de física, animação e câmera, antes do render. `novo`
- `onRender(frame: FrameInfo)` — depois do frame desenhado (overlays, debug). `novo`
- `onEnable()` / `onDisable()` — `ScriptSettings.enabled` ou `Entity.visible` mudaram. `novo`
- `onStop()` — o jogo parou (voltou ao editor). `novo`
- `onDestroy()` — o ator foi removido. `novo`
- `onHotReload(previousState: any)` — o arquivo foi salvo com o jogo rodando; recebe o estado devolvido por `onBeforeHotReload(): any`. `novo`

### 1.2 Contexto de execução

- `helix.context: 'shared' | 'client' | 'server'` — do `ScriptDocument.runContext` (`scripting/script-document.ts`). `engine`
- `helix.isEditor: boolean` — rodando dentro do editor (fora do play). `novo`
- `helix.isPlaying: boolean` — `PlaytestController.state === 'playing'`. `engine`
- `helix.engine.name`, `helix.engine.version` — `core/engine-info.ts`. `engine`
- `helix.self: Entity` — o ator que carrega este script (`null` no script de entrada). `novo`
- `helix.script: ScriptHandle` — `assetId`, `name`, `language`, `enabled`, `enable()`, `disable()`. `novo`

### 1.3 Tempo e agendamento — `helix.time`

- `now: number` — segundos desde o início do jogo. `expor`
- `delta: number`, `fixedDelta: number`, `unscaledDelta: number` `expor`
- `scale: number` — `PlaytestController.setTimeScale`. `engine`
- `frame: number` `expor`
- `realtime: number` — relógio de parede. `novo`
- `wait(seconds): Promise/yield`, `waitFrames(n)`, `delay(seconds, fn): Cancel`, `every(seconds, fn): Cancel`, `nextFrame(fn)` `novo`
- Corrotinas/tarefas: `helix.task.spawn(fn)`, `task.cancel(handle)`, `task.all([...])` — cada linguagem mapeia ao seu idioma (coroutine, async/await, goroutine, Future). `novo`

### 1.4 Console e diagnóstico — `helix.log`

- `info(source, message)`, `warn(...)`, `error(...)`, `debug(...)` — vai ao painel Console (`EditorSession.log`). `engine`
- `assert(condition, message?)` `novo`
- `trace()` — pilha mapeada ao arquivo e linha do script (seção 21.4). `novo`
- `helix.debug.line(a, b, color?, seconds?)`, `debug.sphere(center, radius, ...)`, `debug.box(aabb, ...)`, `debug.text(position, text, ...)` — desenham no overlay de linhas (`renderer/gl/line-batch.ts`). `expor`

### 1.5 Eventos — `helix.events`

Barramento global tipado; é o que liga scripts entre si e aos sistemas.

- `on(name, handler): Unsubscribe`, `once(name, handler)`, `off(name, handler)`, `emit(name, payload)` `novo`
- `onEntity(entity, name, handler)` — eventos com escopo de ator. `novo`
- Eventos emitidos pela engine (todos listados nas suas seções): `scene.spawned`, `scene.destroyed`, `physics.collisionBegin`, `gui.activate`, `audio.ended`, `animation.event`, `vfx.finished`, `input.keyDown`, `play.started`, `play.stopped`… `novo`

### 1.6 Matemática — `helix.math`

Ponte direta de `core/math/*` e `core/noise/*`. Cada linguagem entrega tipos nativos ou wrappers com **os mesmos nomes**.

- `vec3`: `create, add, sub, scale, dot, cross, length, normalize, lerp, distance, transformMat4, transformQuat, min, max, equals` `engine`
- `quat`: `create, identity, fromEuler, toEuler, multiply, slerp, rotateVec3, fromAxisAngle, lookRotation` `engine`
- `mat4`, `mat3`: `identity, multiply, invert, compose, decompose, fromTRS, transformPoint, transformDirection, perspective, lookAt` `engine`
- `aabb`: `create, fromPoints, contains, intersects, expand, center, size` `engine`
- `ray`: `create, at(t), fromScreen (seção 6)` `engine`
- `scalar`: `clamp, lerp, inverseLerp, remap, smoothstep, damp, wrap, degToRad, radToDeg` `engine`
- `noise`: `perlin2/3, value2/3, worley2/3, fbm` (`core/noise/*`) `engine`
- `color`: `srgbToLinear, linearToSrgb, hexToVec3, vec3ToHex, temperatureToColor` (`core/color/srgb.ts`, `core/scene/light.ts`) `engine`
- `random`: `seed(n)`, `value()`, `range(min, max)`, `int(min, max)`, `pick(list)`, `shuffle(list)`, `gaussian()`, `unitVector()` — determinístico por semente. `novo`

### 1.7 Propriedades expostas — `helix.props`

Variáveis do script que aparecem no inspetor (seção de script) e são salvas no `.helix`.

- Declaração por linguagem (decorator, atributo, comentário anotado ou `helix.props.define({...})`), com tipos `number | boolean | string | Vec3 | color | Entity | Asset<kind> | enum | range`. `novo`
- `get(name)`, `set(name, value)`, `onChanged(name, handler)` `novo`
- Valores por instância persistidos em `ScriptSettings` (`scripting/script-settings.ts`, hoje só `assetId` e `enabled`). `expor`

### 1.8 Módulos e script de entrada

- `require("Caminho/Do/Script")` / `import` — resolve pelo nome do ativo na biblioteca, por `assetId`, ou pelo caminho de pasta; cache por documento; ciclos detectados com erro claro. `novo`
- Script de entrada do jogo: `ScriptingSettings.entryScriptId` (`scripting/scripting-settings.ts`) roda antes de qualquer `onStart`. `engine`
- Linguagem base: `ScriptingSettings.baseLanguage`. A mesclagem de linguagens é um recurso da engine ligado em Helix ▸ Funcionalidades beta (`settings/beta-features.ts`, `MIX_LANGUAGES_FEATURE`), não uma propriedade do jogo; em jogos mesclados, `require` atravessa linguagens por uma ABI comum (seção 21.3). `engine`
- Ordem de execução: por padrão a ordem da hierarquia; `helix.props.executionOrder` sobrescreve. `novo`

---

## 2. Cena e atores — `helix.scene`

Ponte: `core/scene/scene.ts`, `core/scene/entity.ts`, `core/scene/entity-utils.ts`, `editor/commands/entity-commands.ts`.

### 2.1 Consulta

- `root: Entity` `engine`
- `find(name): Entity | null` — primeiro pela hierarquia; `findAll(name)`. `engine` (`entity-utils`)
- `byId(id: number): Entity | null` `expor`
- `byKind(kind: EntityKind): Entity[]` `expor`
- `byTag(tag): Entity[]` — tags em `Entity` (seção 2.4). `novo`
- `traverse(visitor, from?)`, `traverseVisible(visitor, from?)` `engine`
- `count(): number` `engine` (`EditorSession.countEntities`)
- `sun: Entity | null` — `Scene.findSunLight()`. `engine`
- `activeCamera: Entity | null` (seção 6). `expor`

### 2.2 Criação, destruição e hierarquia

- `spawn(kind: EntityKind, options?: SpawnOptions, parent?: Entity = root): Entity` — `Scene.createEntity`. Kinds: `group | mesh | light | camera | terrain | character | sound | gui | vfx | script`. `engine`
  - `SpawnOptions` espelha `EntityOptions`: `name, mesh, material, light, terrain, rigidBody, character, skin, rig, csg, csgBrush, audioSource, audioZone, guiSurface, vfx, script, castShadows, receiveShadows, locked, position, rotation, scale`.
- `clone(entity, deep = true, parent?): Entity` `engine` (`entity-commands` duplicar)
- `destroy(entity)` `engine`
- `reparent(entity, newParent, index?)`, `insert(child, index)`, `remove(child)` `engine`
- `contains(ancestor, descendant)` `engine`
- `instantiate(asset: ModelAsset, options?)` — modelo da biblioteca vira sub-hierarquia (malhas, materiais, rig, animações). `engine` (`editor/operations` import)
- Eventos: `scene.spawned(entity)`, `scene.destroyed(entity)`, `scene.reparented(entity, oldParent)`, `scene.renamed(entity)`. `novo`

### 2.3 Campos do ator

Leitura e escrita de todos os campos de `Entity`:

- `id` (só leitura), `name`, `kind` (só leitura), `parent`, `children` `engine`
- `visible`, `locked`, `castShadows`, `receiveShadows` `engine`
- Componentes (cada um `null` ou o objeto da sua seção): `mesh (3)`, `material (4)`, `light (5)`, `terrain (10)`, `rigidBody (9)`, `character (13)`, `skin/rig (13)`, `csg/csgBrush (3.4)`, `audioSource/audioZone (12)`, `guiSurface (11.8)`, `vfx (14)`, `script (1.2)` `engine`
- `addComponent(entity, kind, settings?)`, `removeComponent(entity, kind)` — equivalentes aos botões "Adicionar"/"Remover" do inspetor; validações iguais às do editor (ex.: `colliderRequiresStatic`). `expor`
- `worldMatrix` (só leitura), `worldMatrixStale` `engine`

### 2.4 Tags e metadados

- `tags: Set<string>` — `addTag, removeTag, hasTag`; persistidas no `.helix`. `novo`
- `meta: Record<string, JsonValue>` — dados livres por ator, persistidos. `novo`

### 2.5 Transform — `helix.transform` (ou `entity.transform`)

Ponte: `core/scene/transform.ts`.

- `position: Vec3`, `rotation: Vec3` (Euler, graus), `scale: Vec3` — local. `engine`
- `localMatrix`, `updateLocalMatrix()` `engine`
- `worldPosition`, `worldRotation: Quat`, `worldScale` — leitura; escrita recalcula o local a partir do pai. `expor`
- `forward`, `right`, `up` (mundo) `expor`
- `translate(delta, space = 'local' | 'world')`, `rotate(eulerDelta, space)`, `lookAt(target, up?)`, `setParentKeepWorld(parent)` `expor`
- `localToWorld(point)`, `worldToLocal(point)`, `localToWorldDirection(dir)` `expor`
- `bounds(): Aabb` — mundo, usando `renderer/culling/renderable-bounds.ts`. `expor`
- Suavização: `helix.math.scalar.damp` + `vec3.lerp` (nada especial na engine). `engine`

---

## 3. Primitivas, malhas e geometria — `helix.mesh`

Ponte: `renderer/geometry/primitives.ts`, `renderer/geometry/mesh-data.ts`, `renderer/geometry/mesh-transform.ts`, `renderer/geometry/mesh-raycast.ts`, `renderer/geometry/bounds.ts`.

### 3.1 Primitivas

Todas devolvem `MeshData`; `spawn('mesh', { mesh })` coloca na cena.

- `box(width = 1, height = 1, depth = 1, uvTileSize?)` `engine`
- `roundedBox(width, height, depth, radius = 0.1)` `engine`
- `plane(width = 1, depth = 1, segments = 1)` `engine`
- `sphere(radius = 0.5, widthSegments = 32, heightSegments = 16)` `engine`
- `cylinder(radius = 0.5, height = 1, radialSegments = 32)` `engine`
- `cone(radius = 0.5, height = 1, radialSegments = 32)` `engine`
- `torus(radius = 0.5, tube = 0.2, radialSegments = 48, tubularSegments = 24)` `engine`
- `capsule(radius = 0.25, height = 0.5, radialSegments = 32, capSegments = 8)` `engine`
- Atalho: `helix.scene.spawnPrimitive('box' | 'sphere' | ..., options)` — igual ao menu Adicionar do editor (`editor/primitives`). `engine`

### 3.2 Malha procedural

- `create({ positions: Float32Array, normals?, uvs?, indices?, tangents? }): MeshData` `engine`
- `positions, normals, uvs, indices` — leitura e escrita; `markDirty()` reenvia à GPU (`gpu-mesh-cache`). `expor`
- `computeNormals()`, `computeBounds()`, `flipWinding()`, `merge(a, b)`, `transform(mesh, mat4)` `engine`
- `raycast(ray, mesh, maxDistance?): number | null` `engine` (`raycastMesh`)
- `fromModelAsset(asset, nodeName?)` `engine`
- `toModelAsset(mesh, name): Promise<LibraryAsset>` — grava a malha como modelo da biblioteca: vira `.obj` (`assets/export/obj-exporter.ts`) e segue o caminho de um modelo importado (miniatura, detalhes, deduplicação por conteúdo, desfazer). `engine`
- `simplify(mesh, ratio)` — `renderer/lod/mesh-simplifier.ts`. `expor`

### 3.3 LOD e geometria virtual (Myriad)

- Por malha: `lod: { enabled, levels?, bias }` (`renderer/lod/lod-system.ts`), `myriad: boolean` (opt-in/opt-out por ator). `expor`
- Global: seção 8.3.

### 3.4 CSG (operações booleanas)

Ponte: `geometry/csg/csg-settings.ts`, `geometry/csg/csg-system.ts`.

- Alvo: `entity.csg = { live, precision: 'fast' | 'exact', showBrushes }`; `sourceMesh` só leitura. `engine`
- Pincel (filho do alvo): `entity.csgBrush = { operation: 'subtract' | 'union' | 'intersect', enabled }`; formas `box | cylinder | sphere | capsule | cone | torus`. `engine`
- `helix.csg.rebuild(entity)`, `invalidate(entity)`, `stats(entity): { triangles, brushes, ms }`, `onRebuilt(handler)`, `collectBrushes(target)`, `brushTarget(brush)` `engine`
- `helix.csg.boolean(a: MeshData, b: MeshData, op): MeshData` — direto, sem atores. `engine` (`csg-boolean`)

---

## 4. Materiais e texturas — `helix.material`, `helix.texture`

Ponte: `core/scene/material.ts`, `core/scene/texture.ts`, `materials/*`, `assets/texture-packing.ts`.

### 4.1 Material

- Campos: `name, baseColor, opacity, roughness, metallic, emissive, emissiveIntensity, alphaMode: 'opaque' | 'mask' | 'blend', alphaCutoff, doubleSided, baseColorMap, metallicRoughnessMap, normalMap, normalScale, occlusionMap, occlusionStrength, emissiveMap, uvTiling, libraryId` `engine`
- `create(options?)`, `clone(material)`, `copy(target, source)`, `hasAnyTexture(material)` `engine`
- `entity.material = material` — compartilhar entre atores é compartilhar a instância. `engine`
- Biblioteca (`materials/material-library.ts`, `material-document.ts`): `helix.materials.get(idOrName)`, `list()`, `save(material, name)`, `remove(id)`, `instantiate(document): Material` `engine`
- Geração de mapas (`materials/map-generation.ts`, `map-packing.ts`): `generateNormalFromHeight`, `packOrm`. `engine`
- Propriedades físicas de um material (densidade, atrito…) ficam na seção 9.2 (`PhysicalProperties`).

### 4.2 Textura

- Campos: `name, image, width, height, colorSpace: 'srgb' | 'linear', wrapS/wrapT: 'repeat' | 'clamp' | 'mirror', magFilter/minFilter: 'linear' | 'nearest', dynamic` `engine`
- `create(options)`, `fromAsset(asset)`, `fromImage(ImageBitmap | canvas | ImageData)`, `fromPixels(width, height, Uint8Array | Float32Array)` `engine`
- `setImage(texture, image)`, `touch(texture)` — textura dinâmica atualizada por frame (vídeo, canvas, dados). `engine`
- `readPixels(texture): ImageData` `expor`
- `helix.texture.canvas(width, height): { texture, context: CanvasRenderingContext2D }` — desenhar com 2D e usar como textura. `expor`

---

## 5. Luzes — `helix.light`

Ponte: `core/scene/light.ts`, `core/scene/light-presets.ts`, `editor/lights/light-catalog.ts`, `core/environment/sky-cycle.ts`.

- Direcional (sol): `{ type: 'directional', color, intensity, castShadows }` `engine`
- Ambiente: `{ type: 'ambient', skyColor, groundColor, intensity }` `engine`
- Locais (`LocalLightBase`): `color, temperature: number | null (1000..12000 K), intensity, range, falloff, sourceRadius, specular, shadow: { enabled, softness, bias, normalBias, strength }, animation: 'none' | 'flicker' | 'pulse' | 'strobe', animationSpeed, animationAmount` `engine`
  - `point`; `spot { innerAngle, outerAngle }`; `rect { width, height, twoSided }`; `disc { radius, twoSided }`; `tube { length }` `engine`
- `create(type, options?)`, `fromPreset(id: LightPresetId)`, `presets(): LightPreset[]` `engine`
- `spawn('light', { light })` `engine`
- `helix.light.syncSunToSky()` — `syncSunLightToSky(scene)`; `helix.sky.driveSun: boolean` liga/desliga a sincronia automática. `engine` / `expor`
- Limite de luzes locais por frame: `RenderProfile.maxLocalLights` (seção 8.3). `engine`

---

## 6. Câmera — `helix.camera`

Ponte: `renderer/camera/perspective-camera.ts`, `renderer/camera/orbit-controller.ts`, `editor/viewport/scene-view-pool.ts`, `editor/viewport/pick-entity.ts`, `character/controller/third-person-camera.ts`.

- Ator `camera`: `fovDegrees = 60, near = 0.05, far = 500, exposure = 1`; transform do ator é a pose. `engine` / `expor` (campos ainda não ficam no ator)
- `main: Entity | null`, `setMain(entity)`, `onMainChanged` — a câmera que renderiza no play. `expor`
- `screenToRay(x, y): Ray`, `worldToScreen(point): { x, y, depth }`, `viewport: { width, height, pixelRatio }` `expor` (`gizmo/screen-space.ts` tem a conta)
- `pick(x, y, options?): Entity | null`, `pickPoint(x, y): Vec3 | null` `engine` (`pickEntity`, `pickSurfacePoint`)
- `shake(amplitude, seconds)`, `fade(color, seconds)` — açúcar sobre pós-processamento. `novo`
