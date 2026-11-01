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
- Câmera do jogador (`PlayerSettings.camera`): `distance, minDistance, maxDistance, pitch, minPitch, maxPitch, sensitivity, invertY, pivotHeight` `engine`
- `helix.player.cameraControl: 'engine' | 'script'` — desliga a terceira pessoa para o script mover `main`. `expor`
- Editor (só em `isEditor`): câmera orbital `editor.camera.*` (`settings/engine-settings-schema.ts`), `frame(entity)`. `engine`

---

## 7. Céu, atmosfera e clima — `helix.sky`

Ponte: `core/environment/sky-settings.ts`, `sky-cycle.ts`, `celestial.ts`, `renderer/sky/*`.

- `SkySettings`: `enabled, timeOfDay (0..24), cycleSpeed, latitude, sunAzimuth, haze, sunDiskScale, moonPhase, moonScale, moonlight, starsIntensity, skyLighting` `engine`
- `clouds: CloudSettings`: `enabled, coverage, density, altitude, thickness, detail, windSpeed, windDirection, shadows, quality: 'low' | 'medium' | 'high'` `engine`
- `advance(deltaSeconds)` (`advanceSkyCycle`), `wrapTimeOfDay(hours)`, `formatTimeOfDay(hours)` `engine`
- Astros: `sunDirection(timeOfDay?, latitude?, azimuth?)`, `moonDirection(...)`, `moonPhaseName`, `moonLitFraction`, `hourAngle` `engine` (`celestial.ts`)
- Presets: `helix.sky.preset('dawn' | 'noon' | 'dusk' | 'night' | 'overcast' | 'storm')` — conjuntos nomeados de `SkySettings` + `CloudSettings`; entram no painel Céu e na API ao mesmo tempo. `novo`
- Eventos: `sky.hourChanged(hour)`, `sky.sunrise`, `sky.sunset`. `novo`
- Substituir: `sky.enabled = false` apaga a cúpula e a iluminação do céu; `helix.render.skybox(texture | cubemap)` ou passe custom (seção 8.6). `engine` / `expor`
- Vento global compartilhado com grama, água e VFX: `helix.world.wind: { direction, speed }` — hoje cada sistema tem o seu; a API unifica e os campos individuais viram overrides. `novo`

---

## 8. Gráficos e pós-processamento — `helix.render`, `helix.post`

Ponte: `core/environment/post-process-settings.ts`, `renderer/renderer.ts`, `renderer/quality/render-profile.ts`, `renderer/post/*`, `renderer/passes/*`, `renderer/lod/*`, `renderer/culling/*`, `renderer/myriad/*`, `renderer/stats/*`, `renderer/gl/*`.

### 8.1 Pós-processamento — `helix.post`

- `PostProcessSettings`: `enabled, exposure, toneMapper: 'aces' | 'agx' | 'filmic' | 'neutral' | 'reinhard' | 'none'` `engine`
- `whiteBalance { temperature, tint }` `engine`
- `grading { contrast, saturation, vibrance, shadows, midtones, highlights, shadowTint, highlightTint, toneBalance }` `engine`
- `bloom { enabled, intensity, threshold, softKnee, radius }` `engine`
- `depthOfField { enabled, focusDistance, focalLength, aperture, maxBlur }`; `focusOn(entity)` açúcar. `engine` / `novo`
- `vignette { enabled, intensity, smoothness, roundness }` `engine`
- `chromaticAberration { enabled, intensity }` `engine`
- `filmGrain { enabled, intensity, size, luminanceResponse }` `engine`
- `lensDistortion { enabled, intensity, scale }` `engine`
- `sharpen { enabled, intensity }` `engine`
- `presets(): PostProcessPreset[]` (`natural, cinematic, vivid, vintage, noir, dreamy, clean`), `applyPreset(id)`, `assign(target, source)`, `create(options)` `engine`
- `compareSplit: number | null` — divisão antes/depois (`RenderOptions.postCompareSplit`). `engine`
- Transições: `helix.post.tween(path, value, seconds, easing)` — açúcar genérico sobre qualquer campo numérico. `novo`

### 8.2 Opções do frame — `helix.render`

- `showGrid, shadows, showCsgBrushes, lightHelpers, soundHelpers, vfxHelpers, skeletons` — overlays (`RenderOptions`). `engine`
- `culling { frustumCulling, minPixelSize }` `engine`
- `lod { enabled, bias }` (`renderer/lod/lod-selector.ts`) `engine`
- `myriad { enabled, pixelError, occlusionCulling, shadowClusters, freeze, debugView: 'none' | 'clusters' | 'groups' | 'levels' | 'triangles' | 'normals' | 'occlusion' | 'hzb', hzbLevel, wireframe }` (`myriad-settings.ts`) `engine`
- `terrainMaterialCache: boolean` `engine`
- `profileGpu: boolean` `engine`
- `pixelRatio`, `resolutionScale` `expor`
- `antialias: 'smaa' | 'taa' | 'none'`, `shadowMapSize`, `hdrFormat` — hoje vêm do `RenderProfile` por tier; a API deixa sobrescrever por jogo. `expor`
- `profile: RenderProfile` (só leitura) e `setProfile(partial)`: `tier, cloudStepsPerFrame, cloudInterleave, shadowMapSize, nearCascadePadding, farCascadePeriod, midCascadePeriod, shadowMaskScale, terrainCacheLevels, terrainCacheSize, terrainCacheTilesPerFrame, myriadActivationTriangles, antialias, smaaStencil, maxLocalLights, localShadowMapSize, localShadowFaces, localShadowFacesPerFrame, bloomLevels, bloomStartScale, depthOfFieldTaps, hdrFormat` `engine` / `expor`

### 8.3 Estatísticas — `helix.render.stats`

`FrameStats` só leitura: `drawCalls, triangles, myriad, width, height, pixelRatio, gpuName, gpuTier, softwareRenderer, shadersPending, shadersTotal, cpuMs, cpuStageMs, gpuStageMs, gpuMs, gpuTimerAvailable, meshCandidates, meshesVisible, frustumCulled, sizeCulled, chunks, chunksCulled` `engine`

### 8.4 Passes e ganchos

Ordem fixa dos passes da engine (`renderer/passes/*`): `shadow → localShadow → terrainDepth/depthPrepass → mesh → terrain → grass → water → sky → vfx → guiSurface → post (bloom, dof, composite, sharpen, smaa) → overlays (grid, gizmo, helpers, skeleton)`.

- `helix.render.passes: { [name]: { enabled: boolean } }` — liga/desliga qualquer passe individualmente. `expor`
- `onBeforePass(name, fn(gl, frame))`, `onAfterPass(name, fn)` — gancho com o `WebGL2RenderingContext` ativo e os alvos do frame. `novo`
- `onBeforeFrame(fn)`, `onAfterFrame(fn)` `novo`
- `frame: { sceneColor, sceneDepth, hdr, view, projection, viewProjection, cameraPosition, elapsed, delta }` — alvos e matrizes do frame atual para os ganchos (`renderer/gl/scene-render-target.ts`, `scene-color-capture.ts`). `expor`

### 8.5 Acesso bruto e substituição total

- `helix.render.gl: WebGL2RenderingContext` `expor`
- `helix.render.canvas: HTMLCanvasElement`, `capabilities` (`gl/capabilities.ts`) `expor`
- `createProgram(vertexSource, fragmentSource, defines?)` (`gl/shader-program.ts`), `createTexture`, `createRenderTarget(width, height, format)`, `createMesh(meshData)` (`gpu-mesh.ts`), `createInstanceBuffer(layout)`, `fullscreenTriangle()` `expor`
- `helix.render.enabled = false` — a engine não desenha nada além de limpar; o script desenha tudo com `gl` em `onBeforeFrame`. Passes continuam disponíveis um a um para quem quer "a engine menos o que eu refaço". `expor`
- `helix.render.custom.add(pass: { name, after: PassName, render(gl, frame) })` — passe próprio inserido na ordem. `novo`

### 8.6 Shaders (GLSL / WGSL como ativos)

