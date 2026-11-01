---
title: Ciclo de vida de um script
description: As funções que a engine chama num script, a ordem em que acontecem num frame, o passo fixo da física, o contexto de execução e o que acontece com erros.
order: 3
---

Um script anexado a um ator não "roda": ele **define funções** que a engine chama nos momentos certos. Todas são opcionais; defina só as que precisa.

## Os ganchos

| Função | Quando a engine chama |
| --- | --- |
| `onLoad()` | O script foi compilado e ligado ao ator, antes da cena começar. Nada mais está garantido ainda: outros atores podem não ter carregado. |
| `onStart()` | O primeiro frame em que o ator está ativo. Tudo já existe: é o lugar de procurar outros atores e guardar referências. |
| `onUpdate(dt)` | Todo frame, antes do render. `dt` é o tempo desde o frame anterior, em segundos, já escalado por `helix.time.scale`. |
| `onFixedUpdate(h)` | A cada passo de física, com `h` fixo (padrão 1/60 s). Pode rodar zero, uma ou várias vezes por frame. Forças, impulsos e tudo o que toca corpos rígidos vai aqui. |
| `onLateUpdate(dt)` | Depois da física, da animação e da câmera, antes do render. Para o que precisa ler posições finais: câmeras que seguem, rótulos que acompanham. |
| `onRender(frame)` | Depois do frame desenhado. Para desenhos de depuração e overlays. |
| `onEnable()` / `onDisable()` | O interruptor do script ou a visibilidade do ator mudou. |
| `onStop()` | O jogo parou e voltou ao editor. |
| `onDestroy()` | O ator foi removido da cena. |
| `onBeforeHotReload()` / `onHotReload(state)` | O arquivo foi salvo com o jogo rodando. A primeira devolve o estado a preservar; a segunda o recebe no código novo. |

```luau
local alvo
local velocidade = 2

function onStart()
  alvo = helix.scene.find("Jogador")
end

function onUpdate(dt)
  if not alvo then return end
  local direcao = helix.math.vec3.normalize(helix.math.vec3.sub(alvo.transform.position, helix.self.transform.position))
  helix.self.transform:translate(helix.math.vec3.scale(direcao, velocidade * dt))
end

function onBeforeHotReload()
  return { velocidade = velocidade }
end

function onHotReload(state)
  velocidade = state.velocidade
end
```

