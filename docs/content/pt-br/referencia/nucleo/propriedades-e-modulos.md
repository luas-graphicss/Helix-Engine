---
title: Propriedades expostas e módulos
description: helix.props, as variáveis do script que aparecem no Inspetor, e require, o carregamento de módulos e o script de entrada.
order: 5
---

## helix.props

Variáveis do script que aparecem no Inspetor (na seção do script) e são salvas no `.helix` por instância, em `ScriptSettings`.

### Declaração

| Assinatura | Descrição |
| --- | --- |
| `define(schema: Record<string, PropSpec>): void` | Declara as propriedades. Chame no topo do script, fora dos ganchos. Linguagens com anotações (decorador, atributo, `@export`) geram a mesma declaração. |

### PropSpec

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `type` | `'number' \| 'boolean' \| 'string' \| 'Vec3' \| 'color' \| 'Entity' \| 'Asset' \| 'enum' \| 'range'` | O tipo, que decide o campo no Inspetor. |
| `default` | conforme o tipo | O valor inicial de instâncias novas. |
| `min`, `max`, `step` | `number` | Para `number` e `range`; com `min` e `max`, o campo vira um controle deslizante. |
| `kind` | `AssetKind` | Para `Asset`: `'model' \| 'texture' \| 'audio' \| 'animation' \| 'gui' \| 'font' \| 'video' \| 'vfx' \| 'script'`. |
| `options` | `string[]` | Para `enum`. |
| `label`, `description` | `string` | Rótulo e dica no Inspetor. Sem `label`, o nome da chave. |
| `group` | `string` | Agrupa campos sob um título recolhível. |

### Acesso

| Assinatura | Descrição |
| --- | --- |
| `get(name: string): any` | O valor desta instância. |
| `set(name: string, value: any): void` | Escreve e atualiza o Inspetor. Durante a simulação, a escrita é descartada ao parar, como toda alteração. |
| `onChanged(name: string, handler: (value, previous) => void): Unsubscribe` | Avisa quando o valor muda, por script ou pelo Inspetor. |
| `all(): Record<string, any>` | Todos os valores. |
| `executionOrder` | `number` | Posição deste script na ordem de execução (veja [Ciclo de vida](/helix/docs/pt-br/referencia/nucleo/ciclo-de-vida-e-contexto#ordem-de-execucao)). |

```luau
helix.props.define({
  velocidade = { type = "number", default = 3, min = 0, max = 20, step = 0.5, group = "Movimento" },
  alvo = { type = "Entity", label = "Alvo a seguir" },
  somDePasso = { type = "Asset", kind = "audio" },
})

helix.props.onChanged("velocidade", function(v)
  helix.log.debug("Patrulha", "velocidade agora " .. v)
end)
```

```gdscript
@export var velocidade: float = 3.0
@export var alvo: Entity
@export_enum("patrulha", "perseguir") var modo := "patrulha"
```

```csharp
[Export(Min = 0, Max = 20)] public float Velocidade = 3f;
[Export] public Entity Alvo;
```

## Módulos

| Assinatura | Descrição |
| --- | --- |
| `require(path: string): any` | Carrega um script como módulo e devolve o que ele exporta. Em JavaScript, TypeScript, Python, C# e outras, a forma nativa (`import`, `using`) é traduzida para isto. |

### Resolução

| Forma | Exemplo | Resolve por |
| --- | --- | --- |
| Caminho de pasta | `"Util/Suavizar"` | Pastas da biblioteca a partir da raiz. |
| Nome | `"Suavizar"` | Nome do ativo, se único. Ambíguo é erro de compilação. |
| Identificador | `"asset:9f3c2a…"` | `assetId`; o editor grava esta forma ao arrastar um script para o código. |

Regras:

- um módulo é avaliado **uma vez por jogo** e o resultado fica em cache: todos os `require` recebem a mesma referência;
- ciclos são detectados e reportados com os dois nomes envolvidos;
- com **Mesclar linguagens** ligado, `require` de um script em outra linguagem devolve um módulo cujas funções e valores atravessam pela ABI comum (`number`, `boolean`, `string`, `Vec3`, `Quat`, `Entity` e `Asset` por id, listas, mapas e funções por handle); qualquer outra coisa é erro de compilação;
- salvar um módulo com a simulação ligada recarrega-o e os scripts que dependem dele, com `onBeforeHotReload`/`onHotReload` em cada um.

## Script de entrada

| Membro | Onde | Descrição |
| --- | --- | --- |
| `ScriptingSettings.entryScriptId` | Configuração do jogo ▸ Scripting | O script que roda antes de qualquer `onStart`, sem ator (`helix.self == null`). |
| `ScriptingSettings.baseLanguage` | Configuração do jogo ▸ Scripting | A linguagem base: scripts novos, barra de comando, `require` e autocompletar. |

O script de entrada tem os mesmos ganchos de um script de ator, exceto `onEnable`/`onDisable`. `onLoad` roda uma vez, antes da cena; `onUpdate` roda todo frame, antes dos scripts de atores.

```luau
                    
local Jogo = require("Jogo/Estado")

function onLoad()
  Jogo.carregar(helix.storage.get("save") or Jogo.novo())
  helix.input.actions.define("pausar", { "Escape", "Gamepad:Start" })
end

function onUpdate()
  if helix.input.action("pausar").pressed then Jogo.alternarPausa() end
end
```