- Ativo `script` com linguagem `glsl`/`wgsl` compila para um bundle (`renderer/shaders/custom/shader-bundle.ts`) em dois modelos: `surface` (`void surface(inout HelixSurface s)` em GLSL, `fn surface(s: ptr<function, HelixSurface>)` em WGSL, chamada dentro do fragmento de malha depois dos mapas do material e antes da iluminação) e `post` (`main` / `@fragment` de tela cheia sobre a imagem LDR). `engine`
- Material com shader de superfície: `helix.material.fromShader(asset, uniforms?)` devolve um `Material` comum mais `uniforms` (`renderer/shaders/custom/material-shader-registry.ts`; o passe de malha troca o programa por estado de material, nas variantes opaca, deformada e transparente). `engine`
- Chunks da engine disponíveis por `#include`: `brdf, scene-lighting, local-lights, shadow-sampling, noise, color, hdr-encoding, fullscreen, terrain-material, octahedral` (`renderer/shaders/chunks/*`). `engine`
- Uniformes padrão injetados: `uView, uProjection, uViewProjection, uInverseViewProjection, uCameraPosition, uTime, uDelta, uResolution, uNear, uFar, uSunDirection, uSunColor` e, no modelo `post`, `uSceneColor, uSceneDepth` (em WGSL, a struct `helix` e os bindings do grupo 0). `engine`
- `material.uniforms.set(name, value)` / `set({ ... })`, `get`, `has`, `list()`; textura por `sampler2D` (`Texture` ou `null`); nomes conferidos contra as declarações do shader, campos homônimos de dois blocos WGSL qualificados por `variavel.campo`. Também `helix.material.uniforms(target)`. `engine`
- Pós-processamento custom: `helix.post.custom.add({ fragment: asset, name?, uniforms?, enabled? })` entra entre a composição (tone mapping, grading) e o antialiasing, na ordem de adição; cada efeito lê o anterior em `uSceneColor`. Devolve `{ name, enabled, uniforms, remove() }`; `get`, `remove`, `list`, `clear`. Um nome repetido substitui o efeito anterior na mesma posição. `engine`
- Recarga a quente: salvar o ativo de shader com o jogo rodando troca o bundle nos materiais e efeitos ligados a ele; os valores de uniformes que ainda existem ficam. Um programa recusado pelo driver avisa no console e o lote sai com o material padrão (ou o efeito é pulado). `engine`
- Substituir shaders da engine: `helix.render.shaders.override('mesh' | 'terrain' | 'water' | 'grass' | 'sky' | 'vfx' | 'gui-surface' | 'post/*', asset)`. `novo`

---

## 9. Física — `helix.physics`

Ponte: `physics/world/physics-world.ts`, `physics/world/physics-settings.ts`, `physics/body/*`, `physics/shapes/*`, `physics/collision/*`, `physics/joints/*`, `physics/forces/*`, `physics/fluids/*`, `physics/scene/physics-scene.ts`, `character/*`.

### 9.1 Mundo

- `PhysicsSettings`: `gravity, fixedTimestep, substeps, solverIterations, relaxIterations, contactHertz, contactDampingRatio, contactPushMaxVelocity, linearSlop, speculativeDistance, restitutionThreshold, jointHertz, jointDampingRatio, jointPushMaxVelocity, maxLinearSpeed, sleepEnabled, sleepLinearThreshold, sleepAngularThreshold, timeToSleep, fallLimitY, warmStarting, waterDensity, waterDrag, waterAngularDrag` `engine`
- `quality: 'low' | 'medium' | 'high'` (`matchPhysicsQuality`, presets) `engine`
- `stats: { bodies, awake, manifolds, contactPoints, joints, stepMs, stepsLastAdvance, backend }` `engine`
- `enabled: boolean` — pausa o `advance`. `expor`
- `stepOnce()`, `discardAccumulatedTime()`, `interpolation` (alpha do frame) `engine`
- `onPreStep(fn(h)): Unsubscribe` — `addPreStepHook`. `engine`
- `addForceField({ wakeAffected(bodies, time), apply(bodies, h, time) }): Unsubscribe` — campo de força próprio, escrito à mão; os prontos estão em `helix.physics.forces` (§9.8). `engine`
- `fluids`: volumes de água (`water-volume.ts`, `buoyancy-field.ts`) + `waterDensity/Drag` do mundo; `helix.physics.waterAt(point): WaterSample | null`. `engine` / `expor`
- Backend em worker (`physics/worker/*`): o mundo da thread principal vira espelho e o `PhysicsWorkerCore` integra; corpos, juntas (criação, `markChanged`, remoção, quebra) e forças de scripts (`addForce`/`addTorque`) atravessam como comandos; poses, contatos e o estado das juntas (reação, coordenada, velocidade, quebra) voltam a cada quadro. `engine`

### 9.2 Corpo rígido (componente)

- `RigidBodySettings` no ator: `type: 'static' | 'kinematic' | 'dynamic', collider: 'box' | 'sphere' | 'capsule' | 'mesh', boxSize, radius, height, center, mass, friction, restitution, linearDamping, angularDamping, gravityScale, canSleep` `engine`
- `fitCollider(entity)` (`collider-fit.ts`), `massProperties(entity)` (`mass-properties.ts`), `colliderRequiresStatic(kind)` `engine`
- Materiais físicos (`materials/physical-material.ts`): `PhysicalProperties { density, friction, restitution, linearDamping }`; presets `generic, wood, stone, concrete, brick, metal, aluminum, glass, plastic, rubber, ice, fabric, foam, sand` → `physical.presets()`, `applyPhysical(entity, id)` (recalcula a massa por `massForMaterial`), `matchPhysicalPreset(props)`, `colliderVolume(entity)` `engine`
- Corpo em runtime (`helix.physics.bodyOf(entity): RigidBody`, via `PhysicsScene.bindingOf`): `engine`
  - leitura: `isStatic, isKinematic, isDynamic, isMoving, isResting, isActive, motionSpeed, position, orientation, mass, invMass` `engine`
  - `linearVelocity`, `angularVelocity` — leitura e escrita. `expor`
  - `applyImpulse(impulse, point?)`, `applyForce(force, point?)`, `applyTorque(torque)`, `applyAngularImpulse(...)` `engine` (impulso) / `expor` (demais)
  - No `RigidBody` cru: `addForce(force)`, `addForceAtPoint(force, point)`, `addTorque(torque)` acumulam para o próximo passo (zerados ao fim dele); `applyImpulseAtPoint(impulse, point)`, `velocityAtPoint(out, point)`. `engine`
  - `setPose`, `teleport(position, orientation)`, `moveKinematic(position, orientation, h)`, `setMaterial({ friction, restitution, linearDamping, angularDamping, gravityScale, canSleep })` `engine`
  - `wake()`, `sleep()` `engine`
  - `lockRotation(x, y, z)`, `lockPosition(x, y, z)` `novo`
- Formas soltas (sem ator): `createBoxShape, createSphereShape, createCapsuleShape, createMeshShape(mesh, scale), createHeightfieldShape`, `shapeVolume`, `shapeAabb` `engine`

### 9.3 Consultas espaciais

- `raycast(origin, direction, maxDistance?, filter?): Hit | null` — `{ entity, body, point, normal, distance }`; usa BVH de malha, caixa/esfera/cápsula analíticas e heightfield do terreno. `expor` (peças: `mesh-raycast`, `collide-heightfield`, `triangle-mesh-bvh`)
- `raycastAll(...)`: Hit[] `expor`
- `overlapAabb(aabb, filter?)` — `PhysicsWorld.queryAabb`. `engine`
- `overlapSphere(center, radius)`, `overlapBox(center, halfExtents, rotation)` `expor` (`collide-sphere`, `collide-box-box`)
- `sweep(shape, from, to, filter?)`: Hit | null `novo`
- `closestPoint(point, body)` (`closest-points.ts`) `engine`
- `filter`: `{ layers?, exclude?: Entity[], tags?, kinds? }` `novo`

### 9.4 Eventos de contato e gatilhos (triggers)

A engine já computa manifolds e cache de contatos (`collision/manifold.ts`, `contact-cache.ts`); o que falta é entregar isso aos scripts.

- `entity.rigidBody.isTrigger: boolean` — colide só para detectar, sem resposta. `novo`
- Eventos por ator: `onCollisionBegin(other, contact)`, `onCollisionStay(other, contact)`, `onCollisionEnd(other)` — `contact: { point, normal, impulse, relativeVelocity }`. `expor`
- `onTriggerEnter(other)`, `onTriggerStay(other)`, `onTriggerExit(other)` `expor`
- Gatilho sem corpo (volume puro): `spawn('group', { trigger: { shape: 'box' | 'sphere', size | radius } })`. `novo`
- Mundo: `onOutOfBounds(entity)` (abaixo de `fallLimitY`), `onUnstable(entity)` `engine`
- Camadas e máscaras: `rigidBody.layer: string` (ausente = `"default"`), `rigidBody.collidesWith: string[]` (máscara própria, além da matriz); `helix.physics.layers.define([...])`, `setCollision(a, b, enabled)`, `collides(a, b)`, `list()`, `of(entity)`. A matriz vale para o mundo em andamento (defina no `onStart`); nomes novos entram ao aparecer; até 32 camadas. As consultas (`raycast`, `overlap*`) aceitam `filter.layers`. `engine`

