---
title: Propriedades, módulos e eventos
description: Expor variáveis no Inspetor, dividir o código em módulos com require, o script de entrada do jogo e o barramento de eventos que liga scripts e sistemas.
order: 4
---

Três mecanismos tiram um script do isolamento: as **propriedades expostas** o ligam ao Inspetor, os **módulos** o ligam a outros scripts e os **eventos** o ligam aos sistemas da engine e aos outros atores.

## Propriedades expostas

Uma propriedade exposta é uma variável do script que aparece no Inspetor, na seção do script, e é salva no `.helix` **por instância**: o mesmo script em dez atores tem dez valores. É como um script vira um componente configurável.

```luau
helix.props.define({
  velocidade = { type = "number", default = 3, min = 0, max = 20 },
  alvo = { type = "Entity" },
  cor = { type = "color", default = { x = 1, y = 0.5, z = 0 } },
  som = { type = "Asset", kind = "audio" },
  modo = { type = "enum", options = { "patrulha", "perseguir", "parado" }, default = "patrulha" },
})

function onUpdate(dt)
  local v = helix.props.get("velocidade")
        
end
```

Em linguagens com decoradores ou atributos a declaração é anotada na própria variável (`@export var velocidade = 3` em GDScript, `[Export] float Velocidade = 3` em C#, `@helix.prop` em Python); em todas, o resultado é o mesmo campo no Inspetor.

| Tipo | Campo no Inspetor |
| --- | --- |
| `number` | Campo numérico; com `min` e `max`, um controle deslizante. |
| `boolean` | Interruptor. |
| `string` | Campo de texto. |
| `Vec3` | Três campos. |
| `color` | Seletor de cor com conta-gotas. |
| `Entity` | Campo de referência: arraste um ator ou use a mira. |
| `Asset` (com `kind`) | Seletor da biblioteca filtrado pelo tipo. |
| `enum` | Lista suspensa com as opções. |
| `range` | Dois números, mínimo e máximo. |

`helix.props.get(nome)` lê, `set(nome, valor)` escreve (e atualiza o Inspetor) e `onChanged(nome, fn)` avisa quando o valor muda, inclusive quando alguém o altera no Inspetor durante a simulação.

> [!NOTE]
> Propriedades são lidas em `onLoad` já com os valores da instância. Guardá-las em variáveis locais no `onStart` é bom para desempenho; ler `helix.props.get` a cada frame também funciona e reflete mudanças ao vivo.

## Módulos

Um script que não está anexado a nenhum ator pode ser um **módulo**: um pedaço de código que outros scripts carregam com `require` (ou `import`, conforme a linguagem). O modelo **Módulo** do editor cria a estrutura certa.

```luau
                         
local Suavizar = {}

function Suavizar.aproximar(atual, alvo, velocidade, dt)
  return helix.math.scalar.damp(atual, alvo, velocidade, dt)
end

return Suavizar
```

```luau
                           
local Suavizar = require("Util/Suavizar")
altura = Suavizar.aproximar(altura, alvo, 8, dt)
```

`require` aceita três formas de endereço, todas resolvidas na biblioteca:

| Forma | Exemplo | Observação |
| --- | --- | --- |
| Caminho de pasta | `require("Util/Suavizar")` | Relativo à raiz da biblioteca; o mais legível. |
| Nome do ativo | `require("Suavizar")` | Funciona enquanto o nome for único. |
| Identificador | `require("asset:9f3c…")` | Sobrevive a renomear e mover; é o que o editor grava ao arrastar um script para o código. |

Módulos são carregados uma vez por jogo e guardados em cache: dois scripts que fazem `require` do mesmo módulo compartilham a mesma tabela, o que os torna um lugar natural para estado global. Ciclos (`A` requer `B` que requer `A`) são detectados e reportados com os dois nomes em vez de produzirem um módulo pela metade.

Com **Mesclar linguagens** ligado, `require` atravessa linguagens pela ABI comum (veja [Linguagens](/helix/docs/pt-br/scripting/linguagens#misturar-linguagens)).

## O script de entrada

**Configuração do jogo ▸ Scripting ▸ Script de entrada** aponta um script que roda **antes de qualquer `onStart`**, sem ator (`helix.self` é `nil`). É o lugar da configuração global: registrar eventos, definir o mapa de ações da entrada, carregar saves, decidir que cena abre. O modelo **Jogo** do editor cria um.

```luau
helix.input.actions.define("pular", { "Space", "Gamepad:A" })
helix.input.actions.define("correr", { "ShiftLeft", "Gamepad:LeftStick" })

helix.events.on("play.started", function()
  local progresso = helix.storage.get("progresso") or { fase = 1 }
  helix.log.info("Jogo", "fase " .. progresso.fase)
end)
```

## Eventos

`helix.events` é um barramento global com nome e carga. Ele liga scripts entre si sem que um precise conhecer o outro, e é por ele que a engine avisa o que acontece.

| Função | O que faz |
| --- | --- |
| `on(nome, fn)` | Assina; devolve uma função que cancela a assinatura. |
| `once(nome, fn)` | Assina uma vez só. |
| `off(nome, fn)` | Cancela. |
| `emit(nome, carga)` | Dispara para todos os assinantes, de forma síncrona, na ordem em que assinaram. |
| `onEntity(ator, nome, fn)` | Assina um evento com escopo de um ator (`physics.collisionBegin` daquele corpo, `gui.activate` daquele botão). |

```luau
local cancelar = helix.events.on("moeda.coletada", function(carga)
  pontos += carga.valor
  hud:find("Pontos").text = tostring(pontos)
end)

function onDestroy()
  cancelar()
end
```

> [!IMPORTANT]
> Assinaturas feitas em `onStart` devem ser canceladas em `onDestroy` (ou `onStop`), senão o handler sobrevive ao ator e continua rodando com referências mortas. O editor avisa no Console quando detecta assinaturas órfãs ao parar a simulação.

### Eventos da engine

Cada sistema emite os seus; a lista completa está na seção correspondente da referência. Os mais usados:

| Evento | Quando |
| --- | --- |
| `scene.spawned`, `scene.destroyed` | Um ator entrou ou saiu da cena. |
| `physics.collisionBegin`, `physics.collisionEnd`, `physics.triggerEnter`, `physics.triggerExit` | Contatos e gatilhos; a carga traz os dois atores e o ponto de contato. |
| `gui.activate`, `gui.changed` | Um botão foi acionado, um controle mudou de valor. |
| `audio.ended` | Uma fonte terminou de tocar. |
| `animation.event` | O clipe passou por um marcador de evento. |
| `vfx.finished` | Um efeito não cíclico terminou. |
| `input.keyDown`, `input.keyUp` | Teclas, quando você prefere eventos ao estado. |
| `play.started`, `play.paused`, `play.resumed`, `play.stopped` | A simulação mudou de estado. |

Convenção de nomes: `sistema.acontecimento`, em inglês para os eventos da engine. Para os seus, use um prefixo do seu jogo (`moeda.coletada`, `porta.aberta`) para nunca colidir com os futuros eventos da engine.
