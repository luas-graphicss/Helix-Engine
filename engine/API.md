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