### 9.5 Personagem e controlador

Ponte: `character/character-settings.ts`, `character-runtime.ts`, `controller/character-controller.ts`, `controller/character-input.ts`, `controller/terrain-collider.ts`.

- `CharacterSettings` no ator: `autoPossess, model (asset), clips { idle, walk, run, crouch }, radius, height, crouchHeight, walkSpeed, runSpeed, crouchSpeed, acceleration, braking, airControl, jumpHeight, maxSlopeDegrees, stepHeight, rotationRate, mass` `engine`
- `PlayerSettings` (cena): `enabled, spawnIfMissing, character, camera` `engine`
- Runtime (`helix.character.of(entity)`): `isGrounded, isCrouching, horizontalSpeed, velocity, height, rigidBody, intent` `engine` / `expor`
- Comandos: `move(x, z)`, `look(dx, dy)`, `jump()`, `run(bool)`, `crouch(bool)`, `teleport(position, yaw?)`, `setIntent(partial: CharacterIntent)` `expor`
- Posse: `helix.player.possess(entity)`, `unpossess()`, `possessed: Entity | null`, `isPossessing` `engine`
- Fonte de entrada: `inputSource: 'engine' | 'script'` — com `script`, o controlador só consome `setIntent`. `expor`
- Eventos: `character.landed(speed)`, `character.jumped`, `character.crouched`, `character.stepped` (eventos de pé da animação). `novo`
- Substituir: `rigidBody` cinemático + `moveKinematic` + `raycast/sweep` = controlador próprio; `helix.character.controllerClass` para registrar um substituto. `engine` / `novo`

### 9.6 Substituir a física

- `helix.physics.enabled = false` + `onFixedUpdate` + `transform` = física própria. `expor`
- Ou manter detecção e trocar resposta: `onPreStep` + `applyImpulse`/`setPose` por corpo. `engine`
- Integração externa (WASM: Rapier, Jolt, Box2D) entra como `PhysicsBackend` registrado: `helix.physics.backend = { createBody, removeBody, step, raycast, … }`. `novo`

### 9.7 Juntas — `helix.physics.joints`

Ponte: `physics/joints/joint-settings.ts` (definição, saneamento), `joint-builder.ts` (coordenadas de mundo → locais), `joint.ts` + um arquivo por tipo, `joint-math.ts` (peças do solver de passo mole), `joint-solver.ts`. As juntas entram antes dos contatos em cada fase do solver (warm start, solução com viés, relaxamento) e participam das ilhas de sono: acordar um corpo acorda quem está preso a ele. Dois corpos ligados não colidem entre si (`collideConnected: false`). Ângulos em radianos, distâncias em metros, forças em N, torques em N·m.

- Tipos: `ball` (âncoras coincidentes, gira livre), `hinge` (um eixo), `slider` (translada num eixo, sem girar), `fixed` (solda; com `spring.hertz > 0` fica flexível), `distance` (haste; `limits` dá folga, `spring` vira amortecedor), `cone-twist` (cone de balanço `coneAngle` + torção em `limits`, para ragdoll), `wheel` (suspensão com mola e curso no `axis`, eixo de rolamento `axle` com `motor`, `brakeTorque` e `steeringAngle`). `engine`
- Criar: `create(type, a, b | null, options)` ou `ball/hinge/slider/fixed/distance/coneTwist(a, b, options)`, `wheel(chassis, roda, options)`; `a`/`b` são atores ou handles de corpo, `b` nulo prende ao mundo (`PhysicsWorld.ground`, id 0). `options` em coordenadas de mundo: `anchor`, `anchorA`, `anchorB`, `axis`, `secondaryAxis`/`axle` + os parâmetros abaixo. A definição é saneada (`sanitizeJointDefinition`): eixos unitários e perpendiculares, limites ordenados, Hz ≤ ¼ da taxa de subpassos. `engine`
- Parâmetros (criação, `joint.set(patch)` ou setters do handle, todos ao vivo): `enabled`, `collideConnected`, `limits: [min, max] | { min, max } | null`, `motor: { targetVelocity, maxForce? } | null`, `spring: { hertz, dampingRatio?, target? } | null`, `breakForce`, `breakTorque`, `length`, `coneAngle`, `brakeTorque`, `steeringAngle`. Cada mudança chama `Joint.markChanged()` (saneia, acorda os corpos e, no worker, reenvia a definição). `engine`
- Leitura no handle: `type`, `isAngular`, `bodyA/bodyB`, `entityA/entityB`, `anchorA/anchorB/axis` (mundo), `isActive`, `isBroken`, `coordinate` (ângulo, translação, comprimento; na roda, a compressão da suspensão), `speed` (na roda, a rotação do eixo), `reactionForce`, `reactionTorque`, `axialForce`, `motorForce`. `engine`
- Ciclo de vida: `remove()`, `break()` (dispara `onBreak`), `helix.physics.joints.remove(j)`, `all()`, `of(entity)`, `count`, `types`. Remover um corpo remove as juntas dele; as de um script saem quando ele para. `engine`
- Quebra: a reação acima de `breakForce`/`breakTorque` solta a junta (fica como registro quebrado até `remove`); `helix.physics.joints.onBreak(({ joint, a, b }) => …)` e o evento `physics.jointBreak` no barramento. `engine`
- Parâmetros globais das travas rígidas no painel Física → Juntas: `jointHertz` (padrão 60), `jointDampingRatio` (2), `jointPushMaxVelocity` (20 m/s). `engine`
- Teste headless: `pnpm test:physics-joints` (pêndulo, limites, motor, mola, solda, haste, cone, carro, quebra, campos e paridade com o worker).

### 9.8 Campos de força prontos — `helix.physics.forces`

Ponte: `physics/forces/field-region.ts` (regiões), `region-field.ts` (base), `directional-field.ts`, `radial-field.ts`, `vortex-field.ts`, `drag-field.ts`, `explosion.ts`. Agem sobre corpos dinâmicos dentro da região, a cada subpasso, mudando velocidades (impulso = força × subpasso); os que movem corpos parados acordam os adormecidos na região (o arrasto não). Em `mode: 'acceleration'` (padrão) a intensidade é em m/s² e vale para qualquer massa; em `'force'` é em N e os leves sentem mais.

- Regiões: `everywhere()`, `sphere(center, radius, falloff?)`, `box(center, halfExtents, falloff?)`; `falloff` (0 a 1) é a fração do raio em que o efeito cai suavemente até a borda. Também aceitam `{ center, radius }` / `{ center, halfExtents }` direto em `region`. `engine`
- `directional({ direction, strength, mode?, region? })` — vento, esteira, gravidade extra. `engine`
- `radial({ center, strength, radius?, falloff?: 'none' | 'linear' | 'inverse-square', mode?, region? })` — `strength > 0` repele, `< 0` atrai; `inverse-square` vale a 1 m e cai com 1/r². `engine`
- `vortex({ center, axis?, strength, inwardStrength?, liftStrength?, radius?, falloff?, mode?, region? })` — tangencial, para o eixo e ao longo dele. `engine`
- `drag({ linear?, quadratic?, angular?, region? })` — implícito (divide a velocidade), estável com qualquer coeficiente. `engine`
- `explode(center, radius, strength, { falloff?, upwardBias?, mode?: 'impulse' | 'velocity' }): number` — impulso radial instantâneo aplicado no ponto do corpo mais próximo do centro (gira os destroços); devolve quantos corpos atingiu. `engine`
- Handles: `enabled`, `region`, os parâmetros do tipo (todos ao vivo), `attached`, `remove()`; `helix.physics.forces.remove(field)`. Os campos de um script saem quando ele para. Com a física no worker, os campos de scripts rodam na thread principal sobre os espelhos, uma vez por frame, e as velocidades resultantes seguem ao worker. `engine`

---

## 10. Terreno — `helix.terrain`

Ponte: `terrain/core/*`, `terrain/generation/*`, `terrain/sculpt/*`, `terrain/materials/*`, `terrain/foliage/*`, `terrain/water/*`, `terrain/chunks/*`, `editor/commands/terrain-commands.ts`.

### 10.1 Criar e dimensionar

- `spawn('terrain', { terrain: { size, resolution, splatResolution, layers?, shading?, grass?, water? } })` `engine`
- `Terrain`: `size, resolution, cellSize, halfSize, heightfield, splat, grassMap, layers, shading, grass, water, tiles, localBounds, heightVersion, splatVersion, grassVersion` `engine`
- `resample(resolution)` (`Heightfield.resampled`), `resize(size)` `engine` / `expor`

### 10.2 Alturas (Heightfield)