Em linguagens com classes (C#, Java, Kotlin, Swift, Haxe), os ganchos são métodos de uma classe que estende `Helix.Actor`; em Python e Ruby usam `snake_case` (`on_update`); em C, C++, Rust, Zig e Go são funções exportadas com o prefixo `helix_`.

## Um frame

A ordem dentro de um frame é fixa e a mesma em todas as linguagens:

1. Entrada: o estado do teclado, do mouse e dos gamepads é lido.
2. `onUpdate` de todos os scripts, na ordem de execução.
3. Física: zero ou mais passos fixos; em cada um, `onFixedUpdate` de todos os scripts, depois a integração, depois os eventos de contato.
4. Animação: os players avaliam os clipes e escrevem as poses.
5. Câmera: o controlador do personagem e as câmeras de script atualizam.
6. `onLateUpdate`.
7. Interface: as telas calculam o layout e respondem aos eventos.
8. Render.
9. `onRender`.
10. Eventos agendados para o fim do frame (`helix.time.nextFrame`).

### A ordem de execução entre scripts

Por padrão, os scripts rodam na **ordem da hierarquia**: do primeiro ator ao último, de cima para baixo, pais antes dos filhos. Um script que precisa rodar antes ou depois dos outros declara `helix.props.executionOrder` (negativo para antes, positivo para depois). A ordem resultante aparece no painel Scripts, em **Ordem de execução**, para não haver surpresa.

### Passo fixo

A física não usa `dt`: ela integra com um passo fixo `h`, acumulando o tempo do frame e dando quantos passos couberem. Num frame de 50 ms a 60 Hz, `onFixedUpdate` roda três vezes; num frame de 8 ms, zero ou uma. É isso que torna a simulação determinística e independente da taxa de quadros. Regras práticas:

- forças, impulsos, velocidades e tudo o que lê ou escreve `rigidBody`: em `onFixedUpdate`;
- leitura de entrada e lógica de jogo: em `onUpdate`;
- nunca use `dt` em `onFixedUpdate` nem `h` em `onUpdate`.

O passo e o número máximo de subpassos por frame ficam em **Painel Física ▸ Mundo**.

## Contexto de execução

Cada script anexado tem um **contexto**, escolhido no Inspetor e lido em `helix.context`:

| Contexto | Onde roda |
| --- | --- |
| `shared` | Em todo lugar: no editor, no cliente e no servidor. O padrão para jogos sem multiplayer. |
| `client` | Só no cliente: interface, câmera, efeitos, som. |
| `server` | Só no servidor: a autoridade sobre o estado do jogo. |

Sem multiplayer, `shared` e `client` são equivalentes e `server` não roda. Veja [Multiplayer](/helix/docs/pt-br/scripting/multiplayer).

Dois outros sinalizadores completam o contexto: `helix.isEditor` (o script está dentro do editor, em qualquer estado) e `helix.isPlaying` (a simulação está ligada). Um script de jogo normalmente ignora os dois; um script de ferramenta testa `isEditor`.

## Quem sou eu

`helix.self` é o ator que carrega o script (`nil` no script de entrada e nos scripts executados pela barra de comando). `helix.script` é o próprio script: `assetId`, `name`, `language`, `enabled`, e os métodos `enable()` e `disable()`.

## Tempo

`helix.time` reúne o que um script precisa saber sobre o relógio:

| Membro | O que é |
| --- | --- |
| `now` | Segundos desde o início da simulação. |
| `delta`, `fixedDelta`, `unscaledDelta` | O `dt` deste frame, o `h` da física e o `dt` sem a escala de tempo. |
| `scale` | A escala de tempo; `0` pausa a lógica sem pausar a interface. |
| `frame` | O número do frame. |
| `realtime` | O relógio de parede, para medir desempenho. |

E as funções de agendamento: `wait(segundos)` e `waitFrames(n)` (que suspendem a tarefa atual), `delay(segundos, fn)`, `every(segundos, fn)` e `nextFrame(fn)`, todas devolvendo um cancelador. Tarefas concorrentes vivem em `helix.task`: `spawn(fn)`, `cancel(handle)`, `all([...])`, mapeadas ao idioma de cada linguagem (corrotinas em Luau e Lua, `async` em JavaScript e Python, goroutines em Go).

```luau
helix.task.spawn(function()
  helix.log.info("Porta", "abrindo")
  helix.time.wait(1.5)
  porta.animation:play("Abrir")
  helix.time.wait(porta.animation.duration)
  helix.events.emit("porta.aberta", { porta = porta })
end)
```

## Erros

Um erro num gancho não derruba a engine nem os outros scripts:

1. a mensagem vai ao Console com o nome do script, o arquivo e a linha (a pilha é mapeada de volta ao seu código, mesmo nas linguagens compiladas);
2. o script que falhou é **desativado** (`enabled = false`) e o ator ganha um aviso na Hierarquia;
3. salvar o script o reativa e tenta de novo.

`helix.log.assert(condição, mensagem)` falha alto de propósito, e `helix.log.trace()` imprime a pilha atual sem falhar. Nada é engolido: se algo deu errado e o Console está vazio, o erro não foi num script.

## Recarga a quente

Salvar um script com a simulação ligada recompila só ele e troca o código nas instâncias vivas. Para preservar estado entre as duas versões, devolva-o em `onBeforeHotReload` e receba-o em `onHotReload`. Variáveis de módulo não preservadas voltam ao valor inicial; referências a atores continuam válidas porque atores são identificados por id, não por objeto.
