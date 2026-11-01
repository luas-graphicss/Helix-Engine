---
title: Console, depuração e eventos
description: helix.log para o painel Console, helix.debug para desenhar no viewport e helix.events, o barramento global que liga scripts e sistemas.
order: 3
---

## helix.log

Escreve no painel Console (`EditorSession.log`) e, no jogo compilado, no registro do jogo. O primeiro argumento é a **fonte**, mostrada como etiqueta e usada pelo filtro do painel.

| Assinatura | Descrição |
| --- | --- |
| `debug(source: string, message: string): void` | Nível de depuração; oculto por padrão no jogo compilado. |
| `info(source: string, message: string): void` | Informação. |
| `warn(source: string, message: string): void` | Aviso. |
| `error(source: string, message: string): void` | Erro. Não interrompe o script. |
| `assert(condition: boolean, message?: string): void` | Se `condition` for falsa, lança um erro com a mensagem: o script é desativado e o Console mostra arquivo e linha. |
| `trace(): void` | Imprime a pilha atual, mapeada ao arquivo e à linha do script. |

Mensagens repetidas são agrupadas pelo painel com um contador. Objetos passados como mensagem são serializados de forma legível em todas as linguagens.

```luau
helix.log.info("Inventário", "coletou " .. item.name)
helix.log.assert(slots > 0, "inventário sem slots")
```

```csharp
Helix.Log.Warn("Inventário", $"slot {index} já ocupado");
```

## helix.debug

Desenha no overlay de linhas do viewport (`renderer/gl/line-batch.ts`), por cima da cena, sem profundidade. Cada desenho dura `seconds` (padrão: um frame). Visível no editor e no jogo compilado em perfil de desenvolvimento.

| Assinatura | Descrição |
| --- | --- |
| `line(a: Vec3, b: Vec3, color?: Vec3, seconds?: number): void` | Um segmento. |
| `ray(origin: Vec3, direction: Vec3, length?: number, color?, seconds?): void` | Um segmento a partir de uma origem e uma direção. |
| `sphere(center: Vec3, radius: number, color?, seconds?): void` | Três círculos ortogonais. |
| `box(aabb: Aabb, color?, seconds?): void` | As doze arestas de uma caixa alinhada aos eixos. |
| `arrow(from: Vec3, to: Vec3, color?, seconds?): void` | Um segmento com ponta. |
| `text(position: Vec3, text: string, color?, seconds?): void` | Um rótulo que acompanha a posição no mundo. |
| `clear(): void` | Remove todos os desenhos persistentes. |

```luau
function onFixedUpdate()
  local origem = helix.self.transform.position
  local hit = helix.physics.raycast(origem, { x = 0, y = -1, z = 0 }, 2)
  helix.debug.line(origem, hit and hit.point or helix.math.vec3.add(origem, { x = 0, y = -2, z = 0 }), hit and { x = 0, y = 1, z = 0 } or { x = 1, y = 0, z = 0 })
end
```

## helix.events

Barramento global tipado. Handlers rodam de forma **síncrona**, na ordem em que assinaram, no mesmo frame do `emit`.

| Assinatura | Descrição |
| --- | --- |
| `on(name: string, handler: (payload) => void): Unsubscribe` | Assina. Devolve a função que cancela. |
| `once(name: string, handler): Unsubscribe` | Assina para uma única chamada. |
| `off(name: string, handler): void` | Cancela uma assinatura específica. |
| `emit(name: string, payload?: any): void` | Dispara para todos os assinantes. |
| `onEntity(entity: Entity, name: string, handler): Unsubscribe` | Assina um evento com escopo de um ator: só dispara quando `payload.entity` (ou o ator fonte do evento da engine) é `entity`. |
| `emitEntity(entity: Entity, name: string, payload?): void` | Dispara um evento com escopo de ator. |

`Unsubscribe` é uma função sem argumentos. Assinaturas feitas por um script são canceladas automaticamente em `onDestroy`; cancele manualmente quando o handler deva viver menos que o ator.

### Cargas

A carga é um único valor, geralmente um mapa. Atravessa linguagens pela ABI comum: números, textos, booleanos, `Vec3`, `Quat`, atores e ativos (por id), listas e mapas.

### Eventos emitidos pela engine

Cada sistema documenta os seus na sua seção da referência. Os principais:

| Evento | Carga | Quando |
| --- | --- | --- |
| `scene.spawned` | `{ entity }` | Um ator entrou na cena. |
| `scene.destroyed` | `{ entity, id }` | Um ator saiu. `entity` já está inválido; use `id`. |
| `physics.collisionBegin` / `collisionEnd` | `{ entity, other, point, normal, impulse }` | Dois corpos começaram ou pararam de tocar. |
| `physics.triggerEnter` / `triggerExit` | `{ entity, other }` | Um corpo entrou ou saiu de um gatilho. |
| `gui.activate` | `{ screen, node, entity? }` | Um botão foi acionado. |
| `gui.changed` | `{ screen, node, value }` | Um controle mudou de valor. |
| `audio.ended` | `{ entity, clip }` | Uma fonte terminou. |
| `animation.event` | `{ entity, clip, name, time }` | O clipe passou por um marcador. |
| `vfx.finished` | `{ entity, effect }` | Um efeito não cíclico terminou. |
| `input.keyDown` / `keyUp` | `{ code, key, repeat }` | Tecla pressionada ou solta (código físico e tecla lógica). |
| `play.started` / `paused` / `resumed` / `stopped` | `{}` | A simulação mudou de estado. |
| `assets.added` / `changed` / `removed` | `{ asset }` | A biblioteca mudou. |

```luau
helix.events.onEntity(helix.self, "physics.triggerEnter", function(c)
  if c.other.tags:has("jogador") then
    helix.events.emit("checkpoint.alcancado", { indice = helix.props.get("indice") })
  end
end)
```

> [!TIP]
> Prefixe os seus eventos com o nome do seu jogo ou sistema (`moeda.coletada`, `porta.aberta`). Nomes sem prefixo e em inglês são reservados à engine.