- `get(x, z)`, `set(x, z, height)`, `sample(gx, gz)`, `sampleTriangulated`, `normalAt`, `slopeAt`, `minMax()`, `fill(height)`, `clone()`, `copyRegion(region)`, `pasteRegion(region, data)` `engine`
- Em coordenadas do mundo: `heightAt(point)`, `normalAt(point)`, `contains(point)` (`heightAtLocal` + transform) `engine`
- `raycast(ray): TerrainHit | null` `engine`
- `markDirty(region?)` — `heightVersion++`, reconstrói física (`PhysicsScene.reconcileTerrain`) e tiles. `expor`
- Coordenadas: `localToGrid, gridToLocal, localToTexel, localToSplat, localToGrassTexel`, `gridRegionAround(x, z, radius)` `engine`

### 10.3 Geração procedural

- `TerrainGenerationParams`: `preset: 'flat' | 'hills' | 'mountains' | 'valley' | 'islands' | 'plateau' | 'dunes', seed, amplitude, featureSize, detail, erosion` `engine`
- `generate(terrain, params)` (`generateTerrainHeights`) `engine`
- `generateWith(terrain, fn(u, v, x, z) => height)` — função do usuário, mesma malha e mesmo cache. `expor`
- `autoPaint(terrain)` — regras automáticas das camadas (`generation/auto-paint.ts`). `engine`
- Ruído disponível em `helix.math.noise` para quem gera o próprio heightmap; `fromImage(image, minHeight, maxHeight)` importa heightmap. `engine` / `expor`

### 10.4 Esculpir

- `BrushSettings`: `radius, strength, falloff: 'smooth' | 'linear' | 'spherical' | 'tip' | 'flat'` `engine`
- `Stamp`: `cx, cz, radius, falloff` (coordenadas de grade) `engine`
- `raise(stamp, delta)`, `smooth(stamp, amount)`, `flatten(stamp, target, amount)`, `noise(stamp, amplitude, scaleCells, seed)`, `terrace(stamp, step, amount)`, `erodeThermal(region, talusSlope, amount)` `engine`
- Atalho em mundo: `helix.terrain.sculpt(terrain, tool, worldPoint, brush, amount)`. `expor`
- Histórico: `beginStroke()` / `endStroke()` agrupa para o desfazer do editor (`terrain-commands.ts`); em jogo é só marcação de região. `engine`

### 10.5 Camadas e pintura

- `TerrainLayer`: `id, name, material: TerrainMaterial, tiling, tint, normalStrength, roughness, auto: { enabled, slopeMin, slopeMax, heightMin, heightMax, softness }` `engine`
- `addLayer(terrain, material, overrides?)`, `removeLayer`, `moveLayer`, `cloneLayer` `engine`
- Materiais: catálogo (`terrain/materials/material-catalog.ts`: `grass, meadow, dirt, mud, rock, gravel, sand, snow`) e biblioteca (`terrainMaterialForDocument`) → `helix.terrain.materials.catalog()`, `fromLibrary(materialId)`, `fromTextures({ albedo, normal, ormh })` (`ormh-packer.ts`). `engine`
- Splat (`SplatMap`): `weight(tx, tz, layer)`, `readWeights`, `writeWeights`, `blend(tx, tz, layer, amount)`; `paint(worldPoint, layer, brush, amount)` em mundo. `engine` / `expor`
- `shading: TerrainShading` (`terrain-shading.ts`). `engine`

### 10.6 Grama e vegetação

- `GrassSettings`: `enabled, density, height, heightVariation, width, clumping, bend, viewDistance, maxSlope, windStrength, windSpeed, windDirection, baseColor, tipColor, colorVariation, groundBlend, translucency, trample, recoverySeconds` `engine`
- `GrassMap`: densidade pintada; `paintGrass(worldPoint, brush, amount)` (`grass-paint-tool.ts`) `engine`
- Interatores (amassar grama): `helix.terrain.grass.addInteractor(entity, radius)`, automático para personagens e corpos em movimento (`renderer/foliage/grass-interactors.ts`). `expor`
- Instâncias de vegetação (árvores, pedras) por `scatter(terrain, modelAsset, { density, maxSlope, minHeight, maxHeight, seed, alignToNormal, scaleRange })`. `novo`

### 10.7 Água

- `WaterSettings`: `enabled, level, shallowColor, deepColor, clarity, waveHeight, waveLength, waveSpeed, waveDirection, choppiness, ripples, foam: WaterFoamSettings, reflectivity, roughness, refraction, caustics, subsurface` `engine`
- `sampleSurface(x, z, time?): WaterSample` (`sampleWaterSurface`) — altura e normal da onda para boias e barcos. `engine`
- `isUnderwater(point)`, `depthAt(point)` `expor`
- Volumes de água fora do terreno (piscina, rio): `spawn('group', { water: { size, settings } })`. `novo`
- Eventos: `water.entered(entity)`, `water.exited(entity)`. `novo`

### 10.8 Streaming e tiles

- `tiles: TerrainTileBounds`, `regionChangeLog` (`chunks/*`) — leitura; `helix.terrain.onRegionChanged(fn)`. `expor`
- Vários terrenos lado a lado (mundo aberto): `helix.terrain.stitch(a, b, edge)`. `novo`

---

## 11. Interface (GUI) — `helix.gui`

Ponte: `gui/document/*`, `gui/layout/*`, `gui/runtime/gui-runtime.ts`, `gui/render/gui-renderer.ts`, `gui/world/*`, `gui/fonts/*`, `gui/icons/*`, `gui/templates/*`, `editor/playtest/playtest-hud.ts`, `editor/commands/gui-commands.ts`.

### 11.1 Telas (documentos)

- `GuiDocument`: `name, referenceSize, scaleMode: 'none' | 'width' | 'height' | 'shorter' | 'longer', enabled, displayOrder, root` `engine`
- `load(asset): Screen`, `create(name, referenceSize?)`, `show(screen)`, `hide(screen)`, `screens(): Screen[]`, `setDocuments([...])` `engine` / `expor`
- Por script, a tela é um handle vivo: `create` devolve um documento que `add`/`find`/`setText` aceitam antes ou depois de `show`; qualquer versão devolvida — ou o nome — identifica a mesma tela, então linguagens que convertem objetos na ponte (Lua, Python) a encontram do mesmo jeito. `hide` a tira da HUD sem esquecê-la. `engine`
- Atores `gui` na cena (`kind: 'gui'`) são telas ligadas à cena; `spawn('gui', { gui: asset })`. `engine`
- Serialização: `toJson(screen)`, `fromJson(json)` (`gui-io.ts`); HTML/CSS/SVG como ativos viram documentos pelo conversor da seção 11.9. `engine` / `novo`

### 11.2 Nós (elementos)

- `GuiElementKind`: `frame | text | image | icon | button | toggle | slider | progress | input | scroll | divider | video | viewport` `engine`
- `GuiNode`: `id, name, kind, visible, locked, interactable, clipsContent, rect, appearance, layout, text, image, icon, control, states, children` `engine`
- Árvore (`gui-tree.ts`): `find(screen, nameOrId)`, `findAll`, `create(kind, props, parent, index?)`, `remove(node)`, `move(node, parent, index)`, `clone(node)`, `parentOf(node)`, `path(node)` `engine`
- Toda escrita é imutável por baixo (`GuiNode` é `readonly`): `helix.gui.set(node, { rect: {...} })` devolve o nó novo e a tela atualizada; a ponte esconde isso com setters nas linguagens mutáveis. `engine` / `expor`

### 11.3 Posição e tamanho — `rect`

- `GuiRect`: `position: UDim2, size: UDim2, anchor: GuiPoint, rotation, zIndex, autoSize: 'none' | 'x' | 'y' | 'xy'` `engine`
- `UDim2 { x: { scale, offset }, y: { scale, offset } }`; helpers `udim(scale, offset)`, `udim2(sx, ox, sy, oy)`, `px(n)`, `pct(n)` `engine`
- Layout automático: `GuiAutoLayout { kind: 'none' | 'list' | 'grid', direction, gap, padding, mainAlign, crossAlign, wrap }` `engine`
- Resultado medido: `layoutOf(node): { x, y, width, height }` (`GuiLayoutResult`), `hitTest(screen, x, y)` (`gui-hit-test.ts`) `engine`

### 11.4 Aparência

