---
title: Linguagens
description: As linguagens que a engine edita e executa, o estado de cada uma, como escolher a linguagem base do jogo e o que significa misturar linguagens.
order: 1
---

A engine não tem uma linguagem própria. Ela expõe uma API, `helix`, e deixa você escrevê-la na linguagem que já conhece. Todas as linguagens veem os mesmos atores, os mesmos componentes e os mesmos nomes; o que muda é a sintaxe.

## Estado de execução

Cada linguagem carrega um estado que o editor mostra num chip ao lado do nome:

| Estado | Rótulo no editor | Significado |
| --- | --- | --- |
| `ready` | Execução estável | A linguagem liga toda a API e passou na suíte de conformidade. Nenhum aviso. |
| `beta` | Execução em beta | Os scripts rodam, mas partes da API podem faltar ou mudar. O editor mostra um aviso ao criar scripts nela. |
| `pending` | Somente edição | O editor abre, realça e salva o arquivo, mas ele não é executado. É o estado das linguagens de dados e marcação, e das que ainda não têm runtime. |

## As linguagens

### Scripting

| Linguagem | Extensão | Estado | Como roda |
| --- | --- | --- | --- |
| Luau | `.luau` | estável | Interpretador em WebAssembly. Recomendada para quem começa: tipos opcionais, rápida e o modelo dos tutoriais. |
| Lua | `.lua` | estável | Interpretador em WebAssembly (5.4). |
| Python | `.py` | estável | Interpretador em WebAssembly. |
| GDScript | `.gd` | estável | Interpretador próprio da engine. |
| Ruby | `.rb` | estável | Interpretador em WebAssembly. |
| Haxe | `.hx` | estável | Transpilado para JavaScript. |
| JavaScript | `.js`, `.mjs` | beta | Nativo do navegador, dentro de uma sandbox. |
| TypeScript | `.ts` | beta | Transpilado para JavaScript. |
| C# | `.cs` | beta | Compilado para WebAssembly (.NET). |
| PHP | `.php` | beta | Interpretador em WebAssembly. |
| Dart | `.dart` | beta | Transpilado para JavaScript. |
| Java | `.java` | beta | Compilado para WebAssembly. |
| Kotlin | `.kt`, `.kts` | beta | Transpilado para JavaScript. |
| Swift | `.swift` | beta | Compilado para WebAssembly. |

### Sistemas

| Linguagem | Extensão | Estado | Como roda |
| --- | --- | --- | --- |
| C | `.c`, `.h` | beta | Compilado para WebAssembly. |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh` | beta | Compilado para WebAssembly. |
| Rust | `.rs` | beta | Compilado para WebAssembly. |
| Go | `.go` | beta | Compilado para WebAssembly. |
| Zig | `.zig` | beta | Compilado para WebAssembly. |
| WebAssembly (texto) | `.wat` | estável | Montado direto; é também o alvo das linguagens compiladas. |

### Shaders

| Linguagem | Extensão | Estado | Onde entra |
| --- | --- | --- | --- |
| GLSL | `.glsl`, `.frag`, `.vert` | estável | Shaders de material, de pós-processamento e de partículas (veja [Shaders personalizados](/helix/docs/pt-br/renderizacao/shaders)). |
| WGSL | `.wgsl` | estável | O mesmo, traduzido para GLSL ES 3.0 na compilação. |

### Web

| Linguagem | Extensão | Estado | Onde entra |
| --- | --- | --- | --- |
| HTML | `.html`, `.htm` | estável | Telas de interface declarativas. |
| CSS | `.css` | estável | Aparência das telas de interface. |
| SVG | `.svg` | estável | Ícones e imagens vetoriais na interface. |

### Dados e documentação

| Linguagem | Extensão | Estado | Onde entra |
| --- | --- | --- | --- |
| JSON | `.json` | estável | Carregado como dado: `helix.assets.data(ativo)`. |
| TOML | `.toml` | estável | Idem. |
| YAML | `.yaml`, `.yml` | somente edição | Editado e salvo; o parser chega com a próxima versão. |
| XML | `.xml` | somente edição | Idem. |
| Markdown | `.md` | somente edição | Notas de projeto e documentação do jogo. |
| Shell | `.sh` | somente edição | Scripts de ferramenta do editor em breve; nunca rodam no jogo. |

## A linguagem base

Cada jogo tem uma **linguagem base**, escolhida ao criar o jogo e alterável em **Configuração do jogo ▸ Scripting**. Ela decide:

- em que linguagem nascem os scripts novos (`Alt+N` no Código);
- qual linguagem a barra de comando interpreta;
- em que linguagem `require` procura módulos;
- qual pacote de tipos o autocompletar usa.

Trocar a linguagem base não converte scripts existentes: eles continuam na linguagem em que foram escritos e continuam rodando, mas o editor avisa que estão fora da base.

> [!TIP]
> Para quem está começando, Luau. É a linguagem dos exemplos deste manual e dos tutoriais, compila em milissegundos, tem tipos opcionais que o autocompletar aproveita, e a sintaxe cabe numa tarde.

## A mesma API em todas

A API é escrita uma vez, num manifesto, e cada linguagem recebe um pacote de tipos gerado dele: `.d.luau`, `.pyi`, `.d.ts`, headers C, um crate Rust. Os nomes seguem a convenção de cada idioma, mas são os mesmos nomes:

| Linguagens | Forma |
| --- | --- |
| Luau, Lua, JavaScript, TypeScript, Python, Ruby, PHP, Dart, GDScript | `helix.scene.spawn("mesh", { name = "Caixa" })` |
| C#, Java, Kotlin, Swift, Haxe | `Helix.Scene.Spawn("mesh", new SpawnOptions { Name = "Caixa" })` |
| C, C++, Rust, Zig, Go | `helix_scene_spawn(HELIX_MESH, &options)` ou `helix::scene::spawn(Kind::Mesh, options)` |

```luau
       
local luz = helix.scene.find("Lampada")
luz.light.intensity = 40
```

```typescript
             
const luz = helix.scene.find("Lampada")!
luz.light.intensity = 40
```

```csharp
     
var luz = Helix.Scene.Find("Lampada");
luz.Light.Intensity = 40;
```

```rust
       
let luz = helix::scene::find("Lampada").unwrap();
luz.light().set_intensity(40.0);
```

## Misturar linguagens

Por padrão um jogo tem uma linguagem. **Helix ▸ Funcionalidades beta ▸ Mesclar linguagens** libera scripts em várias linguagens no mesmo jogo, e `require` passa a atravessá-las por uma ABI comum. O que atravessa a fronteira:

- `number`, `boolean`, `string`;
- `Vec3`, `Quat`;
- `Entity` e `Asset` (pelo identificador);
- listas e mapas desses tipos;
- funções, como callbacks por handle.

Tudo além disso (classes, closures com estado, tipos próprios de uma linguagem) é um erro de compilação com mensagem clara, não um comportamento indefinido.

> [!WARNING]
> Mesclar linguagens é beta: os tempos de compilação se somam e a recarga a quente de um módulo atravessado reinicia os módulos que dependem dele. Use quando houver um motivo (uma biblioteca que só existe em uma linguagem, por exemplo), não como padrão.

## Sandbox

Scripts não enxergam `window`, o DOM nem a rede fora do que `helix` oferece. Os pontos de acesso bruto existem e estão documentados (`helix.render.gl`, `helix.audio.context`, `helix.gui.canvas2d`), mas são explícitos: um script que os usa está declarando que substitui aquele sistema. Cada jogo roda isolado dos outros abertos no mesmo navegador.