- `GuiAppearance`: `fill { color, alpha, gradient: { kind: 'linear' | 'radial', angle, stops[] } | null }, stroke { width, color, alpha } | null, radii [tl, tr, br, bl], shadow { color, alpha, blur, offsetX, offsetY } | null, opacity` `engine`
- `GuiStates`: `hover, pressed, disabled: GuiStateStyle | null, transitionMs` `engine`
- Texto (`GuiTextStyle`): `content, family, size, weight, italic, color, alpha, align, verticalAlign, lineHeight, letterSpacing, wrap, uppercase, shadow, outline, fitToBox` `engine`
- Imagem (`GuiImage`): `assetId, fit: 'stretch' | 'contain' | 'cover' | 'tile' | 'slice', slice: insets, tint, tintAlpha` `engine`
- Ícone: catálogo `gui/icons/gui-icon-catalog.ts` → `helix.gui.icons.list()`. `engine`
- Fontes: registro `gui/fonts/gui-font-registry.ts` → `helix.gui.fonts.list()`, `register(fontAsset)`, `measure(text, style)` (`gui-text-measure.ts`). `engine`

### 11.5 Controles

- `button`, `toggle { checked }`, `slider { value, min, max, step }`, `progress { value, max }`, `input { value, placeholder, maxLength, password, multiline }`, `scroll { offset, direction }`, `divider`, `video { assetId, fit: 'cover' | 'contain' | 'stretch', playOn: 'start' | 'hover' | 'manual', loop, muted }`, `viewport { camera: 'entity' | 'orbit', cameraName, targetName, distance }` `engine`
- `value(node)`, `setValue(node, value)`, `focus(node)`, `blur()`, `hasFocusedInput` `engine` / `expor`
- Vídeo: `play(node)`, `pause(node)`, `toggleVideo(nodeId)`, `seek(node, seconds)` `engine` / `expor`
- Viewport na GUI: `setViewportProvider` (câmera da cena desenhada dentro de um nó). `engine`

### 11.6 Eventos e entrada

- `GuiRuntimeEvent { type: 'activate' | 'change' | 'focus' | 'blur', nodeId, nodeName, value }` → `helix.gui.on(screen, type, handler)`, `onNode(node, type, handler)` `engine`
- Ponteiro: `pointerEnter/Leave/Move/Down/Up` por nó, `wheel`, `cursor` `expor` (o runtime já faz hit-test; falta emitir por nó)
- Teclado: `keyDown(node, event)` em inputs; IME: não submeter enquanto `isComposing`. `engine`
- `tick(dt)`, `invalidate()`, `animating` — para quem controla o runtime à mão. `engine`

### 11.7 HUD do jogo

- `helix.gui.hud: Screen` — a tela do play (`PlaytestHud`); `visible`, `interactive`, `cursor`. `engine`
- `helix.gui.canvas2d: CanvasRenderingContext2D` — o canvas do HUD para desenhar direto (mira, minimapa, debug), em `onRender`. `expor`
- `helix.gui.enabled = false` — a engine não desenha nem trata GUI; o script usa `canvas2d` ou DOM próprio (`helix.gui.domRoot: HTMLElement`). `expor` / `novo`

### 11.8 Superfícies 3D (GUI no mundo)

- `GuiSurfaceSettings` no ator: `content: { kind: 'screen', assetId } | { kind: 'video', video } | { kind: 'view', view }`, `mount: { kind: 'face', face, offset, inset } | { kind: 'panel', position, rotation, width, height } | { kind: 'billboard', offset, width, height, lockY, constantSize }`, `pixelsPerMeter, shading: 'lit' | 'screen' | 'overlay', brightness, blend: 'opaque' | 'cutout' | 'transparent', opacity, doubleSided` `engine`
- `interactive: boolean` por superfície (hoje toda superfície com tela responde ao ponteiro). `expor`
- `helix.gui.surfaces.of(entity)`, `onEvent(entity, handler)` (`GuiSurfaceEvent` + `GuiSurfaceHit` com ponto 3D), `raycast(ray)` `engine`
- `synthesize(content, size)` — documento gerado para vídeo/view sem tela. `engine`

### 11.9 Templates e declarativo

- Templates (`gui/templates/gui-templates.ts`): `helix.gui.templates.list()`, `instantiate(id)`. `engine`
- HTML/CSS/SVG como ativos: `helix.gui.fromHtml(asset)` converte o subconjunto suportado (`div/span/p/img/button/input`, flex, cores, bordas, sombras, fontes) para `GuiDocument`; SVG vira `image`. Fora do subconjunto, aviso no console com a linha. `novo`

---

## 12. Áudio — `helix.audio`

Ponte: `audio/audio-engine.ts`, `audio/mixer/*`, `audio/world/*`, `audio/clip/*`, `audio/graph/*`, `audio/playback/*`, `audio/analysis/*`, `audio/synth/*`, `audio/export/*`, `audio/core/*`.

### 12.1 Mixer

- Buses: `master | music | sfx | ambience | voice | ui`; `BusSettings { volumeDb, muted, solo }` `engine`
- `bus(id).volumeDb`, `muted`, `solo`, `effectiveGain(id)`, `anySoloed()` `engine`
- `fadeBus(id, toDb, seconds)` `novo`
- `helix.audio.locked: boolean`, `unlock()` — autoplay do navegador (`core/audio-context.ts`). `engine`
- `suspend()`, `resume()`, `masterDb` `engine`

### 12.2 Fontes 3D (componente `sound`)

- `AudioSourceSettings`: `assetId, muted, volumeDb, pitch, loopMode: 'clip' | 'loop' | 'once', trigger: 'auto' | 'proximity' | 'manual', triggerRadius, stopOnExit, fadeIn, fadeOut, repeatMin, repeatMax, randomStart, spatial, panningModel: 'equalpower' | 'hrtf', distanceModel: 'inverse' | 'linear' | 'exponential', minDistance, maxDistance, rolloff, airAbsorption, cone { enabled, innerAngle, outerAngle, outerGainDb }, doppler, occlusion { enabled, attenuationDb, lowpass }, reverbSend, priority` `engine`
- `play(entity)`, `stop(entity)`, `stopAll(fadeSeconds?, keepLatched?)`, `isPlaying(entity)`, `isLatched(entity)`, `runtime(entity): { status, gain, distance, occluded }` `engine`
- `pause(entity)`, `resume(entity)`, `seek(entity, seconds)`, `setAsset(entity, asset)` `expor`
- `status`: `playing | virtual | loading | waiting | stopped | muted | solo-muted | no-asset | off | locked | error` `engine`
- Eventos: `audio.started(entity)`, `audio.ended(entity)`, `audio.looped(entity)`. `novo`
- Ouvinte: `helix.audio.listener: { entity | 'camera', position, forward, up }` — por padrão a câmera principal. `expor` (`spatial-listener.ts`)

### 12.3 Zonas (componente `audioZone`)

- `AudioZoneSettings`: `enabled, shape: 'box' | 'sphere', size, radius, falloff, priority, reverb: ReverbSettings, echo: DelaySettings, filter { enabled, frequency }, ambience { assetId, volumeDb }` `engine`
- `presets()`, `applyPreset(entity, id)`, `weightAt(entity, point)` `engine`
- Eventos: `audio.zoneEntered(entity)`, `audio.zoneExited(entity)` (do ouvinte). `novo`

### 12.4 Clipes e reprodução direta (2D / one-shot)

- `AudioClipSettings`: `bus, volumeDb, pitch, pan, loop, loopStart, loopEnd, trimStart, trimEnd, fadeIn { duration, curve }, fadeOut, randomPitch, randomVolumeDb, effects: AudioEffectsSettings { eq, filter, distortion, compressor, delay, reverb }` (`audio-effects.ts`) `engine`
- `play(asset, settings?): Voice` (2D), `playAt(asset, position, settings?): Voice` (3D sem ator) `engine` / `expor`
- `Voice`: `stop(fade?)`, `pause`, `resume`, `volumeDb`, `pitch`, `time`, `ended: Promise`, `onEnded` `engine` / `expor`
- Presets de clipe (`audio-clip-presets.ts`), `neutralize`, `rollVariation` `engine`

### 12.5 Análise, síntese e exportação

- `levelMeter(bus | voice): { peak, rms }`, `waveform(asset): Float32Array`, `spectrum(bus | voice, size): Float32Array` (`analysis/*`) `engine` / `expor`
- Sinais de teste (`synth/test-signals.ts`): `tone(freq, seconds)`, `noise(kind, seconds)`, `sweep` → `AudioBuffer`. `engine`
- `render(asset, settings): AudioBuffer`, `encodeWav(buffer): Blob` (`export/*`) `engine`
- Decodificação: `decode(file): AudioBuffer` com cache (`decode/*`). `engine`

### 12.6 Acesso bruto e substituição

- `helix.audio.context: AudioContext`, `masterNode: GainNode`, `busNode(id): GainNode` — ligar nós Web Audio próprios (DSP, síntese, worklets). `expor`
- `helix.audio.enabled = false` — a engine não cria vozes; o script usa `context`. `expor`
- `helix.audio.worklet(assetJs)` — registra um `AudioWorkletProcessor` a partir de um ativo de script JavaScript. `novo`

---

## 13. Animação, esqueletos e personagens — `helix.animation`

Ponte: `core/animation/*`, `animation/*`, `character/animation/*`, `character/rig/*`, `core/scene/rig.ts`, `core/scene/skin.ts`, `editor/animation/animation-editor.ts`.

### 13.1 Documentos e clipes

- `AnimationDocument`: `name, duration, loop, frameRate, referenceSpeed, tracks[] { joint, path: 'translation' | 'rotation' | 'scale', interpolation: 'linear' | 'step' | 'cubic', times, values }, skeleton, events[] { time, name }, source` `engine`
- `clip(asset): SkeletonClip`, `clipFromDocument`, `retarget(clip, rig)` (`retarget.ts`), `fromBvh(file)`, `fromImported(model, clipName)` `engine`
- Edição (`track-editing.ts`): `setKey(track, time, value)`, `removeKey`, `insertEvent(doc, time, name)`, `trim`, `resample(frameRate)`, `save(doc, name)` `engine` / `expor`
- `sample(clip, time, outPose)` (`track-sampling.ts`) `engine`

### 13.2 Player

- `player(entity): AnimationPlayer` — `rig`, `currentClip`, `playbackState: 'stopped' | 'playing' | 'paused'`, `playing`, `time`, `speed`, `loop`, `duration`, `phase` `engine`
- `play(clip, { loop, speed, fadeIn, startTime })`, `replaceClip`, `pause`, `resume`, `togglePlay`, `stop`, `seek(time)`, `setSpeed`, `setLoop`, `rest()` `engine`
- `onEvent(handler(event, clip))` — eventos da trilha (passos, golpes). `engine`
- `evaluate(outPose)`, `apply()` `engine`
- Camadas e mistura: `layer(name, { weight, mask: joints[], additive })`, `crossFade(clipA, clipB, seconds)`, `blendTree({ param, clips })`. `novo`
- Eventos de engine: `animation.started`, `animation.finished`, `animation.looped`, `animation.event(name)`. `novo`

### 13.3 Esqueleto, pose e IK

- `Rig`/`Skeleton`: `joints[] { name, parent, bind }`, `boneRoles` (`core/animation/bone-roles.ts`: `hips, spine, head, leftHand, …`), `jointByRole(role)` `engine`
- `Pose`: `getJoint(name): { position, rotation, scale }`, `setJoint`, `worldMatrixOf(joint)`, `attach(entity, joint, offset?)` (socket). `engine` / `expor`
- IK (`animation/ik/*`): `twoBoneIk(pose, chain, target, pole)`, `limbChains(rig)` → `helix.animation.ik.solve(entity, 'leftArm' | 'rightLeg' | …, target, pole?, weight)`. `engine` / `expor`
- Sobreposições (`character/animation/pose-overlay.ts`, `clips/air-overlays.ts`): `overlay(entity, clip, weight, mask)`. `engine`
- Locomoção (`locomotion-animator.ts`): `blend idle/walk/run/crouch` por velocidade; `locomotion.enabled = false` para animar à mão. `engine` / `expor`

### 13.4 Modelos de personagem

- Registro (`character/assets/*`): `models(): CharacterModelAsset[]`, `mannequin`, `setModel(entity, assetId)`, `bindings(entity): clips` `engine`
- Pele (`Skin`): `skinOf(entity)`, matrizes de junta (`gpu-skin-cache`). `engine`

---

## 14. Efeitos visuais (VFX) — `helix.vfx`

Ponte: `vfx/vfx-settings.ts`, `vfx/document/*`, `vfx/simulation/*`, `vfx/world/vfx-system.ts`, `vfx/textures/*`, `vfx/preview/*`, `editor/commands/vfx-commands.ts`.

### 14.1 Componente

- `VfxSettings` no ator: `assetId, autoPlay, playInEditor, loop: boolean | null, scale, timeScale, seed, cullDistance` `engine`
- `play(entity)`, `pause`, `resume`, `stop`, `reset()`, `instance(entity): VfxInstance`, `stats` `engine`
- `burst(entity, count, emitterName?)`, `emitAt(asset, position, options?)` (efeito solto, sem ator), `setParam(entity, path, value)` (sobrescreve campo do documento só nessa instância) `expor` / `novo`
- Eventos: `vfx.started`, `vfx.finished(entity)`, `vfx.loop`. `novo`

### 14.2 Documento (efeito)

- `VfxDocument`: `name, duration, loop, prewarm, scale, cullRadius, emitters[]` `engine`
- `VfxEmitter`: `id, name, enabled, delay, duration, loop, maxParticles, space: 'local' | 'world', spawn (rate, bursts), shape { kind: 'point' | 'sphere' | 'hemisphere' | 'cone' | 'box' | 'circle' | 'edge', emitFrom: 'volume' | 'surface' | 'edge', … }, initial (vida, velocidade, tamanho, rotação, cor), modules[], renderer { mode: 'billboard' | 'stretched' | 'horizontal' | 'vertical', blend: 'alpha' | 'additive' | 'premultiplied' | 'multiply', sort: 'none' | 'distance' | 'oldest' | 'youngest', lighting: 'unlit' | 'lit', texture }, tint` `engine`
- Módulos (`VfxModuleKind`): `asset, attractor, collision, colorBySpeed, colorOverLife, drag, force, gravity, limitVelocity, noise, orbit, rotationOverLife, sizeBySpeed, sizeOverLife, velocityOverLife, vortex` `engine`
- Curvas (`vfx-curves.ts`): `constant, range, curve(points), gradient(stops)`. `engine`
- Árvore (`vfx-tree.ts`): `addEmitter`, `removeEmitter`, `addModule(emitter, kind)`, `removeModule`, `set(path, value)` `engine`
- Templates (`vfx-templates.ts`): `empty, campfire, torch, thruster, sparks, explosion, dust-impact, rain, snow, leaves, fireflies, magic-aura, portal, healing, confetti` → `templates.list()`, `fromTemplate(id)` `engine`
- Texturas (`vfx-texture-catalog.ts`): `textures.list()` + qualquer textura da biblioteca. `engine`
- `save(doc, name)`, `toJson`, `fromJson` (`vfx-io.ts`) `engine`

### 14.3 Partículas brutas

- `instance.particles: { count, positions, velocities, ages, lifetimes, sizes, colors }` — leitura e escrita por frame (`particle-pool.ts`). `expor`
- Módulo custom: `helix.vfx.modules.register(kind, { init(p), update(p, dt) })`. `novo`
- Shader próprio por emissor: `renderer.shader = asset` (seção 8.6). `novo`

---

## 15. Entrada — `helix.input`

Ponte: `character/controller/character-input.ts`, `editor/viewport/use-viewport-input.ts`, `editor/shortcuts/*`.

- Teclado: `isDown(key)`, `wasPressed(key)`, `wasReleased(key)`, `onKeyDown(handler)`, `onKeyUp(handler)`, `keysDown(): string[]`; códigos físicos (`KeyW`) e teclas lógicas. `expor`
- Mouse/ponteiro: `pointer { x, y, dx, dy, buttons, wheel, inside }`, `lockPointer()`, `unlockPointer()`, `pointerLocked`, `onPointerDown/Up/Move`, `cursor: 'default' | 'none' | 'crosshair' | …` `expor` (`CharacterInput` já faz lock e look)
- Toque: `touches[] { id, x, y, dx, dy }`, gestos `pinch`, `pan`. `novo`
- Gamepad: `gamepads()`, `axis(pad, index)`, `button(pad, index)`, `rumble(pad, strong, weak, ms)`. `novo`
- Mapa de ações: `actions.define('jump', ['Space', 'Gamepad:A'])`, `action('jump').pressed`, `axis2d('move', { up, down, left, right, stick })`, remapeável em runtime (menu de controles). `novo`
- `InputFrame` do personagem (`x, z, run, jump, crouchToggles, lookX, lookY, wheel`): `helix.input.characterFrame()` leitura; escrita via `character.setIntent` (9.5). `engine`
- Texto: `onTextInput(handler)` com composição IME respeitada. `novo`
- Prioridade: GUI com foco consome primeiro (`hasFocusedInput`); `helix.input.capture = 'game' | 'gui' | 'both'`. `expor`
- Atalhos do editor (`isEditor`): `shortcutBindings.resolve`, `register(action, chord)` (seção 19). `engine`

---

## 16. Ativos e biblioteca — `helix.assets`

Ponte: `assets/library/*`, `assets/import/*`, `assets/image-decoder.ts`, `editor/operations/asset-library-operations.ts`, `editor/library/*`.

- `AssetKind`: `model | texture | audio | animation | gui | font | video | vfx | script` `engine`
- `get(id)`, `byName(name, kind?)`, `list(kind?)`, `byTag(tag)`, `search(query)`, `tags(asset)`, `setTags`, `rename`, `remove`, `exists` `engine`
- `file(asset): File/Blob`, `url(asset): string` (object URL gerenciado) `engine`
- Carregar por tipo: `model(asset): { meshes, materials, rig, skins, animations, hierarchy }`, `texture(asset): Texture`, `audio(asset): AudioBuffer`, `animation(asset): AnimationDocument`, `gui(asset): GuiDocument`, `vfx(asset): VfxDocument`, `font(asset): FontFace`, `video(asset): HTMLVideoElement`, `script(asset): ScriptDocument` `engine`
- Importar em runtime (`assets/import/*`): `import(file | url, options?)` — glTF/GLB, OBJ+MTL, STL, FBX (ASCII e binário), BVH, imagens, áudio (`audio-formats.ts`), vídeo, `.hxgui`, `.hxvfx`, `.hxanim`, scripts, fontes; `options`: `convertUnits, placement, saveToLibrary, materializer` (`import-materializer.ts`). `engine`
- Pacotes de arquivos (`file-bundle.ts`): `bundle(files)` para modelos com texturas ao lado. `engine`
- Miniaturas (`thumbnails/*`): `thumbnail(asset): Blob`. `engine`
- Dados: ativos `json | yaml | toml | xml | markdown | csv` → `data(asset): any` (parse feito pela engine), `text(asset): string`. `novo`
- Eventos: `assets.added`, `assets.changed`, `assets.removed`. `engine` (`AssetLibrary.onChange`)
- Pastas e organização da biblioteca (editor): `folders`, `move(asset, folder)`. `engine`

---

## 17. Projeto, cena e persistência — `helix.project`, `helix.storage`

Ponte: `project/*`, `core/storage/*`, `core/transfer/download-blob.ts`.

### 17.1 Projeto

- `id, name, template, formatVersion (PROJECT_FORMAT_VERSION), createdAt, openedAt` `engine`
- `rename(name)` `engine`
- `settings`: tudo de `Scene`: `sky (7), postProcessing (8), physics (9), player (9.5), audio (12.1), scripting (1.8)` `engine`

### 17.2 Cena como documento

- `serialize(): SceneDocument` (`serialize-scene.ts`), `deserialize(doc)` (`deserialize-scene.ts`), `toBinary`, `fromBinary` (`binary-table.ts`), `plainData` (`restoreInto`) `engine`
- `save()` (agora), `autosave { enabled, state: 'clean' | 'dirty' | 'saving' | 'error', lastSavedAt, markDirty() }` (`project-autosave.ts`) `engine`
- Instantâneos (`scene-snapshots.ts`, `scene-store.ts`): `snapshots()`, `restore(key)`, `snapshotNow(label)` `engine`
- Várias cenas por projeto: `scenes()`, `load(sceneName, { additive })`, `unload`, `current`, `onLoaded` — níveis e menus. `novo`
- Prefabs: `helix.scene.saveAsPrefab(entity, name)`, `instantiatePrefab(asset, parent?)` — sub-árvore como ativo `.hxprefab` da biblioteca (`project/prefab/`, `editor/operations/prefab-operations.ts`); a instância nasce com ids novos, e a raiz mantém a transformação local gravada. `engine`

### 17.3 Backup e arquivos

- `.helix`: `exportProject(): Blob`, `importProject(file)` (`project-file.ts`, `project-backup.ts`) `engine`
- `download(blob, name)` (`download-blob.ts`), `pickFiles(accept, multiple)` (`editor/files/file-picker.tsx`) `engine`
- Saúde do armazenamento (`storage-health.ts`): `quota(): { used, total }`, `persisted`, `requestPersistence()` `engine`

### 17.4 Saves do jogo — `helix.storage`

Dados do jogador, separados da cena (progresso, opções). `novo`

- `get(key): JsonValue`, `set(key, value)`, `remove(key)`, `keys()`, `clear()` — IndexedDB do projeto (`core/storage/*`), namespace por projeto.
- `slot(name): Storage` — vários saves.
- `export(): Blob`, `import(blob)`.
- `session`: igual, mas vive só até fechar a aba.

---

## 18. Jogo (modo play) — `helix.play`

Ponte: `editor/playtest/*`, `scripting/script-document.ts`.

- `state: 'stopped' | 'playing' | 'paused'`, `play()`, `pause()`, `togglePlayPause()`, `stop()`, `stepOnce()`, `timeScale` `engine`
- `isRunning`, `isPossessing`, `pointerLocked` `engine`
- Eventos: `play.started`, `play.paused`, `play.resumed`, `play.stopped` — para scripts que precisam limpar estado. `novo`
- `helix.play.restart()`, `reloadScene()` (volta ao `.helix` salvo, sem sair do play). `novo`
- `helix.play.standalone: boolean` — rodando fora do editor (build exportado). `novo`
- Rede (contextos `client` / `server` já existem no documento de script): `helix.net.isServer`, `isClient`, `rpc(name, handler)`, `call(name, ...args)`, `replicate(entity, fields)`, `onPlayerJoined/Left`, `players()` — a engine define a ABI agora para as linguagens já nascerem com ela; o transporte vem depois. `novo`
- Build/exportação: `helix.play.export({ target: 'web' })` empacota cena, ativos usados e scripts compilados (seção 21) num site estático. `novo`

---

## 19. Editor (modo ferramenta) — `helix.editor`

Só disponível quando `helix.isEditor`. Scripts que usam esta seção são ferramentas, não jogo: nunca rodam no build.

Ponte: `editor/session/editor-session.ts`, `editor/history/*`, `editor/commands/*`, `editor/layout/*`, `editor/menus/*`, `editor/shortcuts/*`, `editor/dialogs/*`, `settings/*`.

- Seleção: `selection: Entity[]`, `select(entities)`, `clearSelection()`, `onSelectionChanged` `engine`
- Histórico: `undo()`, `redo()`, `execute(command)`, `beginGroup(label)` / `endGroup()`, `revision`; comandos prontos (`set-value-command`, `entity-commands`, `terrain-commands`, `gui-commands`, `vfx-commands`, `asset-library-commands`). `engine`
- Toda escrita via `helix.*` dentro do editor passa pelo histórico automaticamente (desfazer funciona para scripts de ferramenta). `expor`
- Painéis: `panels.open(id)`, `close`, `toggle`, `register({ id, title, render })` (`dock-layout`, `dock-panels`). `engine` / `novo`
- Menus e ações: `menus.add(path, { label, shortcut, run })`, `actions.register(id, run)` (`menu-bar`, `shortcut-actions`). `novo`
- Atalhos: `shortcuts.bind(action, chord)`, `resolve(event)` (`shortcut-bindings.ts`). `engine`
- Diálogos: `dialogs.open(id)`, `confirm(message)`, `prompt(message)`, `pickAsset(kind)`, `pickColor` (`editor-dialogs.ts`, `viewport-color-picker.ts`) `engine` / `novo`
- Configurações da engine (`engine-settings-schema.ts`): `settings.get(key)`, `set(key, value)`, `onChanged(key)` — todas as chaves `editor.*`, `render.*`, `simulation.*`, `audio.*`, `gui.*`, `selection.*`, `snap.*`, `project.*` (e `code.*` do editor de código, `editor/code/*`). `engine`
- Gizmos: `gizmo.mode: 'move' | 'rotate' | 'scale'`, `space: 'local' | 'world'`, `snap` (`snap-settings-menu.tsx`) `engine`
- Viewport: `viewport.capture(): Blob` (`viewport-capture.ts`), `frame(entity)`, `views` (`scene-view-pool.ts`) `engine`
- Importação (`editor/import/*`): `import.open(files)`, draft (`use-import-draft.ts`). `engine`
- Editor de código (`editor/code/*`): `code.open(asset, line?)`, `code.tabs`, `code.save(asset)`, `code.run()` (`runActiveScript`), `code.compile()` (`compileProject`). `engine`
- Console (`editor/panels/console-panel.tsx`): igual a `helix.log` + `clear()`. `engine`

---

## 20. A regra de substituição (três níveis por sistema)

Toda linguagem deve expor os três níveis para cada linha desta tabela; um teste de conformidade por célula.

| Sistema | 1. Ajustar | 2. Enganchar | 3. Desligar e substituir |
| --- | --- | --- | --- |
| Gráficos | `helix.render.*`, `RenderProfile` | `onBeforePass/onAfterPass`, `custom.add` | `render.enabled = false` + `render.gl` |
| Pós-processamento | `helix.post.*` | `post.custom.add` | `post.enabled = false` + passe custom |
| Shaders | uniformes | `#include` dos chunks | `shaders.override(...)` |
| Céu | `helix.sky.*` | `sky.hourChanged` | `sky.enabled = false` + `render.skybox` |
| Física | `PhysicsSettings`, corpos | `onPreStep`, `addForceField` | `physics.enabled = false` ou `physics.backend` |
| Personagem | `CharacterSettings` | `setIntent`, `inputSource = 'script'` | `controllerClass` ou cinemático próprio |
| Terreno | alturas, camadas, grama, água | `onRegionChanged`, `generateWith` | malha própria (`helix.mesh`) + `heightfield` só para física |
| GUI | documentos e nós | eventos por nó | `gui.enabled = false` + `canvas2d` / `domRoot` |
| Áudio | mixer, fontes, zonas | `busNode` | `audio.enabled = false` + `context` |
| Animação | player | `onEvent`, camadas | `evaluate` + `Pose` escrita à mão |
| VFX | documento e instância | `modules.register` | `particles` bruto + shader próprio |
| Entrada | mapa de ações | `onKeyDown` etc. | `capture = 'game'` + DOM listeners |
| Câmera | campos da câmera | `cameraControl = 'script'` | `main` = ator próprio |
| Cena | atores e componentes | eventos `scene.*` | — (a cena é o modelo; não se substitui) |
| Persistência | autosave | `serialize/deserialize` | `storage` próprio via `export/import` |

---

## 21. O que uma linguagem precisa entregar

Além de ligar as seções 1–20, cada linguagem tem obrigações próprias.

### 21.1 Execução

- Definir como o código roda no navegador: interpretador em JS/WASM (Luau, Lua, Python, Ruby, PHP, GDScript), transpilação para JS (TypeScript, Haxe, Dart, Kotlin/JS), compilação para WASM (C, C++, Rust, Zig, Go, Swift, C#/.NET, Java) ou nativo do navegador (JavaScript, WAT, GLSL/WGSL).
- `ScriptLanguage.compiler` passa por `pending → beta → ready` (`script-languages.ts`); só `ready` esconde o aviso do editor.
- Tempo de compilação visível no console e no `compileProject`; erros com arquivo e linha.
- Sandbox: sem acesso a `window`/DOM fora do que `helix` dá (a não ser pelos pontos brutos documentados). Isolamento por jogo.

### 21.2 Tipos e autocompletar

- Um pacote de definições `helix` na linguagem (`.d.ts`, `.d.luau`, `.pyi`, headers C, crate Rust, …) gerado **a partir deste documento** por `scripting/api-manifest` (o manifesto é a fonte; o `.md` e os pacotes derivam dele). `novo`
- O editor de código consome o mesmo manifesto para autocompletar e documentar ao passar o mouse (`editor/code/*`).

### 21.3 ABI entre linguagens (jogos mesclados)

- Valores que atravessam: `number, boolean, string, Vec3, Quat, Entity (por id), Asset (por id), arrays, mapas, funções (callbacks por handle)`.
- `require` de um script em outra linguagem devolve um módulo com essas assinaturas; tudo além disso é erro de compilação com mensagem clara.

### 21.4 Erros e depuração

- Mapeamento de pilha para linha do script (source maps ou tabela própria).
- Breakpoints e inspeção de variáveis no editor de código são desejáveis, não bloqueiam `ready`.
- `helix.log.error` nunca derruba a engine; o script faltoso é desligado (`ScriptSettings.enabled = false`) com aviso.

### 21.5 Recarga a quente

- Salvar um script com o jogo rodando recompila só ele, chama `onBeforeHotReload` → troca → `onHotReload(state)`.

### 21.6 Modelos

- Os seis modelos de `scripting/script-templates.ts` (`blank, actor, module, game, ui, shader`) escritos na linguagem, compilando sem aviso.

---

## 22. Suíte de conformidade

Antes de uma linguagem entrar no editor, ela roda a mesma suíte que todas as outras: um script por seção, na linguagem candidata, verificado pela engine.

```
scripting/conformance/
  01-runtime.<ext>        ciclo de vida, tempo, eventos, props, require
  02-scene.<ext>          consulta, spawn, clone, destroy, transform, tags
  03-mesh.<ext>           primitivas, procedural, raycast, CSG
  04-material.<ext>       material, biblioteca, textura dinâmica
  05-light.<ext>          todos os tipos, presets, sincronia com o céu
  06-camera.<ext>         main, screenToRay, pick, câmera do jogador
  07-sky.<ext>            tempo, nuvens, presets, substituir
  08-render.<ext>         pós, opções, stats, ganchos, gl bruto, shader
  09-physics.<ext>        mundo, corpos, consultas, eventos, triggers, personagem
  10-terrain.<ext>        alturas, geração, esculpir, camadas, grama, água
  11-gui.<ext>            telas, nós, controles, eventos, HUD, superfícies, HTML
  12-audio.<ext>          mixer, fontes, zonas, clipes, análise, bruto
  13-animation.<ext>      clipes, player, eventos, IK, pose
  14-vfx.<ext>            componente, documento, burst, partículas brutas
  15-input.<ext>          teclado, ponteiro, ações, gamepad
  16-assets.<ext>         consulta, carregar por tipo, importar, dados
  17-project.<ext>        serializar, snapshots, storage de saves
  18-play.<ext>           estados, eventos, standalone
  19-editor.<ext>         seleção, histórico, painéis (só em isEditor)
  20-override.<ext>       os três níveis de cada sistema
```

Critério de aprovação: todas as asserções passam, nenhum aviso no console, nenhum membro deste documento sem ponte (o manifesto da seção 21.2 compara automaticamente a lista de membros com o que a ponte registrou e falha listando o que falta).

---

## 23. Mapa de pontes (onde cada namespace vive no código)

| Namespace | Módulos da engine |
| --- | --- |
| `helix` (núcleo) | `scripting/*`, `editor/playtest/playtest-controller.ts`, `core/engine-info.ts` |
| `helix.time`, `helix.task`, `helix.events`, `helix.props`, `helix.storage`, `helix.net`, `helix.input` | novos módulos `scripting/runtime/*` |
| `helix.log`, `helix.debug` | `editor/session/editor-session.ts` (`log`), `renderer/gl/line-batch.ts` |
| `helix.math` | `core/math/*`, `core/noise/*`, `core/color/*` |
| `helix.scene`, `helix.transform` | `core/scene/*`, `editor/commands/entity-commands.ts` |
| `helix.mesh`, `helix.csg` | `renderer/geometry/*`, `geometry/csg/*`, `renderer/lod/*` |
| `helix.material`, `helix.texture` | `core/scene/material.ts`, `core/scene/texture.ts`, `materials/*` |
| `helix.light` | `core/scene/light.ts`, `core/scene/light-presets.ts`, `editor/lights/*` |
| `helix.camera` | `renderer/camera/*`, `editor/viewport/pick-entity.ts`, `editor/gizmo/screen-space.ts` |
| `helix.sky` | `core/environment/*`, `renderer/sky/*` |
| `helix.render`, `helix.post` | `renderer/renderer.ts`, `renderer/passes/*`, `renderer/post/*`, `renderer/gl/*`, `renderer/quality/*`, `renderer/myriad/*`, `renderer/shaders/*` |
| `helix.physics`, `helix.character`, `helix.player` | `physics/*`, `character/*` |
| `helix.terrain` | `terrain/*`, `renderer/terrain/*`, `renderer/foliage/*` |
| `helix.gui` | `gui/*`, `editor/playtest/playtest-hud.ts` |
| `helix.audio` | `audio/*` |
| `helix.animation` | `core/animation/*`, `animation/*`, `character/animation/*`, `character/rig/*` |
| `helix.vfx` | `vfx/*` |
| `helix.assets` | `assets/*`, `editor/operations/asset-library-operations.ts` |
| `helix.project` | `project/*`, `core/storage/*` |
| `helix.play` | `editor/playtest/*` |
| `helix.editor` | `editor/*`, `settings/*` |

---

## 24. Manutenção deste documento

- Mudou algo no editor (campo novo no inspetor, ferramenta nova, painel novo)? A mudança só está completa quando o membro correspondente está aqui, com estado, e no manifesto.
- Um membro `expor` ou `novo` que ficou pronto vira `engine` no mesmo commit que o implementa.
- Nenhuma linguagem fica `ready` com um membro `expor`/`novo` da sua família sem ponte: ou a engine expõe antes, ou a linguagem espera.
- Versão do contrato: `API_VERSION` em `scripting/api-manifest` acompanha `ENGINE_VERSION` (`core/engine-info.ts`, hoje `0.2.0`); scripts declaram a versão mínima que esperam e a engine avisa quando o jogo abre numa engine mais nova com membros renomeados.
